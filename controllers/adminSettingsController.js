const { SystemSetting, AuditLog } = require("../models");
const { DEFAULTS } = require("../utils/systemSettings");

async function writeLog(req, action, targetId, details) {
  try {
    const enabled = true; // 여기서도 systemSettings로 끌어올 수 있음
    if (!enabled) return;

    await AuditLog.create({
      userId: req.session?.user?.id || null,
      action,
      targetId,
      details: JSON.stringify(details || {}),
      ipAddress: req.ip,
    });
  } catch (e) {
    console.error("writeLog error:", e);
  }
}

exports.list = async (req, res) => {
  const rows = await SystemSetting.findAll({ order: [["key", "ASC"]] });
  await writeLog(req, "SYSTEM_SETTING_LIST", null, { count: rows.length });
  return res.json({ defaults: DEFAULTS, data: rows });
};

exports.getOne = async (req, res) => {
  const { key } = req.params;
  const row = await SystemSetting.findOne({ where: { key } });
  await writeLog(req, "SYSTEM_SETTING_GET", null, { key });
  return res.json({
    key,
    value: row?.value ?? null,
    description: row?.description ?? null,
    defaultValue: DEFAULTS[key],
  });
};

exports.upsert = async (req, res) => {
  const { key } = req.params;
  const { value, description } = req.body || {};

  if (value === undefined) {
    return res.status(400).json({ message: "value는 필수입니다." });
  }

  const before = await SystemSetting.findOne({ where: { key } });

  const [row] = await SystemSetting.findOrCreate({
    where: { key },
    defaults: { key, value: String(value), description: description ?? null },
  });

  row.value = String(value);
  if (description !== undefined) row.description = description;
  await row.save();

  await writeLog(req, "SYSTEM_SETTING_UPSERT", null, {
    key,
    before: before ? { value: before.value, description: before.description } : null,
    after: { value: row.value, description: row.description },
  });

  return res.json({ message: "설정이 저장되었습니다.", data: row });
};

exports.remove = async (req, res) => {
  const { key } = req.params;
  const row = await SystemSetting.findOne({ where: { key } });
  if (!row) return res.status(404).json({ message: "설정을 찾을 수 없습니다." });

  await row.destroy();
  await writeLog(req, "SYSTEM_SETTING_DELETE", null, { key });

  return res.json({ message: "설정이 삭제되었습니다." });
};
