// controllers/adminReportController.js
const { sequelize, Attendance, Session, Course, AuditLog } = require("../models");
const { Op, fn, col, literal } = require("sequelize");

// 오늘 00:00 ~ 내일 00:00
function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

exports.getAdminReport = async (req, res) => {
  try {
    // ✅ 세션 기반 인증: 미들웨어(authenticate/authorize)가 이미 막아주지만,
    // 혹시 직접 호출될 수 있으니 한번 더 안전하게 체크
    const user = req.session?.user;
    if (!user) return res.status(401).json({ message: "로그인이 필요합니다." });
    if (user.role !== "admin") return res.status(403).json({ message: "권한이 없습니다." });

    const { start, end } = getTodayRange();

    // --------------------------
    // 1) 시스템 상태 요약
    // --------------------------
    let dbStatus = "UNKNOWN";
    try {
      await sequelize.authenticate();
      dbStatus = "CONNECTED";
    } catch (e) {
      dbStatus = "DISCONNECTED";
    }

    const systemOverview = {
      serverStatus: "RUNNING",
      nodeEnv: process.env.NODE_ENV || "development",
      uptimeSeconds: Math.floor(process.uptime()),
      dbStatus,
      todayCreated: {
        attendances: await Attendance.count({ where: { createdAt: { [Op.gte]: start, [Op.lt]: end } } }),
        sessions: await Session.count({ where: { createdAt: { [Op.gte]: start, [Op.lt]: end } } }),
        courses: await Course.count({ where: { createdAt: { [Op.gte]: start, [Op.lt]: end } } }),
        auditLogs: await AuditLog.count({ where: { createdAt: { [Op.gte]: start, [Op.lt]: end } } }),
      },
      generatedAt: new Date().toISOString(),
    };

    // --------------------------
    // 2) 출석/강의 운영 통계
    // --------------------------
    const totalCourses = await Course.count();

    // 오늘 생성된 세션 수
    const sessionsToday = await Session.count({
      where: { createdAt: { [Op.gte]: start, [Op.lt]: end } },
    });

    // 현재 OPEN(출석 열림) 세션 수 (isOpen 기준)
    const sessionsOpen = await Session.count({
      where: { isOpen: true },
    });

    // 결석 경고/위험: "결석 2회 이상 / 3회 이상" 학생-강의 조합 수
    // (Attendance.status='absent' 을 Session(courseId)로 묶어서 집계)
    const absentAgg = await Attendance.findAll({
      attributes: [
        "studentId",
        [col("session.courseId"), "courseId"],
        [fn("COUNT", col("Attendance.id")), "absentCount"],
      ],
      include: [
        {
          model: Session,
          as: "session",
          attributes: [],
          required: true,
        },
      ],
      where: { status: "absent" },
      group: ["studentId", "session.courseId"],
      raw: true,
    });

    const warnThreshold = 2;
    const dangerThreshold = 3;

    const warningPairs = absentAgg.filter((r) => Number(r.absentCount) >= warnThreshold).length;
    const dangerPairs = absentAgg.filter((r) => Number(r.absentCount) >= dangerThreshold).length;

    const attendanceCourseStats = {
      totalCourses,
      sessionsCreatedToday: sessionsToday,
      sessionsOpenNow: sessionsOpen,
      absentWarningPairs: warningPairs, // (학생-강의) 기준으로 2회 이상 결석 조합 개수
      absentDangerPairs: dangerPairs,   // (학생-강의) 기준으로 3회 이상 결석 조합 개수
    };

    // --------------------------
    // 3) 감사 로그 요약
    // --------------------------
    const totalAuditLogs = await AuditLog.count();

    // 액션 TOP5
    const topActions = await AuditLog.findAll({
      attributes: ["action", [fn("COUNT", col("id")), "count"]],
      group: ["action"],
      order: [[literal("count"), "DESC"]],
      limit: 5,
      raw: true,
    });

    // 최근 감사 로그 20개
    const recentAuditLogs = await AuditLog.findAll({
      order: [["createdAt", "DESC"]],
      limit: 20,
    });

    const auditSummary = {
      totalAuditLogs,
      topActions: topActions.map((x) => ({ action: x.action, count: Number(x.count) })),
      recent: recentAuditLogs.map((l) => ({
        id: l.id,
        action: l.action,
        targetId: l.targetId ?? null,
        details: l.details ?? null,
        ipAddress: l.ipAddress ?? null,
        userId: l.userId,
        createdAt: l.createdAt,
      })),
    };

    return res.json({
      systemOverview,
      attendanceCourseStats,
      auditSummary,
    });
  } catch (err) {
    console.error("getAdminReport error:", err);
    return res.status(500).json({ error: "서버 에러" });
  }
};
