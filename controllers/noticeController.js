// controllers/noticeController.js
const { Notice, User, Course, Notification, AuditLog, CourseStudent } = require("../models");

/** 공통 감사 로그 함수 */
async function writeLog(userId, action, details, ip) {
  try {
    await AuditLog.create({
      userId,
      action,
      details,
      ipAddress: ip,
    });
  } catch (err) {
    console.error("AuditLog 저장 오류:", err);
  }
}

module.exports = {
  /** 📌 공지 목록 조회 */
  async getNotices(req, res) {
    try {
      const notices = await Notice.findAll({
        include: [
          { model: User, as: "writer", attributes: ["id", "name"] },
          { model: Course, as: "course", attributes: ["id", "name"] },
        ],
        order: [["createdAt", "DESC"]],
      });

      // 조회도 감사 로그 남기고 싶다면
      if (req.session?.user) {
        await writeLog(
          req.session.user.id,
          "NOTICE_LIST",
          "공지 목록 조회",
          req.ip
        );
      }

      return res.json(notices);
    } catch (err) {
      console.error("getNotices error:", err);
      return res.status(500).json({ error: "서버 오류" });
    }
  },

  /** 📌 공지 생성 */
  async createNotice(req, res) {
    try {
      const user = req.session?.user;
      if (!user) {
        return res.status(401).json({ message: "로그인이 필요합니다." });
      }

      const { title, content, courseId } = req.body;

      if (!title || !content) {
        return res.status(400).json({ message: "제목과 내용을 입력해주세요." });
      }

      const notice = await Notice.create({
        writerId: user.id,
        title,
        content,
        courseId: courseId || null,
      });

      /** 🔔 알림: 강의 공지인 경우 → 수강생에게만 발송 */
      let studentIds = [];

      if (courseId) {
        const students = await CourseStudent.findAll({
          where: { courseId },
          attributes: ["studentId"],
        });
        studentIds = students.map((s) => s.studentId);
      } else {
        // 전체 공지 → 전체 student
        const students = await User.findAll({
          where: { role: "student" },
          attributes: ["id"],
        });
        studentIds = students.map((s) => s.id);
      }

      if (studentIds.length > 0) {
        const notifications = studentIds.map((sid) => ({
          userId: sid,
          type: "NOTICE",
          title: `[공지] ${title}`,
          message: content,
          courseId: courseId || null,
        }));

        await Notification.bulkCreate(notifications);
      }

      /** 📌 감사 로그 */
      await writeLog(
        user.id,
        "NOTICE_CREATE",
        `공지 생성 (#${notice.id}) title="${title}"`,
        req.ip
      );

      return res.status(201).json({
        message: "공지 등록 완료",
        notice,
      });
    } catch (err) {
      console.error("createNotice error:", err);
      return res.status(500).json({ error: "서버 오류" });
    }
  },

  /** 📌 공지 수정 */
  async updateNotice(req, res) {
    try {
      const user = req.session?.user;
      if (!user) return res.status(401).json({ message: "로그인이 필요합니다." });

      const { id } = req.params;
      const { title, content, courseId } = req.body;

      const notice = await Notice.findByPk(id);
      if (!notice) {
        return res.status(404).json({ message: "공지사항을 찾을 수 없습니다." });
      }

      const before = { ...notice.get() };

      if (title) notice.title = title;
      if (content) notice.content = content;
      if (courseId !== undefined) notice.courseId = courseId;

      await notice.save();

      /** 감사 로그 */
      await writeLog(
        user.id,
        "NOTICE_UPDATE",
        `공지 수정 (#${id}) → ${JSON.stringify({
          before,
          after: notice.get(),
        })}`,
        req.ip
      );

      return res.json({ message: "공지 수정 완료", notice });
    } catch (err) {
      console.error("updateNotice error:", err);
      return res.status(500).json({ error: "서버 오류" });
    }
  },

  /** 📌 공지 삭제 */
  async deleteNotice(req, res) {
    try {
      const user = req.session?.user;
      if (!user) return res.status(401).json({ message: "로그인이 필요합니다." });

      const { id } = req.params;

      const notice = await Notice.findByPk(id);
      if (!notice) {
        return res.status(404).json({ message: "공지사항을 찾을 수 없습니다." });
      }

      const deletedTitle = notice.title;

      await notice.destroy();

      /** 감사 로그 */
      await writeLog(
        user.id,
        "NOTICE_DELETE",
        `공지 삭제 (#${id}) title="${deletedTitle}"`,
        req.ip
      );

      return res.json({ message: "공지 삭제 완료" });
    } catch (err) {
      console.error("deleteNotice error:", err);
      return res.status(500).json({ error: "서버 오류" });
    }
  },
};
