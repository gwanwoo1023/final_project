// routes/notification.js
const express = require("express");
const router = express.Router();
const { Notification } = require("../models");
const { authenticate } = require("../middleware/auth");

// 🔔 내 알림 목록 조회
router.get("/", authenticate, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [["createdAt", "DESC"]],
    });
    res.json(notifications);
  } catch (err) {
    console.error("GET /notifications error:", err);
    res.status(500).json({ message: "서버 에러" });
  }
});

// 🔔 개별 알림 읽음 처리
router.patch("/:id/read", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const noti = await Notification.findOne({
      where: { id, userId: req.user.id },
    });
    if (!noti) {
      return res.status(404).json({ message: "알림을 찾을 수 없습니다." });
    }
    noti.isRead = true;
    await noti.save();
    res.json({ message: "읽음 처리 완료", data: noti });
  } catch (err) {
    console.error("PATCH /notifications/:id/read error:", err);
    res.status(500).json({ message: "서버 에러" });
  }
});

// 🔔 전체 알림 읽음 처리
router.patch("/read/all", authenticate, async (req, res) => {
  try {
    await Notification.update(
      { isRead: true },
      { where: { userId: req.user.id, isRead: false } }
    );
    res.json({ message: "전체 읽음 처리 완료" });
  } catch (err) {
    console.error("PATCH /notifications/read/all error:", err);
    res.status(500).json({ message: "서버 에러" });
  }
});

module.exports = router;
