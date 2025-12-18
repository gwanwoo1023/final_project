// controllers/departmentController.js
const { Department, Course } = require("../models");
const { logAudit } = require("../utils/auditlogger");  // ✅
 // ✅ 상대경로로 수정

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

// 모델에 해당 컬럼이 있을 때만 set (없으면 무시)
function safeSet(model, key, value) {
  if (value === undefined) return;
  if (!model || !model.rawAttributes) return;
  if (model.rawAttributes[key]) {
    model.setDataValue(key, value);
  }
}

const departmentController = {
  // ✅ 학과 목록 조회 (관리자)
  async listDepartments(req, res) {
    try {
      const admin = requireAdmin(req, res);
      if (!admin) return;

      const list = await Department.findAll({
        include: [
          {
            model: Course,
            as: "courses",
            attributes: ["id", "name"],
          },
        ],
        order: [["name", "ASC"]],
      });

      await logAudit(admin.id, "DEPARTMENT_LIST", null, {
        ip: req.ip,
      });

      return res.json(list);
    } catch (err) {
      console.error("listDepartments error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  // ✅ 학과 생성 (관리자)
  async createDepartment(req, res) {
    try {
      const admin = requireAdmin(req, res);
      if (!admin) return;

      const { name, code, description, isActive } = req.body || {};
      if (!name) {
        return res.status(400).json({ message: "name은 필수입니다." });
      }

      // 기본: name은 무조건 있음
      const dept = await Department.create({ name });

      // 옵션 컬럼들은 모델에 있을 때만 반영
      safeSet(Department, "code", code);
      safeSet(Department, "description", description);
      safeSet(Department, "isActive", isActive !== undefined ? !!isActive : undefined);

      // 위 safeSet은 Department(모델)에 적용되는 게 아니라 인스턴스에 적용해야 함
      // 따라서 인스턴스 dept에 다시 적용
      safeSet(dept.constructor, "code", code); // rawAttributes 체크용
      if (dept.rawAttributes?.code) dept.code = code ?? null;
      if (dept.rawAttributes?.description) dept.description = description ?? null;
      if (dept.rawAttributes?.isActive) dept.isActive = isActive !== undefined ? !!isActive : true;

      await dept.save();

      await logAudit(admin.id, "DEPARTMENT_CREATE", dept.id, {
        name,
        code: code ?? null,
        ip: req.ip,
      });

      return res.status(201).json({
        message: "학과가 생성되었습니다.",
        data: dept,
      });
    } catch (err) {
      console.error("createDepartment error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  // ✅ 학과 수정 (관리자)
  async updateDepartment(req, res) {
    try {
      const admin = requireAdmin(req, res);
      if (!admin) return;

      const { id } = req.params;
      const { name, code, description, isActive } = req.body || {};

      const dept = await Department.findByPk(id);
      if (!dept) {
        return res.status(404).json({ message: "학과를 찾을 수 없습니다." });
      }

      const before = dept.get({ plain: true });

      if (name !== undefined) dept.name = name;

      // 옵션 컬럼들은 존재할 때만 반영
      if (dept.rawAttributes?.code && code !== undefined) dept.code = code;
      if (dept.rawAttributes?.description && description !== undefined) dept.description = description;
      if (dept.rawAttributes?.isActive && isActive !== undefined) dept.isActive = !!isActive;

      await dept.save();

      await logAudit(admin.id, "DEPARTMENT_UPDATE", dept.id, {
        before,
        after: dept.get({ plain: true }),
        ip: req.ip,
      });

      return res.json({
        message: "학과 정보가 수정되었습니다.",
        data: dept,
      });
    } catch (err) {
      console.error("updateDepartment error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },

  // ✅ 학과 삭제 (관리자)
  async deleteDepartment(req, res) {
    try {
      const admin = requireAdmin(req, res);
      if (!admin) return;

      const { id } = req.params;

      const dept = await Department.findByPk(id, {
        include: [{ model: Course, as: "courses", attributes: ["id"] }],
      });

      if (!dept) {
        return res.status(404).json({ message: "학과를 찾을 수 없습니다." });
      }

      // 정책: 학과에 과목이 연결되어 있으면 삭제 금지
      if (dept.courses && dept.courses.length > 0) {
        return res.status(400).json({
          message: "이 학과에 연결된 과목이 있어 삭제할 수 없습니다.",
        });
      }

      const snapshot = dept.get({ plain: true });

      await dept.destroy();

      await logAudit(admin.id, "DEPARTMENT_DELETE", Number(id), {
        name: snapshot.name,
        code: snapshot.code ?? null,
        ip: req.ip,
      });

      return res.json({ message: "학과가 삭제되었습니다." });
    } catch (err) {
      console.error("deleteDepartment error:", err);
      return res.status(500).json({ error: "서버 에러" });
    }
  },
};

module.exports = departmentController;
