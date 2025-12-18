const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/messageController');
const { AuditLog } = require('../models'); // AuditLog 추가
const { authenticate } = require('../middleware/auth');

router.get('/targets', authenticate, ctrl.getTargets);
router.get('/list', authenticate, ctrl.getMessages);

// 메시지 전송 + 감사 로그 추가
router.post('/send', authenticate, async (req, res, next) => {
    // 1. 실제 메시지 전송 컨트롤러 실행
    // 컨트롤러가 응답을 마무리하기 전에 로그를 남기기 위해 미들웨어 형태로 구성 가능합니다.
    // 여기서는 컨트롤러 실행 전후에 로그를 남기도록 래핑합니다.
    try {
        await ctrl.sendMessage(req, res); // 컨트롤러 호출

        // 2. 성공적으로 전송된 경우 (응답이 200번대라면) 감사 로그 생성
        if (res.statusCode >= 200 && res.statusCode < 300) {
            await AuditLog.create({
                actorId: req.user.id,
                targetUserId: req.body.receiverId || null,
                entityType: 'Message',
                action: 'MESSAGE_SEND',
                details: `메시지 발송함 (내용: ${req.body.content ? req.body.content.substring(0, 20) + '...' : ''})`,
                ipAddress: req.ip
            });
        }
    } catch (e) {
        next(e);
    }
});

module.exports = router;