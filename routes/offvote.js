// routes/offvote.js
const express = require('express');
const router = express.Router();
// ★ Notification, User 모델 추가 (알림 발송을 위해 필수)
const { Offvote, OffvoteOption, OffvoteVote, User, Course, Notification } = require('../models');
const { authenticate, authorize } = require("../middleware/auth");

// 1. 투표 목록 조회
router.get('/', authenticate, async (req, res) => {
    try {
        const votes = await Offvote.findAll({
            include: [
                { model: Course, as: 'course', attributes: ['name'] },
                { model: OffvoteOption, as: 'options' }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json(votes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '불러오기 실패' });
    }
});

// 2. 투표 생성 (+알림 발송 기능 복구 완료)
router.post('/', authenticate, authorize('instructor', 'admin'), async (req, res) => {
    try {
        const { title, description, courseId, options } = req.body;
        
        if (!title || !options || options.length < 1) {
            return res.status(400).json({ message: '제목과 최소 1개의 선택지가 필요합니다.' });
        }

        // 1. 투표 주제 생성
        const newVote = await Offvote.create({
            title,
            description,
            courseId: courseId || null,
            isOpen: true
        });

        // 2. 선택지 저장 (DB 컬럼: count)
        const optionData = options.map(text => ({
            offvoteId: newVote.id,
            text,
            count: 0 // ★ 모델/마이그레이션에 맞춰 count로 저장
        }));
        await OffvoteOption.bulkCreate(optionData);

        // 3. ★ [기능 복구] 모든 학생에게 알림 보내기
        const students = await User.findAll({ where: { role: 'student' } });
        
        if (students.length > 0) {
            const notifications = students.map(student => ({
                userId: student.id, // ★ DB 컬럼 userId
                type: 'offvote',
                title: '📊 새로운 투표 알림',
                message: `새로운 투표가 올라왔습니다: ${title}`,
                courseId: courseId || null,
                isRead: false
            }));
            await Notification.bulkCreate(notifications);
        }

        res.status(201).json({ message: '투표 생성 및 알림 전송 완료' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '생성 실패' });
    }
});

// 3. 투표하기 (학생)
router.post('/:id/vote', authenticate, authorize('student'), async (req, res) => {
    try {
        const offvoteId = req.params.id;
        const { optionId } = req.body;
        const userId = req.user.id; // ★ DB 컬럼 userId (기존 studentId -> userId로 통일)

        const vote = await Offvote.findByPk(offvoteId);
        if (!vote || !vote.isOpen) return res.status(400).json({ message: '마감된 투표입니다.' });

        // 중복 투표 방지
        const existing = await OffvoteVote.findOne({ where: { offvoteId, userId } });
        if (existing) return res.status(400).json({ message: '이미 참여했습니다.' });

        // 투표 기록 생성
        await OffvoteVote.create({ offvoteId, optionId, userId });
        
        // 카운트 증가 (DB 컬럼: count)
        await OffvoteOption.increment('count', { where: { id: optionId } });

        res.json({ message: '투표 완료' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '에러 발생' });
    }
});

// 4. 투표 종료
router.patch('/:id/close', authenticate, authorize('instructor', 'admin'), async (req, res) => {
    try {
        await Offvote.update({ isOpen: false }, { where: { id: req.params.id } });
        res.json({ message: '투표가 종료되었습니다.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '에러 발생' });
    }
});

// 5. 결과 조회
router.get('/:id/result', authenticate, async (req, res) => {
    try {
        // 옵션과 현재 카운트 조회
        const vote = await Offvote.findByPk(req.params.id, {
            include: [{ model: OffvoteOption, as: 'options' }]
        });
        res.json(vote); // 전체 정보를 넘겨줌 (프론트에서 options 배열 사용)
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '에러 발생' });
    }
});

module.exports = router;