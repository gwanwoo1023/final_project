const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/enrollmentController');

// 수강생 목록
router.get('/:courseId', ctrl.getStudents);

// ★ [추가됨] 전체 학생 후보 목록 (등록용)
router.get('/list/candidates', ctrl.getAllCandidates);

// 수강생 추가
router.post('/add', ctrl.addStudent);
// 수강생 삭제
router.post('/remove', ctrl.removeStudent);

module.exports = router;