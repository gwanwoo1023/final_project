// controllers/systemSettingController.js
const { SystemSetting } = require("../models");
const { logAudit } = require("../utils/auditLogger");

function requireAdmin(req, res) {
  const user = req.session?.user;
  if (!user) {
    res.status(401).json({ message: "로그인이 필요합니다." });
    return null;
  }
  if (user.role !== "admin") {
    res.status(403).json({ message: "관리자 권한이 필요합니다." });
    return null;
  }
  return user;
}

// 값 타입 정규화
function normalizeValue(type, value) {
  if (value === null || value === undefined) return null;

  if (type === "boolean") {
    if (value === true || value === "true" || value === 1 || value === "1") return "true";
    return "false";
  }
  if (type === "number") {
    const n = Number(value);
    if (Number.isNaN(n)) throw new Error("number 타입인데 숫자로 변환 불가");
    return String(n);
  }
  if (type === "json") {
    // 저장은 문자열, 유효성만 체크
    if (typeof value === "string") {
      JSON.parse(value);
      return value;
    }
    return JSON.stringify(value);
  }
  // string
  return String(value);
}

const systemSettingController = {
  // ✅ 설정 목록 조회 (관리자)
  async list(req, res) {
    try {
      const admin = requireAdmin(req, res);
      if (!admin) return;

      const rows = await SystemSetting.findAll({
        order: [["key", "ASC"]],
      });

      await logAudit(admin.id, "SYSTEM_SETTING_LIST", null, { ip: req.ip });

      return res.json(rows);
    } catch (err) {
      console.error("SystemSetting.list error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  // ✅ 단일 조회 (관리자) - key로
  async getByKey(req, res) {
    try {
      const admin = requireAdmin(req, res);
      if (!admin) return;

      const { key } = req.params;

      const row = await SystemSetting.findOne({ where: { key } });
      if (!row) return res.status(404).json({ message: "설정을 찾을 수 없습니다." });

      await logAudit(admin.id, "SYSTEM_SETTING_GET", row.id, { key, ip: req.ip });

      return res.json(row);
    } catch (err) {
      console.error("SystemSetting.getByKey error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  // ✅ 설정 생성 (관리자)
  async create(req, res) {
    try {
      const admin = requireAdmin(req, res);
      if (!admin) return;

      const { key, value, type, description, isActive } = req.body || {};
      if (!key) return res.status(400).json({ message: "key는 필수입니다." });

      const finalType = type || "string";
      const finalValue = normalizeValue(finalType, value);

      const created = await SystemSetting.create({
        key,
        value: finalValue,
        type: finalType,
        description: description || null,
        isActive: isActive !== undefined ? !!isActive : true,
        updatedBy: admin.id,
      });

      await logAudit(admin.id, "SYSTEM_SETTING_CREATE", created.id, {
        key,
        type: finalType,
        value: finalValue,
        ip: req.ip,
      });

      return res.status(201).json({ message: "설정이 생성되었습니다.", data: created });
    } catch (err) {
      console.error("SystemSetting.create error:", err);
      return res.status(400).json({ error: err.message || "생성 실패" });
    }
  },

  // ✅ 설정 수정 (관리자)
  async update(req, res) {
    try {
      const admin = requireAdmin(req, res);
      if (!admin) return;

      const { id } = req.params;
      const { value, type, description, isActive } = req.body || {};

      const row = await SystemSetting.findByPk(id);
      if (!row) return res.status(404).json({ message: "설정을 찾을 수 없습니다." });

      const before = row.get({ plain: true });

      if (type !== undefined) row.type = type;
      if (description !== undefined) row.description = description;
      if (isActive !== undefined) row.isActive = !!isActive;

      // value는 type 결정 후 정규화
      if (value !== undefined) {
        const finalType = row.type || "string";
        row.value = normalizeValue(finalType, value);
      }

      row.updatedBy = admin.id;
      await row.save();

      await logAudit(admin.id, "SYSTEM_SETTING_UPDATE", row.id, {
        before,
        after: row.get({ plain: true }),
        ip: req.ip,
      });

      return res.json({ message: "설정이 수정되었습니다.", data: row });
    } catch (err) {
      console.error("SystemSetting.update error:", err);
      return res.status(400).json({ error: err.message || "수정 실패" });
    }
  },

  // ✅ 설정 삭제 (관리자)
  async remove(req, res) {
    try {
      const admin = requireAdmin(req, res);
      if (!admin) return;

      const { id } = req.params;

      const row = await SystemSetting.findByPk(id);
      if (!row) return res.status(404).json({ message: "설정을 찾을 수 없습니다." });

      const snapshot = row.get({ plain: true });
      await row.destroy();

      await logAudit(admin.id, "SYSTEM_SETTING_DELETE", Number(id), {
        key: snapshot.key,
        ip: req.ip,
      });

      return res.json({ message: "설정이 삭제되었습니다." });
    } catch (err) {
      console.error("SystemSetting.remove error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },
};

module.exports = systemSettingController;
