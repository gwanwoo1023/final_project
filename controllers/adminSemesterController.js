// controllers/adminSemesterController.js
const { Semester, AuditLog } = require("../models");

async function writeLog(req, action, details, targetId = null) {
  try {
    await AuditLog.create({
      userId: req.session?.user?.id || null,
      action,
      targetId,
      details: typeof details === "string" ? details : JSON.stringify(details),
      ipAddress: req.ip,
    });
  } catch (e) {
    console.error("AuditLog error:", e);
  }
}

module.exports = {
  async list(req, res) {
    try {
      const rows = await Semester.findAll({ order: [["year", "DESC"], ["term", "DESC"]] });
      await writeLog(req, "SEMESTER_LIST", "학기 목록 조회");
      return res.json(rows);
    } catch (err) {
      console.error("semester list error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  async create(req, res) {
    try {
      const { year, term, name, startDate, endDate, isActive } = req.body || {};
      if (!year || !term || !name) {
        return res.status(400).json({ message: "year, term, name은 필수입니다." });
      }

      const created = await Semester.create({
        year,
        term,
        name,
        startDate: startDate || null,
        endDate: endDate || null,
        isActive: !!isActive,
      });

      await writeLog(req, "SEMESTER_CREATE", { year, term, name }, created.id);
      return res.status(201).json({ message: "학기 생성 완료", data: created });
    } catch (err) {
      console.error("semester create error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { year, term, name, startDate, endDate, isActive } = req.body || {};

      const row = await Semester.findByPk(id);
      if (!row) return res.status(404).json({ message: "학기를 찾을 수 없습니다." });

      const before = row.get();

      if (year !== undefined) row.year = year;
      if (term !== undefined) row.term = term;
      if (name !== undefined) row.name = name;
      if (startDate !== undefined) row.startDate = startDate;
      if (endDate !== undefined) row.endDate = endDate;
      if (isActive !== undefined) row.isActive = !!isActive;

      await row.save();

      await writeLog(req, "SEMESTER_UPDATE", { before, after: row.get() }, row.id);
      return res.json({ message: "학기 수정 완료", data: row });
    } catch (err) {
      console.error("semester update error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  async remove(req, res) {
    try {
      const { id } = req.params;

      const row = await Semester.findByPk(id);
      if (!row) return res.status(404).json({ message: "학기를 찾을 수 없습니다." });

      await row.destroy();
      await writeLog(req, "SEMESTER_DELETE", `학기 삭제: ${row.name}`, Number(id));

      return res.json({ message: "학기 삭제 완료" });
    } catch (err) {
      console.error("semester delete error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },
};
