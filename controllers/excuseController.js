const { Excuse, User, Notification } = require("../models");
const auditLogController = require("../controllers/auditLogController");

const excuseController = {};

/**
 * 학생 공결 신청 생성 (파일 업로드 포함 로직 유지)
 */
excuseController.createExcuse = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "로그인이 필요합니다." });

    const { reason } = req.body;
    const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!reason) {
      return res.status(400).json({ message: "사유는 필수입니다." });
    }

    const excuse = await Excuse.create({
      studentId: user.id,
      reason,
      fileUrl,
      status: "pending",
    });

    // 🔎 감사 로그 기록
    await auditLogController.createLog(user.id, "EXCUSE_CREATED", excuse.id, {
      reason,
      fileUrl,
    });

    return res.status(201).json({ message: "공결 신청이 접수되었습니다.", data: excuse });
  } catch (err) {
    console.error("createExcuse error:", err);
    return res.status(500).json({ error: "서버 에러" });
  }
};

/**
 * 학생 자신의 공결 신청 목록 조회
 */
excuseController.getMyExcuse = async (req, res) => {
  try {
    const studentId = req.user?.id;
    const excuses = await Excuse.findAll({
      where: { studentId },
      order: [["createdAt", "DESC"]],
    });
    return res.json(excuses);
  } catch (err) {
    console.error("getMyExcuse error:", err);
    return res.status(500).json({ error: "서버 에러" });
  }
};

/**
 * 교수/관리자 — 대기중 공결 목록 조회
 */
excuseController.getPendingExcuses = async (req, res) => {
  try {
    const list = await Excuse.findAll({
      where: { status: "pending" },
      include: [
        {
          model: User,
          as: "student",
          attributes: ["id", "name", "studentId"],
        },
      ],
      order: [["createdAt", "ASC"]],
    });
    return res.json(list);
  } catch (err) {
    console.error("getPendingExcuses error:", err);
    return res.status(500).json({ error: "서버 에러" });
  }
};

/**
 * 교수/관리자 — 공결 승인/반려 처리 (알림 + 로그 로직 유지)
 */
excuseController.updateExcuseStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminComment } = req.body;

    const excuse = await Excuse.findByPk(id);
    if (!excuse) return res.status(404).json({ message: "공결 신청을 찾을 수 없습니다." });

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "status는 approved 또는 rejected만 가능합니다." });
    }

    excuse.status = status;
    excuse.adminComment = adminComment || null;
    await excuse.save();

    // 🔔 학생에게 알림
    await Notification.create({
      userId: excuse.studentId,
      type: "EXCUSE_RESULT",
      title: "공결 신청 결과",
      message: status === "approved" ? "공결 신청이 승인되었습니다." : "공결 신청이 반려되었습니다.",
    });

    // 🔎 감사 로그 기록
    await auditLogController.createLog(
      req.user.id,
      "EXCUSE_STATUS_UPDATE",
      excuse.id,
      { newStatus: status, adminComment }
    );

    return res.json({ message: "공결 상태가 변경되었습니다.", data: excuse });
  } catch (err) {
    console.error("updateExcuseStatus error:", err);
    return res.status(500).json({ error: "서버 에러" });
  }
};

module.exports = excuseController;