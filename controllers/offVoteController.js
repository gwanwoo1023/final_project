// controllers/offvoteController.js
const db = require("../models");
const {
  Offvote,
  OffvoteOption,
  OffvoteVote,
  Course,
  User,
  Notification,
  AuditLog,
} = db;

const CourseStudent = db.CourseStudent;

// =============================
// 공용: 알림 보내기 헬퍼
// =============================
async function notifyStudentsForCourse(courseId, { type, title, message, offvoteId }) {
  try {
    let studentIds = [];

    if (courseId && CourseStudent) {
      const enrolls = await CourseStudent.findAll({
        where: { courseId },
      });
      studentIds = enrolls.map((e) => e.studentId);
    } else {
      const students = await User.findAll({
        where: { role: "student" },
        attributes: ["id"],
      });
      studentIds = students.map((s) => s.id);
    }

    if (!studentIds.length) return;

    const notifications = studentIds.map((sid) => ({
      userId: sid,
      type,
      title,
      message,
      courseId: courseId || null,
      sessionId: null,
      offvoteId: offvoteId || null,
    }));

    await Notification.bulkCreate(notifications);
  } catch (err) {
    console.error("notifyStudentsForCourse error:", err);
  }
}

const offvoteController = {
  // 📊 1) 투표 목록 조회
  async listVotes(req, res) {
    try {
      const votes = await Offvote.findAll({
        include: [
          { model: Course, as: "course", attributes: ["id", "name"] },
          { model: OffvoteOption, as: "options", attributes: ["id", "text"] },
        ],
        order: [["createdAt", "DESC"]],
      });

      return res.json(votes);
    } catch (err) {
      console.error("listVotes error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  // 📊 2) 투표 생성 (교수)
  async createVote(req, res) {
    try {
      const actorId = req.user?.id; // 감사 로그용
      const { title, description, courseId, options } = req.body || {};

      if (!title) {
        return res.status(400).json({ message: "title은 필수입니다." });
      }

      if (!Array.isArray(options) || options.length === 0) {
        return res
          .status(400)
          .json({ message: "options는 한 개 이상의 문자열 배열이어야 합니다." });
      }

      let course = null;
      if (courseId) {
        course = await Course.findByPk(courseId);
        if (!course) {
          return res.status(404).json({ message: "해당 강의를 찾을 수 없습니다." });
        }
      }

      const offvote = await Offvote.create({
        title,
        description: description || null,
        courseId: courseId || null,
        isClosed: false,
      });

      const optionRows = options.map((text) => ({
        offvoteId: offvote.id,
        text,
      }));

      await OffvoteOption.bulkCreate(optionRows);

      // 📣 알림 전송
      await notifyStudentsForCourse(courseId || null, {
        type: "OFFVOTE_CREATED",
        title: "공강(휴강) 투표가 생성되었습니다.",
        message: `투표 제목: ${title}`,
        offvoteId: offvote.id,
      });

      // 📌 감사 로그
      await AuditLog.create({
        userId: actorId,
        action: "OFFVOTE_CREATED",
        targetId: offvote.id,
        details: `공강 투표 생성: ${title}`,
      });

      const full = await Offvote.findByPk(offvote.id, {
        include: [
          { model: Course, as: "course", attributes: ["id", "name"] },
          { model: OffvoteOption, as: "options", attributes: ["id", "text"] },
        ],
      });

      return res.status(201).json({
        message: "공강 투표 생성 완료",
        data: full,
      });
    } catch (err) {
      console.error("createVote error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  // 🗳 3) 학생 투표
  async vote(req, res) {
    try {
      const offvoteId = req.params.id;
      const actorId = req.user?.id;
      const { optionId } = req.body || {};

      if (!optionId) {
        return res.status(400).json({ message: "optionId는 필수입니다." });
      }

      const offvote = await Offvote.findByPk(offvoteId, {
        include: [{ model: OffvoteOption, as: "options", attributes: ["id"] }],
      });

      if (!offvote) {
        return res.status(404).json({ message: "해당 투표를 찾을 수 없습니다." });
      }

      if (offvote.isClosed) {
        return res.status(400).json({ message: "이미 종료된 투표입니다." });
      }

      const validOption = offvote.options.find((o) => o.id === optionId);
      if (!validOption) {
        return res
          .status(400)
          .json({ message: "해당 optionId는 이 투표의 선택지가 아닙니다." });
      }

      const existed = await OffvoteVote.findOne({
        where: { offvoteId, userId: actorId },
      });
      if (existed) {
        return res.status(400).json({ message: "이미 이 투표에 참여했습니다." });
      }

      await OffvoteVote.create({
        offvoteId,
        optionId,
        userId: actorId,
      });

      // 📌 감사 로그
      await AuditLog.create({
        userId: actorId,
        action: "OFFVOTE_VOTED",
        targetId: offvoteId,
        details: `선택한 옵션: ${optionId}`,
      });

      return res.json({ message: "투표 완료" });
    } catch (err) {
      console.error("vote error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  // 🔴 4) 투표 종료
  async closeVote(req, res) {
    try {
      const actorId = req.user?.id;
      const { id } = req.params;

      const offvote = await Offvote.findByPk(id);
      if (!offvote) {
        return res.status(404).json({ message: "해당 투표를 찾을 수 없습니다." });
      }

      if (offvote.isClosed) {
        return res.status(400).json({ message: "이미 종료된 투표입니다." });
      }

      offvote.isClosed = true;
      await offvote.save();

      await notifyStudentsForCourse(offvote.courseId || null, {
        type: "OFFVOTE_CLOSED",
        title: "공강(휴강) 투표가 종료되었습니다.",
        message: `투표 제목: ${offvote.title} (결과를 확인하세요)`,
        offvoteId: offvote.id,
      });

      // 📌 감사 로그
      await AuditLog.create({
        userId: actorId,
        action: "OFFVOTE_CLOSED",
        targetId: id,
        details: `투표 종료됨`,
      });

      return res.json({
        message: "투표가 종료되었습니다.",
        data: offvote,
      });
    } catch (err) {
      console.error("closeVote error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  // 📈 5) 투표 결과 조회
  async getResult(req, res) {
    try {
      const { id } = req.params;

      const offvote = await Offvote.findByPk(id, {
        include: [
          { model: OffvoteOption, as: "options", attributes: ["id", "text"] },
        ],
      });

      if (!offvote) {
        return res.status(404).json({ message: "해당 투표를 찾을 수 없습니다." });
      }

      const votes = await OffvoteVote.findAll({
        where: { offvoteId: id },
        attributes: ["optionId"],
      });

      const result = offvote.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        voteCount: votes.filter((v) => v.optionId === opt.id).length,
      }));

      return res.json({
        id: offvote.id,
        title: offvote.title,
        isClosed: offvote.isClosed,
        options: result,
      });
    } catch (err) {
      console.error("getResult error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },
};

module.exports = offvoteController;
