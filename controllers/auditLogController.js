const { AuditLog } = require("../models");

const auditLogController = {
  /**
   * ✅ 로그 생성 공통 함수
   * @param {number} userId - 행위자 ID (학생 or 교수)
   * @param {string} action - 행동 유형 (예: ATTENDANCE_CHECK, EXCUSE_CREATED)
   * @param {number} targetId - 대상 ID (출석ID, 공결ID 등)
   * @param {object} details - 추가 정보 (객체나 문자열)
   */
  async createLog(userId, action, targetId, details) {
    try {
      // details가 객체라면 문자열로 변환, 문자열이면 그대로 저장
      const detailsStr = typeof details === "object" ? JSON.stringify(details) : details;

      await AuditLog.create({
        userId,
        action,
        targetId,
        details: detailsStr,
      });
      // 로그 생성 실패가 메인 로직(출석/공결)을 방해하지 않도록 에러를 던지지 않음
    } catch (err) {
      console.error("AuditLog create error:", err);
      // 로그 실패는 치명적이지 않으므로 pass
    }
  },

  /**
   * (선택) 로그 전체 조회 - 관리자용
   */
  async getLogs(req, res) {
    try {
      const logs = await AuditLog.findAll({
        order: [["createdAt", "DESC"]],
      });
      return res.json(logs);
    } catch (err) {
      console.error("getLogs error:", err);
      return res.status(500).json({ error: "로그 조회 실패" });
    }
  }
};

module.exports = auditLogController;