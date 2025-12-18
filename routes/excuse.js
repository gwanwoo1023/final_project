const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Notification 모델 및 AuditLog 추가
const { Excuse, User, Notification, AuditLog } = require('../models');
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// 업로드 폴더 생성
try {
  fs.readdirSync('uploads');
} catch (error) {
  console.error('uploads 폴더가 없어 생성합니다.');
  fs.mkdirSync('uploads');
}

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, done) {
      done(null, 'uploads/');
    },
    filename(req, file, done) {
      const ext = path.extname(file.originalname);
      done(
        null,
        path.basename(file.originalname, ext) + Date.now() + ext
      );
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// 1. 공결 신청 (학생만) + 교수님 알림 추가
router.post(
  '/',
  authenticate,
  authorize('student'),
  upload.single('file'),
  async (req, res) => {
    try {
      const newExcuse = await Excuse.create({
        reason: req.body.reason,
        fileUrl: req.file ? req.file.path : null,
        studentId: req.user.id,
        status: 'pending',
      });

      // ★ [추가] 감사 로그: 공결 신청 기록
      await AuditLog.create({
        actorId: req.user.id,
        entityType: 'Excuse',
        action: 'EXCUSE_REQUEST',
        details: `공결 신청함 (사유: ${req.body.reason})`,
        ipAddress: req.ip
      });

      // 교수님에게 공결 신청 알림 발송
      const instructors = await User.findAll({ where: { role: 'instructor' } });
      
      if (instructors.length > 0) {
        const notiData = instructors.map(ins => ({
          userId: ins.id, 
          type: 'info',
          title: '📩 새 공결 신청 알림',
          message: `[${req.user.name}] 학생이 새로운 공결 승인을 요청했습니다.`,
          isRead: false
        }));
        await Notification.bulkCreate(notiData);
      }

      res.status(201).json({ message: '공결 신청 완료', data: newExcuse });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '서버 에러' });
    }
  }
);

// 2. 내 공결 신청 내역 (학생 본인만)
router.get(
  '/',
  authenticate,
  authorize('student'),
  async (req, res) => {
    try {
      const myExcuses = await Excuse.findAll({
        where: { studentId: req.user.id },
        order: [['createdAt', 'DESC']],
      });

      res.status(200).json(myExcuses);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '서버 에러' });
    }
  }
);

// 3. 대기 중인 공결 목록 (교수/관리자)
router.get(
  '/pending',
  authenticate,
  authorize('instructor', 'admin'),
  async (req, res) => {
    try {
      const pendingExcuses = await Excuse.findAll({
        where: { status: 'pending' },
        include: {
          model: User,
          as: 'student',
          attributes: ['name', 'role'],
        },
        order: [['createdAt', 'ASC']],
      });

      res.json(pendingExcuses);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '서버 에러' });
    }
  }
);

// 4. 승인/반려 처리 (교수/관리자) + 학생에게 결과 알림 발송 추가
router.patch(
  '/:id',
  authenticate,
  authorize('instructor', 'admin'),
  async (req, res) => {
    try {
      const { status, adminComment } = req.body;

      // 먼저 해당 공결 신청 데이터를 찾습니다.
      const excuse = await Excuse.findByPk(req.params.id);
      if (!excuse) return res.status(404).json({ message: '신청 내역을 찾을 수 없습니다.' });

      // 상태와 코멘트 업데이트
      await excuse.update({
        status,
        adminComment,
      });

      // ★ [추가] 감사 로그: 승인/반려 처리 기록
      await AuditLog.create({
        actorId: req.user.id,
        targetUserId: excuse.studentId,
        entityType: 'Excuse',
        entityId: excuse.id,
        action: status === 'approved' ? 'EXCUSE_APPROVE' : 'EXCUSE_REJECT',
        details: `공결 ${status === 'approved' ? '승인' : '반려'} 처리함 ${adminComment ? '(의견: ' + adminComment + ')' : ''}`,
        ipAddress: req.ip
      });

      // ★ [추가] 학생에게 결과 알림 생성
      const resultTitle = status === 'approved' ? '✅ 공결 승인 완료' : '❌ 공결 반려 안내';
      const resultType = status === 'approved' ? 'success' : 'danger';

      await Notification.create({
        userId: excuse.studentId, // 신청한 학생에게 보냄
        type: resultType,
        title: resultTitle,
        message: `신청하신 공결이 ${status === 'approved' ? '승인' : '반려'}되었습니다. ${adminComment ? '(사유: ' + adminComment + ')' : ''}`,
        isRead: false
      });

      res.json({ message: '처리가 완료되었으며 학생에게 알림이 전송되었습니다.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '서버 에러' });
    }
  }
);

module.exports = router;