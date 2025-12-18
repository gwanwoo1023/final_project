const express = require('express');
const router = express.Router();
const { Session, Notification, Enrollment, User, AuditLog, Attendance } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

// --- [보조 함수] 마감 시 결석자 추출 및 알림 발송 로직 ---
async function notifyAbsentees(courseId, sessionWeek) {
    try {
        // 수강생 및 전체 수업 정보 조회
        const enrolls = await Enrollment.findAll({ where: { courseId } });
        const allSessions = await Session.findAll({ where: { courseId } });

        // 알림 전송 대상자가 있는지 먼저 확인
        if (!enrolls || enrolls.length === 0) return;

        // 알림 데이터를 한 번에 생성하기 위한 배열
        const notificationsToCreate = [];

        for (const student of enrolls) {
            const targetUserId = student.studentId; 

            // 해당 학생의 현재 코스 출석 기록 조회
            const records = await Attendance.findAll({
                where: { studentId: targetUserId },
                include: [{ model: Session, as: 'session', where: { courseId } }]
            });

            // 1. 자동 결석 계산 (마감되었고 시작 기록이 있는데 출석 기록이 없는 주차)
            let autoAbsent = 0;
            allSessions.forEach(s => {
                const hasRec = records.find(r => r.sessionId === s.id);
                // [수정] s.isOpen이 false이고 s.startTime이 있는 상태에서 기록이 없으면 결석
                if (!hasRec && !s.isOpen && s.startTime) autoAbsent++;
            });

            // 2. 누적 결석 횟수 계산 (수동 결석 + 자동 결석 + 지각 환산)
            const recordedAbsentCount = records.filter(r => r.status == '3').length;
            const lateCount = records.filter(r => r.status == '2').length;
            const finalAbsentCount = recordedAbsentCount + autoAbsent + Math.floor(lateCount / 3);

            // 3. 결석 1회 이상 시 알림 데이터 준비 (테스트 기준 1회)
            if (finalAbsentCount >= 1) {
                const isDanger = finalAbsentCount >= 3;
                notificationsToCreate.push({
                    userId: targetUserId,
                    type: isDanger ? 'danger' : 'warning',
                    title: isDanger ? '⛔ 출석 위험 안내' : '⚠️ 출석 경고 안내',
                    message: `[확인요망] ${sessionWeek}주차 마감! 누적 결석 ${finalAbsentCount}회입니다.`,
                    courseId: courseId,
                    isRead: false
                });
            }
        }

        // 알림 한 번에 저장 (bulkCreate 사용으로 속도 및 안정성 향상)
        if (notificationsToCreate.length > 0) {
            await Notification.bulkCreate(notificationsToCreate);
        }
        
        console.log(`[${sessionWeek}주차] ${notificationsToCreate.length}건의 마감 알림 생성 완료`);
    } catch (e) { 
        console.error("마감 알림 생성 중 에러:", e); 
    }
}

// 1. 수업 생성 (기존 유지)
router.post('/:courseId', authenticate, authorize('instructor', 'admin'), async (req, res) => {
    try {
        const { week, attendanceType } = req.body;
        const authCode = Math.floor(1000 + Math.random() * 9000).toString(); 

        await Session.create({
            courseId: req.params.courseId,
            week,
            attendanceType: attendanceType || 'code',
            authCode,
            startTime: null,
            isOpen: false
        });
        res.status(201).json({ message: '수업 생성 완료' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '생성 실패' });
    }
});

// 2. 수업 목록 조회 (기존 유지)
router.get('/:courseId', authenticate, async (req, res) => {
    try {
        const sessions = await Session.findAll({
            where: { courseId: req.params.courseId },
            order: [['week', 'ASC']]
        });
        res.json(sessions);
    } catch (error) {
        console.error("조회 에러:", error);
        res.status(500).json({ message: '조회 실패' });
    }
});

// 3. 수업 상태 변경 (OPEN/CLOSE) + 알림 통합
router.patch('/status', authenticate, authorize('instructor', 'admin'), async (req, res) => {
    try {
        const { sessionId, attendanceType } = req.body;
        const session = await Session.findByPk(sessionId);
        if (!session) return res.status(404).json({ message: '수업 없음' });

        const newStatus = !session.isOpen; 
        const updateData = { isOpen: newStatus };
        
        if (newStatus && !session.startTime) {
            const now = new Date();
            const timeString = now.toTimeString().split(' ')[0];
            updateData.startTime = timeString;
        }

        if (attendanceType) updateData.attendanceType = attendanceType;

        await session.update(updateData);

        // 감사 로그 기록
        await AuditLog.create({
            actorId: req.user.id,
            action: newStatus ? 'SESSION_OPEN' : 'SESSION_CLOSE',
            details: `${session.week}주차 수업 ${newStatus ? '시작' : '마감'}`,
            ipAddress: req.ip
        });

        if (newStatus) {
            // [출석 시작 알림]
            const students = await Enrollment.findAll({ where: { courseId: session.courseId } });
            if (students.length > 0) {
                const notiData = students.map(s => ({
                    userId: s.studentId, 
                    type: 'info',
                    title: '📢 출석 시작 알림',
                    message: `${session.week}주차 수업 출석이 시작되었습니다.`,
                    courseId: session.courseId,
                    isRead: false
                }));
                await Notification.bulkCreate(notiData); 
            }
        } else {
            // [수정] 출석 마감 시 await를 붙여 처리가 완료될 때까지 기다리도록 수정
            await notifyAbsentees(session.courseId, session.week);
        }

        res.json({ 
            message: newStatus ? '출석 시작! 📢' : '출석 마감 ⛔', 
            startTime: updateData.startTime 
        });
    } catch (error) {
        console.error("상태 변경 실패:", error);
        res.status(500).json({ message: error.message || '변경 실패' });
    }
});

module.exports = router;