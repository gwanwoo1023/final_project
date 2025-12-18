const express = require("express");
const router = express.Router();
const { Attendance, Session, User, AuditLog, Notification, Enrollment, ClassSession } = require("../models");
const { authenticate, authorize } = require("../middleware/auth");

// 모델명 대응 보강
const SessionModel = Session || ClassSession;

// --- [보조 함수] 결석 횟수 계산 및 경고 알림 (기존 로직 100% 유지) ---
async function checkAndNotifyDanger(studentId, courseId) {
    try {
        const totalSessions = await SessionModel.findAll({ where: { courseId } });
        const records = await Attendance.findAll({
            include: [{ model: SessionModel, as: 'session', where: { courseId } }],
            where: { studentId }
        });

        const present = records.filter(r => r.status == '1').length;
        const late = records.filter(r => r.status == '2').length;
        const recordedAbsent = records.filter(r => r.status == '3').length; 
        const excuse = records.filter(r => r.status == '4').length;

        let automaticAbsent = 0;
        totalSessions.forEach(s => {
            const hasRecord = records.find(r => r.sessionId === s.id);
            if (!hasRecord && !s.isOpen && s.startTime) {
                automaticAbsent++;
            }
        });

        const conversionCount = Math.floor(late / 3);
        const finalAbsentCount = recordedAbsent + automaticAbsent + conversionCount;

        if (finalAbsentCount >= 2) {
            const isDanger = finalAbsentCount >= 3;
            const title = isDanger ? '⛔ 출석 위험 안내' : '⚠️ 출석 경고 안내';
            const levelMsg = isDanger ? '위험(F학점 위기)' : '경고';
            
            await Notification.create({
                userId: studentId,
                type: isDanger ? 'danger' : 'warning',
                title: title,
                message: `[${levelMsg}] 현재 누적 결석이 ${finalAbsentCount}회입니다. 관리가 필요합니다.`,
                courseId: courseId,
                isRead: false
            });
        }
    } catch (e) { console.error("알림 로직 오류", e); }
}

// 1. 출석 체크 (학생) - ★ 중복 체크 및 업데이트 로직 유지 ★
router.post("/check", authenticate, authorize("student"), async (req, res) => {
  try {
    const { sessionId, code } = req.body;
    const studentId = req.user.id;
    const session = await SessionModel.findByPk(sessionId);

    if (!session) return res.status(404).json({ message: "수업 없음" });
    if (!session.isOpen) return res.status(400).json({ message: "현재 출석 가능한 시간이 아닙니다." });
    if (session.attendanceType === 'code' && session.authCode !== code) return res.status(400).json({ message: "인증번호 오류" });

    const existing = await Attendance.findOne({ where: { sessionId, studentId } });

    if (existing && (existing.status == '1' || existing.status == '2')) {
        return res.status(400).json({ message: "이미 출석 완료되었습니다." });
    }

    let status = '1';
    if (session.startTime) {
        const now = new Date();
        const currentTotal = now.getHours() * 60 + now.getMinutes();
        const [h, m] = session.startTime.split(':');
        if (currentTotal > (parseInt(h) * 60 + parseInt(m)) + 10) status = '2'; 
    }

    if (existing) {
        await existing.update({ status, checkedAt: new Date() });
    } else {
        await Attendance.create({ sessionId, studentId, status, checkedAt: new Date() });
    }

    await checkAndNotifyDanger(studentId, session.courseId);
    res.json({ message: "출석 처리 완료" });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ message: "서버 에러" }); 
  }
});

// 2. 학생 본인 기록 조회 (유지)
router.get("/student/:studentId", authenticate, authorize("student", "instructor", "admin"), async (req, res) => {
  try {
    const list = await Attendance.findAll({
      where: { studentId: req.params.studentId },
      include: [{ model: SessionModel, as: 'session' }],
      order: [['createdAt', 'DESC']]
    });
    res.json(list);
  } catch (error) { res.status(500).json({ message: "에러" }); }
});

// 3. 교수용 명단 조회 (유지)
router.get("/session/:sessionId", authenticate, authorize("instructor", "admin"), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await SessionModel.findByPk(sessionId);
    if (!session) return res.status(404).json({ message: "수업 없음" });

    const enrolledStudents = await Enrollment.findAll({
      where: { courseId: session.courseId },
      include: [{ model: User, as: 'student', attributes: ['id', 'name', 'studentId'] }]
    });

    const attendanceRecords = await Attendance.findAll({ where: { sessionId } });

    const list = enrolledStudents.map(enroll => {
      const student = enroll.student;
      const record = attendanceRecords.find(r => r.studentId === student.id);
      
      return {
        id: record ? record.id : `temp-${student.id}`, 
        student: student,
        status: record ? record.status : (session.isOpen ? '0' : (session.startTime ? '3' : '0')),
        isNew: !record 
      };
    });

    res.json(list);
  } catch (error) { res.status(500).json({ message: "명단 로딩 실패" }); }
});

