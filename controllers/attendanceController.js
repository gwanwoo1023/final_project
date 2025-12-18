const { Attendance, Session, User, Notification } = require("../models");
const auditLogController = require("../controllers/auditLogController"); // ✅ 공통 로그 기능 사용

const ALLOWED_STATUS = ["present", "late", "absent", "excused"];

/** * ❗ 공통: 특정 강의에서 결석 2/3회 시 알림 생성 (로직 유지)
 */
async function createAbsentWarningIfNeeded(session, studentId) {
  if (!session || !studentId) return;
  const courseId = session.courseId;
  const absentCount = await Attendance.count({
    include: [{ model: Session, as: "session", where: { courseId } }],
    where: { studentId, status: "absent" },
  });
  let title = null;
  let message = null;
  if (absentCount === 2) {
    title = "출석 경고";
    message = "해당 강의에서 결석이 2회 발생했습니다. 주의하세요.";
  } else if (absentCount === 3) {
    title = "출석 위험";
    message = "해당 강의에서 결석이 3회 발생했습니다. 수강에 주의가 필요합니다.";
  }
  if (title && message) {
    await Notification.create({
      userId: studentId,
      type: "ATTENDANCE_WARNING",
      title,
      message,
      courseId,
      sessionId: session.id,
    });
  }
}

module.exports = {
  // =============================================================
  // ✅ 학생 출석 체크 (가장 강력한 중복 체크 예외 처리 버전)
  // =============================================================
  async checkAttendance(req, res) {
    try {
      const { sessionId, code, status } = req.body || {};
      const studentId = req.user?.id;

      if (!studentId) return res.status(401).json({ message: "로그인이 필요합니다." });
      if (!sessionId) return res.status(400).json({ message: "sessionId는 필수입니다." });

      const session = await Session.findByPk(sessionId);
      if (!session) return res.status(404).json({ message: "회차 정보를 찾을 수 없습니다." });
      if (!session.isOpen) return res.status(400).json({ message: "출석이 현재 열려있지 않습니다." });

      let finalStatus = "present";
      if (status && ALLOWED_STATUS.includes(status)) {
        finalStatus = status;
      }

      if (session.attendanceType === "code") {
        if (!code) return res.status(400).json({ message: "인증번호가 필요합니다." });
        if (String(code).trim() !== String(session.authCode).trim()) {
          return res.status(400).json({ message: "인증번호가 올바르지 않습니다." });
        }
      }

      // [가장 강력한 수정] 미리 생성된 데이터를 찾습니다.
      let record = await Attendance.findOne({
        where: { sessionId, studentId }
      });

      if (record) {
        // 현재 DB의 status 값을 깨끗하게 정리 (공백 제거, 소문자화)
        const currentStatus = String(record.status || "").trim().toLowerCase();
        
        // ★ 핵심: 이미 완료된 상태(present, late 등)인 경우에만 중복 에러를 냅니다.
        // 그 외의 모든 값(0, "0", "pending", "", null 등)은 미정으로 간주하고 통과시킵니다.
        if (ALLOWED_STATUS.includes(currentStatus)) {
          return res.status(400).json({ message: "이미 출석 완료되었습니다.", data: record });
        }
        
        // 업데이트 진행
        record.status = finalStatus;
        record.checkedAt = new Date();
        await record.save();
      } else {
        // 데이터가 없는 경우 새로 생성
        record = await Attendance.create({
          sessionId,
          studentId,
          status: finalStatus,
          checkedAt: new Date()
        });
      }

      if (finalStatus === "absent") {
        await createAbsentWarningIfNeeded(session, studentId);
      }

      await auditLogController.createLog(
        studentId,
        "ATTENDANCE_CHECK",
        record.id,
        { details: `학생 출석 체크 (status=${finalStatus})` }
      );

      return res.json({ message: "출석 체크 완료", data: record });
    } catch (err) {
      console.error("checkAttendance error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  // (이하 getStudentAttendance, getSessionAttendance, updateAttendanceStatus 기존 기능 100% 유지)
  async getStudentAttendance(req, res) {
    try {
      const { studentId } = req.params;
      const records = await Attendance.findAll({
        where: { studentId },
        include: [{ model: Session, as: "session" }],
        order: [["checkedAt", "DESC"]],
      });
      return res.json(records);
    } catch (err) {
      console.error("getStudentAttendance error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  async getSessionAttendance(req, res) {
    try {
      const { sessionId } = req.params;
      const records = await Attendance.findAll({
        where: { sessionId },
        include: [
          {
            model: User,
            as: "student",
            attributes: ["id", "name", "studentId", "role"],
          },
        ],
        order: [["checkedAt", "DESC"]],
      });
      return res.json(records);
    } catch (err) {
      console.error("getSessionAttendance error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  async updateAttendanceStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const adminId = req.user?.id;
      if (!status) return res.status(400).json({ message: "status는 필수입니다." });
      if (!ALLOWED_STATUS.includes(status) && status !== "0") {
        return res.status(400).json({ message: "올바르지 않은 상태 값입니다." });
      }
      const attendance = await Attendance.findByPk(id, { include: [{ model: Session, as: "session" }] });
      if (!attendance) return res.status(404).json({ message: "출석 기록을 찾을 수 없습니다." });
      const beforeStatus = attendance.status;
      attendance.status = status;
      attendance.checkedAt = new Date();
      await attendance.save();
      if (status === "absent" && beforeStatus !== "absent") {
        await createAbsentWarningIfNeeded(attendance.session, attendance.studentId);
      }
      await auditLogController.createLog(adminId, "ATTENDANCE_UPDATE", attendance.id, { details: `출석 상태 변경: ${beforeStatus} → ${status}` });
      return res.json({ message: "출석 상태 수정 완료", data: attendance });
    } catch (err) {
      console.error("updateAttendanceStatus error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },
};