// utils/auditLogger.js
const { AuditLog } = require("../models");

/**
 * 감사 로그 남기기 공통 함수
 * 사용 예:
 *   await logAudit({
 *     req,
 *     actorId: req.user.id,
 *     action: "ATTENDANCE_UPDATE",
 *     entityType: "Attendance",
 *     entityId: attendance.id,
 *     targetUserId: attendance.studentId,
 *     details: "status: present -> absent"
 *   });
 */
exports.logAudit = async ({
  req,
  actorId,
  action,
  entityType,
  entityId = null,
  targetUserId = null,
  details = null,
  ipAddress = null,
}) => {
  try {
    await AuditLog.create({
      actorId: actorId || null,
      targetUserId,
      action,
      entityType,
      entityId,
      details,
      ipAddress: ipAddress || req?.ip || null,
    });
  } catch (err) {
    console.error("❌ AuditLog 기록 중 오류:", err);
    // 감사 로그는 부가 기능이라, 여기서 에러가 나도 서비스 동작을 막지는 않음
  }
};
