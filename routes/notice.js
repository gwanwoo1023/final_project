const express = require("express");
const router = express.Router();

// ★ 알림 및 조회에 필요한 모든 모델 가져오기 (AuditLog 추가)
const {
  Notice,
  User,
  Course,
  Session,
  Attendance,
  Notification,
  AuditLog,
} = require("../models");
const { authenticate, authorize } = require("../middleware/auth");

// ====================================================
// 1. 공지 목록 조회
// ====================================================
router.get("/", authenticate, async (req, res) => {
  try {
    const notices = await Notice.findAll({
      include: [
        {
          model: User,
          as: "writer",
          attributes: ["id", "name", "role"],
        },
        {
          model: Course,
          as: "course",
          attributes: ["name"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(notices);
  } catch (error) {
    console.error("GET /notice error:", error);
    res.status(500).json({ message: "서버 에러" });
  }
});

// ====================================================
// 2. 공지 작성 + 🔔 전체 학생 알림 발송 (수정됨)
// ====================================================
router.post(
  "/",
  authenticate,
  authorize("instructor", "admin"),
  async (req, res) => {
    try {
      const { title, content, courseId } = req.body;

      // 1) 필수값 검사
      if (!title || !content || !courseId) {
        return res
          .status(400)
          .json({ message: "제목, 내용, 강의 선택은 필수입니다." });
      }

      // 2) 강의 존재 확인
      const course = await Course.findByPk(courseId);
      if (!course) {
        return res.status(404).json({ message: "해당 강의를 찾을 수 없습니다." });
      }

      // 3) 공지 저장 (userId로 저장)
      const notice = await Notice.create({
        title,
        content,
        userId: req.user.id,
        courseId,
      });

      // ★ [추가] 감사 로그: 공지사항 등록 기록
      await AuditLog.create({
        actorId: req.user.id,
        entityType: 'Notice',
        action: 'NOTICE_CREATE',
        details: `강의 공지 등록: ${title}`,
        ipAddress: req.ip
      });

      // ---------------------------------------------------------
      // 4) 알림 발송 로직 (수정: 출석부 대신 모든 학생 조회)
      // ---------------------------------------------------------
      
      // 기존: Attendance 테이블 뒤지기 (출석 기록 없으면 알림 안 가는 문제 발생)
      // 수정: 그냥 'student' 역할을 가진 모든 유저에게 보냄 (투표랑 동일 방식)
      const students = await User.findAll({
        where: { role: 'student' },
        attributes: ['id']
      });

      const studentIds = students.map((user) => user.id);

      // 학생이 한 명이라도 있으면 알림 전송
      if (studentIds.length > 0) {
        const notiTitle = "📢 강의 공지 알림";
        const notiMessage = `[${course.name}] 새 공지: ${title}`;

        await Notification.bulkCreate(
          studentIds.map((id) => ({
            userId: id,
            type: "COURSE_NOTICE",
            title: notiTitle,
            message: notiMessage,
            courseId, // 해당 강의 ID 연결
            sessionId: null,
            isRead: false,
          }))
        );
      }

      return res
        .status(201)
        .json({ message: "공지 등록 및 학생 알림 전송 완료", data: notice });
        
    } catch (error) {
      console.error("POST /notice error:", error);
      res.status(500).json({ message: "서버 에러: " + error.message });
    }
  }
);

module.exports = router;