// controllers/notificationController.js
const { Notification, AuditLog } = require("../models");

module.exports = {
  // 🔔 내 알림 조회
  async getMyNotifications(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const notifications = await Notification.findAll({
        where: { userId },
        order: [["createdAt", "DESC"]],
      });

      return res.json(notifications);
    } catch (err) {
      console.error("getMyNotifications error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  // 🔔 특정 알림 읽음 처리
  async markAsRead(req, res) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      const notification = await Notification.findOne({
        where: { id, userId },
      });

      if (!notification) {
        return res.status(404).json({ message: "알림을 찾을 수 없습니다." });
      }

      notification.isRead = true;
      await notification.save();

      // ✅ 감사 로그 기록
      await AuditLog.create({
        userId,
        action: "NOTIFICATION_READ",
        targetId: id,
        details: `알림 읽음 처리됨.`,
      });

      return res.json({ message: "읽음 처리 완료" });
    } catch (err) {
      console.error("markAsRead error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  // 🔔 모든 알림 읽음 처리
  async markAllAsRead(req, res) {
    try {
      const userId = req.user?.id;

      await Notification.update(
        { isRead: true },
        { where: { userId } }
      );

      // ✅ 감사 로그 기록
      await AuditLog.create({
        userId,
        action: "NOTIFICATIONS_ALL_READ",
        details: `사용자의 모든 알림 읽음 처리됨`,
      });

      return res.json({ message: "전체 읽음 처리 완료" });
    } catch (err) {
      console.error("markAllAsRead error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },
};
