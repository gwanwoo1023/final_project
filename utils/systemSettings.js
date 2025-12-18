// utils/systemSettings.js
const { SystemSetting } = require("../models");

/**
 * 기본값(폴백)
 * - DB에 값이 없거나, DB에 접근 실패 시 이 값으로 동작
 */
const DEFAULTS = {
  ATTENDANCE_OPEN_MINUTES: 10,
  ABSENT_WARN_COUNT: 2,
  ABSENT_DANGER_COUNT: 3,
  OFFVOTE_ENABLED: true,
  EXCUSE_REQUIRE_FILE: true,
  NOTIFICATION_ENABLED: true,
  AUDIT_LOG_ENABLED: true,
  SESSION_TIMEOUT_MINUTES: 60,
  SEMESTER_START_DATE: "2025-03-01",
  SEMESTER_END_DATE: "2025-06-30",
  SYSTEM_MAINTENANCE: false,
};

function toBool(v) {
  if (typeof v === "boolean") return v;
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

function toInt(v, fallback = 0) {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * key로 설정 가져오기 (raw string)
 */
async function getSettingRaw(key) {
  const row = await SystemSetting.findOne({ where: { key } });
  return row ? row.value : null;
}

/**
 * key로 설정 가져오기 (타입 추론)
 * - boolean / number / string(날짜 포함)
 */
async function getSetting(key) {
  const raw = await getSettingRaw(key);
  if (raw === null) return DEFAULTS[key];

  // boolean
  if (key.endsWith("_ENABLED") || key.startsWith("SYSTEM_") || key === "EXCUSE_REQUIRE_FILE") {
    return toBool(raw);
  }

  // int minutes / count
  if (
    key.endsWith("_MINUTES") ||
    key.endsWith("_COUNT")
  ) {
    return toInt(raw, DEFAULTS[key] ?? 0);
  }

  // date / string
  return raw;
}

/**
 * 설정 저장(upsert)
 * - value는 저장 시 string으로 저장
 */
async function setSetting(key, value, description = null) {
  const strValue = value === null || value === undefined ? "" : String(value);

  const [row] = await SystemSetting.findOrCreate({
    where: { key },
    defaults: {
      key,
      value: strValue,
      description: description || null,
    },
  });

  if (row.value !== strValue || (description !== null && row.description !== description)) {
    row.value = strValue;
    if (description !== null) row.description = description;
    await row.save();
  }

  return row;
}

/**
 * 점검모드면 true
 */
async function isMaintenance() {
  return await getSetting("SYSTEM_MAINTENANCE");
}

/**
 * 학기 범위 안인지 (오늘 기준)
 */
async function isInSemester(date = new Date()) {
  const start = await getSetting("SEMESTER_START_DATE");
  const end = await getSetting("SEMESTER_END_DATE");
  const d = new Date(date);

  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T23:59:59`);
  return d >= s && d <= e;
}

module.exports = {
  DEFAULTS,
  getSettingRaw,
  getSetting,
  setSetting,
  isMaintenance,
  isInSemester,
};
