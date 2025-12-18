// controllers/sessionController.js
const {
  Course,
  Session,
  Attendance,
  Notification,
  AuditLog
} = require("../models");

const { Op } = require("sequelize");

const sessionController = {};

/**
 * ==========================================
 * 1) 수업 회차 생성 (교수/관리자)
 * ==========================================
 */
sessionController.createSession = async (req, res) => {
  try {
    const actorId = req.user?.id; // 감사로그용
    const { courseId } = req.params;
    const { week, attendanceType, date, startTime, endTime } = req.body;

    if (!week) {
      return res.status(400).json({ message: "week는 필수입니다." });
    }

    const course = await Course.findByPk(courseId);
    if (!course) {
      return res.status(404).json({ message: "과목을 찾을 수 없습니다." });
    }

    const type = attendanceType || "code";

    let authCode = null;
    if (type === "code") {
      authCode = String(Math.floor(1000 + Math.random() * 9000));
    }

    const session = await Session.create({
      courseId,
      week,
      date,
      startTime,
      endTime,
      attendanceType: type,
      authCode,
      isOpen: false,
      status: "READY",
      openUntil: null,
    });

    // 📌 감사 로그
    await AuditLog.create({
      userId: actorId,
      action: "SESSION_CREATED",
      targetId: session.id,
      details: `강의 ID ${courseId}, ${week}주차 수업 생성됨`
    });

    return res.status(201).json({
      message: "회차 생성 성공",
      session,
    });
  } catch (err) {
    console.error("createSession error:", err);
    return res.status(500).json({ error: "서버 에러" });
  }
};


/**
 * ==========================================
 * 2) 특정 과목의 회차 목록 조회
 * ==========================================
 */
sessionController.getSessionsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    const sessions = await Session.findAll({
      where: { courseId },
      order: [["week", "ASC"]],
    });

    return res.json(sessions);
  } catch (err) {
    console.error("getSessionsByCourse error:", err);
    return res.status(500).json({ error: "서버 에러" });
  }
};


/**
 * ==========================================
 * 3) 출석 시작 / 마감 토글
 * ==========================================
 *
 * 출석 열기 → OPEN
 * 출석 마감 → CLOSED
 *
 * + 학생들에게 알림 발송
 * + 감사 로그 저장
 */
sessionController.closeSessionAttendance = async (req, res) => {
  try {
    const actorId = req.user?.id; // 감사 로그 용
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "sessionId가 필요합니다." });
    }

    const session = await Session.findByPk(sessionId);
    if (!session) {
      return res.status(404).json({ message: "회차를 찾을 수 없습니다." });
    }

    const course = await Course.findByPk(session.courseId);
    const courseName = course ? course.name : "해당 강의";

    // 🔄 출석 열기/닫기 토글
    const nowOpen = !session.isOpen;
    session.isOpen = nowOpen;

    if (session.status !== undefined) {
      session.status = nowOpen ? "OPEN" : "CLOSED";
    }

    // 출석 열기 → 10분 타이머
    if (nowOpen) {
      const openUntil = new Date(Date.now() + 10 * 60 * 1000);
      if ("openUntil" in session) {
        session.openUntil = openUntil;
      }
    } else {
      if ("openUntil" in session) {
        session.openUntil = null;
      }
    }

    await session.save();

    // 📌 감사 로그 기록
    await AuditLog.create({
      userId: actorId,
      action: nowOpen ? "ATTENDANCE_OPENED" : "ATTENDANCE_CLOSED",
      targetId: session.id,
      details: `${session.week}주차, 출석 상태: ${nowOpen ? "OPEN" : "CLOSED"}`
    });

    // 📣 알림 보낼 대상 학생 찾기
    const attendanceRows = await Attendance.findAll({
      include: [
        {
          model: Session,
          as: "session",
          where: { courseId: session.courseId },
          attributes: [],
        },
      ],
      attributes: ["studentId"],
      group: ["studentId"],
    });

    const studentIds = attendanceRows.map((row) => row.studentId);

    if (studentIds.length > 0) {
      const title = nowOpen
        ? "출석 시작 알림"
        : "출석 마감 알림";

      const message = nowOpen
        ? `${courseName} ${session.week}주차 출석이 시작되었습니다.`
        : `${courseName} ${session.week}주차 출석이 마감되었습니다.`;

      const type = nowOpen ? "ATTENDANCE_OPEN" : "ATTENDANCE_CLOSED";

      await Notification.bulkCreate(
        studentIds.map((id) => ({
          userId: id,
          type,
          title,
          message,
          courseId: session.courseId,
          sessionId: session.id,
        }))
      );
    }

    return res.json({
      message: nowOpen ? "출석이 시작되었습니다." : "출석이 마감되었습니다.",
      session,
    });
  } catch (err) {
    console.error("closeSessionAttendance error:", err);
    return res.status(500).json({ error: "서버 에러" });
  }
};

module.exports = sessionController;
