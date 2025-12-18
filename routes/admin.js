const express = require("express");
const router = express.Router();

const { authenticate, authorize } = require("../middleware/auth");
const adminController = require("../controllers/adminController");
const auditLogController = require("../controllers/auditLogController");
const adminReportController = require("../controllers/adminReportController");

// 모델 임포트 (데이터 생성을 위해 필요)
const db = require("../models");
const { Course, User, Attendance, Enrollment, AuditLog, SystemSetting, Holiday } = db;

// [보강] DB 테이블명 대소문자 및 모델명 차이(Session/ClassSession)를 해결하기 위한 변수
const SessionModel = db.Session || db.ClassSession;

// =========================================================
// 1. 사용자(User) 관리
// =========================================================
router.get("/users", authenticate, authorize("admin"), adminController.listUsers);
router.post("/users", authenticate, authorize("admin"), adminController.createUser);
router.patch("/users/:id", authenticate, authorize("admin"), adminController.updateUser);
router.delete("/users/:id", authenticate, authorize("admin"), adminController.deleteUser);

// =========================================================
// 2. 수강 등록 관리 (★ 전 주차 status: 0 자동 생성 로직 통합)
// =========================================================
router.post("/enrollments", authenticate, authorize("admin"), async (req, res) => {
    const { userId, courseId } = req.body;

    try {
        // 1. 수강 등록 실행 (이미 등록되어 있는지 확인 후 생성)
        const [enrollment, created] = await Enrollment.findOrCreate({
            where: { userId, courseId }
        });

        if (!created) {
            return res.status(400).json({ message: "이미 수강 등록된 학생입니다." });
        }

        // 2. [핵심] 해당 강의의 모든 세션(1~15주차 등)을 가져옴
        // SessionModel을 사용하여 ClassSessions 또는 Sessions 테이블에 유연하게 대응합니다.
        const sessions = await SessionModel.findAll({ 
            where: { courseId },
            order: [['week', 'ASC']]
        });

        console.log(`강의 ID ${courseId} 에서 찾은 세션 수:`, sessions.length);

        // 3. 해당 학생에 대해서만 모든 세션의 출석 데이터를 '미정(0)'으로 생성
        if (sessions && sessions.length > 0) {
            const initialAttendance = sessions.map(session => ({
                sessionId: session.id,
                studentId: userId,
                status: '0', // PDF 12번 요건: 미정(0) 코드로 기록
            }));

            // 중복 생성을 방지하며 데이터 삽입
            await Attendance.bulkCreate(initialAttendance, { ignoreDuplicates: true });
        }

        // 4. 감사 로그 기록
        await AuditLog.create({
            actorId: req.user.id,
            targetUserId: userId,
            action: 'ENROLL_STUDENT',
            details: `${courseId}번 강의에 학생(ID:${userId}) 등록 및 전 주차 출석 데이터(status:0) 초기화`,
            ipAddress: req.ip
        });

        res.json({ message: "수강 등록 및 모든 주차 출석 데이터 생성 완료" });
    } catch (error) {
        console.error("수강 등록 에러 상세:", error);
        res.status(500).json({ message: "수강 등록 중 오류 발생", error: error.message });
    }
});

// =========================================================
// 3. 과목(Course) 관리
// =========================================================
router.get("/courses", authenticate, authorize("admin"), adminController.listCourses);
router.post("/courses", authenticate, authorize("admin"), adminController.createCourse);
router.patch("/courses/:id", authenticate, authorize("admin"), adminController.updateCourse);
router.delete("/courses/:id", authenticate, authorize("admin"), adminController.deleteCourse);

// =========================================================
// 4. 학과/학기 관리
// =========================================================
router.get("/departments", authenticate, authorize("admin"), adminController.listDepartments);
router.post("/departments", authenticate, authorize("admin"), adminController.createDepartment);
router.patch("/departments/:id", authenticate, authorize("admin"), adminController.updateDepartment);
router.delete("/departments/:id", authenticate, authorize("admin"), adminController.deleteDepartment);

router.get("/semesters", authenticate, authorize("admin"), adminController.listSemesters);
router.post("/semesters", authenticate, authorize("admin"), adminController.createSemester);
router.patch("/semesters/:id", authenticate, authorize("admin"), adminController.updateSemester);
router.delete("/semesters/:id", authenticate, authorize("admin"), adminController.deleteSemester);

// =========================================================
// 5. 시스템 설정 & 규칙 저장
// =========================================================
router.get("/settings", authenticate, authorize("admin"), adminController.listSettings);
router.patch("/settings", authenticate, authorize("admin"), adminController.updateSetting);

router.post("/settings/bulk", authenticate, authorize("admin"), async (req, res) => {
    try {
        const { lateToAbsent, warningThreshold } = req.body;
        if (lateToAbsent) await SystemSetting.upsert({ key: 'LATE_RULE', value: String(lateToAbsent) });
        if (warningThreshold) await SystemSetting.upsert({ key: 'ABSENT_RULE', value: String(warningThreshold) });

        await AuditLog.create({
            actorId: req.user.id,
            action: 'POLICY_CHANGE',
            details: `출석 정책 변경: 지각 ${lateToAbsent}회=결석, 경고 기준 ${warningThreshold}회 이상`,
            ipAddress: req.ip
        });
        res.json({ message: "시스템 설정이 저장되었습니다." });
    } catch (error) {
        res.status(500).json({ message: "저장 실패" });
    }
});

// =========================================================
// 6. 리포트 / 감사 로그 / 공휴일
// =========================================================
router.get("/reports/stats", authenticate, authorize("admin"), adminController.getSystemStats);
router.get("/report", authenticate, authorize("admin"), adminReportController.getAdminReport);
router.get("/audit", authenticate, authorize("admin"), auditLogController.getLogs);
router.get("/audit-logs", authenticate, authorize("admin"), auditLogController.getLogs);

router.get("/setup-holidays", async (req, res) => {
    try {
        const holidays = [
            { date: '2025-05-05', name: '어린이날' }, { date: '2025-06-06', name: '현충일' },
            { date: '2025-08-15', name: '광복절' }, { date: '2025-10-03', name: '개천절' },
            { date: '2025-10-09', name: '한글날' }, { date: '2025-12-25', name: '크리스마스' }
        ];
        for (const h of holidays) {
            await Holiday.findOrCreate({ where: { date: h.date }, defaults: { name: h.name } });
        }
        res.send("<h1>✅ 2025년 공휴일 데이터 생성 완료!</h1>");
    } catch (e) { res.send(`<h1>에러: ${e.message}</h1>`); }
});

module.exports = router;