// 4. 통계 리포트 (★ 공결 데이터 추가 로직 ★)
router.get('/stats/:courseId', authenticate, async (req, res) => {
    try {
        const { courseId } = req.params;
        const totalSessionsList = await SessionModel.findAll({ 
            where: { courseId },
            attributes: ['id', 'isOpen', 'startTime']
        });
        const totalCount = totalSessionsList.length;
        
        let students = [];
        if (req.user.role === 'student') {
            students = await User.findAll({ 
                where: { id: req.user.id }, 
                attributes: ['id', 'name', 'studentId'] 
            });
        } else {
            const enrolls = await Enrollment.findAll({
                where: { courseId },
                include: [{ model: User, as: 'student', attributes: ['id', 'name', 'studentId'] }]
            });
            students = enrolls.map(e => e.student).filter(s => s !== null);
        }

        const report = [];
        for (const student of students) {
            const records = await Attendance.findAll({
                where: { studentId: student.id },
                include: [{ model: SessionModel, as: 'session', where: { courseId }, attributes: ['id'] }]
            });

            const presentCount = records.filter(r => r.status == '1').length;
            const lateCount = records.filter(r => r.status == '2').length;
            const recordedAbsent = records.filter(r => r.status == '3').length; 
            const excuseCount = records.filter(r => r.status == '4').length; // ★ 공결 횟수 계산 추가

            let autoAbsent = 0;
            totalSessionsList.forEach(s => {
                const hasRec = records.find(r => r.sessionId === s.id);
                if (!hasRec && !s.isOpen && s.startTime) autoAbsent++;
            });

            const pureAbsent = recordedAbsent + autoAbsent; 
            const conversionCount = Math.floor(lateCount / 3); 
            const remainingLates = lateCount % 3; 
            const finalAbsentCount = pureAbsent + conversionCount; 

            let rate = totalCount > 0 ? Math.round(((totalCount - finalAbsentCount) / totalCount) * 100) : 0;
            if (rate < 0) rate = 0;

            report.push({
                name: student.name,
                studentId: student.studentId,
                totalSessions: totalCount,
                presentCount,
                remainingLates,    
                pureAbsent,        
                excuseCount,       // ★ 공결 데이터 객체에 포함
                conversionCount,   
                finalAbsentCount,  
                rate,
                isDanger: finalAbsentCount >= 3 || rate < 70
            });
        }
        report.sort((a, b) => a.rate - b.rate);
        res.json(report);
    } catch (error) { 
        console.error(error);
        res.status(500).json({ message: '실패' }); 
    }
});

// 5. 정정 API (감사 로그 유지)
router.patch('/:id', authenticate, authorize('instructor', 'admin'), async (req, res) => {
    try {
        const { status, studentId, sessionId } = req.body; 
        let attendance;

        if (String(req.params.id).startsWith('temp-') || isNaN(req.params.id)) {
            attendance = await Attendance.create({ 
                studentId, sessionId, status, checkedAt: new Date() 
            });
            attendance = await Attendance.findByPk(attendance.id, {
                include: [{ model: User, as: 'student' }, { model: SessionModel, as: 'session' }]
            });
        } else {
            attendance = await Attendance.findByPk(req.params.id, {
                include: [{ model: User, as: 'student' }, { model: SessionModel, as: 'session' }]
            });
            if (!attendance) return res.status(404).json({ message: '기록 없음' });
            await attendance.update({ status });
        }

        const statusMap = { '0': '미정', '1': '출석', '2': '지각', '3': '결석', '4': '공결' };
        await AuditLog.create({
            actorId: req.user.id,
            targetUserId: studentId,
            entityType: 'Attendance',
            action: 'ATTENDANCE_CHANGE',
            details: `학생(ID:${studentId}) 상태 변경 -> [${statusMap[status] || '알수없음'}](Code: ${status})`,
            ipAddress: req.ip
        });
        
        await checkAndNotifyDanger(attendance.studentId, attendance.session.courseId);
        res.json({ message: '출석 상태가 정정되었습니다.' });
    } catch (error) { res.status(500).json({ message: '정정 처리 실패' }); }
});

// 6. 주차별 현황 (유지)
router.get('/my-status/:courseId', authenticate, authorize('student'), async (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = req.params.courseId;
        const sessions = await SessionModel.findAll({ where: { courseId }, order: [['week', 'ASC']] });
        const myRecords = await Attendance.findAll({
            where: { studentId: userId },
            include: [{ model: SessionModel, as: 'session', where: { courseId } }]
        });

        const result = sessions.map(s => {
            const record = myRecords.find(r => r.sessionId === s.id);
            let statusText = '미정';
            let color = 'gray';

            if (record) {
                const map = { '1': ['출석', 'green'], '2': ['지각', 'orange'], '3': ['결석', 'red'], '4': ['공결', 'blue'] };
                [statusText, color] = map[record.status] || ['미출석', 'gray'];
            } else {
                if (s.isOpen) {
                    statusText = '출석 진행 중';
                    color = '#008CBA';
                } else if (s.startTime) {
                    statusText = '결석 (미참여)';
                    color = 'red';
                } else {
                    statusText = '미정';
                    color = 'gray';
                }
            }
            return { sessionId: s.id, week: s.week, statusText, color };
        });
        res.json(result);
    } catch (e) { res.status(500).json([]); }
});

module.exports = router;