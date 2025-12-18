// routes/admin.js
const express = require("express");
const router = express.Router();

const { authenticate, authorize } = require("../middleware/auth");
const auditLogController = require("../controllers/auditLogController");
const departmentController = require("../adminDepartmentController");

// 🔐 모든 admin 라우트는 관리자만
// 감사 로그 조회
router.get(
  "/audit-logs",
  authenticate,
  authorize("admin"),
  auditLogController.getAuditLogs
);

// ✅ 학과 목록
router.get(
  "/departments",
  authenticate,
  authorize("admin"),
  departmentController.listDepartments
);

// ✅ 학과 생성
router.post(
  "/departments",
  authenticate,
  authorize("admin"),
  departmentController.createDepartment
);

// ✅ 학과 수정
router.put(
  "/departments/:id",
  authenticate,
  authorize("admin"),
  departmentController.updateDepartment
);

// ✅ 학과 삭제
router.delete(
  "/departments/:id",
  authenticate,
  authorize("admin"),
  departmentController.deleteDepartment
);

module.exports = router;
