const express = require('express');
const router = express.Router();
const { AuditLog, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

// 관리자/교수용 로그 조회
router.get('/', authenticate, authorize('instructor', 'admin'), async (req, res) => {
    try {
        const logs = await AuditLog.findAll({
            include: [{ model: User, as: 'actor', attributes: ['name', 'email'] }],
            order: [['createdAt', 'DESC']],
            limit: 100 // 최근 100개만
        });
        res.json(logs);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: '로그 조회 실패' });
    }
});

module.exports = router;