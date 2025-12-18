const { Message, User, Course, Attendance, Notification, Enrollment } = require('../models');
const { Op } = require('sequelize');

// 1. 대화 상대 목록 가져오기 (강의 기준)
exports.getTargets = async (req, res) => {
  try {
    const { courseId } = req.query;
    const myId = req.session.user.id;
    const myRole = req.session.user.role;

    if (!courseId) return res.json([]);

    let targets = [];

    if (myRole === 'student') {
      // 학생 -> 해당 강의의 교수님 찾기
      const course = await Course.findByPk(courseId, {
        // ★ [수정됨] attributes에 'role'을 추가해서 교수님인지 알 수 있게 함!
        include: [{ model: User, as: 'instructor', attributes: ['id', 'name', 'email', 'role'] }]
      });
      if (course && course.instructor) {
        targets.push(course.instructor);
      }
    } else if (myRole === 'instructor' || myRole === 'admin') {
      // 교수 -> 해당 강의 학생들 찾기
      
      // 1순위: Enrollment(수강신청) 테이블 조회
      try {
        if (Enrollment) {
          const students = await Enrollment.findAll({
            where: { courseId },
            include: [{ model: User, as: 'student', attributes: ['id', 'name', 'studentId', 'role'] }]
          });
          targets = students.map(s => s.student);
        }
      } catch (e) {
        // 2순위: Enrollment 없으면 Attendance(출석부) 조회
        const records = await Attendance.findAll({
          include: [
            { 
              model: require('../models').Session, 
              as: 'session', 
              where: { courseId }, 
              attributes: [] 
            },
            { model: User, as: 'student', attributes: ['id', 'name', 'studentId', 'role'] }
          ],
          group: ['studentId'] 
        });
        targets = records.map(r => r.student);
      }
    }

    // 중복 제거
    const uniqueTargets = Array.from(new Map(targets.map(item => [item['id'], item])).values());
    
    res.json(uniqueTargets);
  } catch (err) {
    console.error("대화 상대 조회 에러:", err);
    res.json([]);
  }
};

// 2. 대화 내용 가져오기
exports.getMessages = async (req, res) => {
  try {
    const myId = req.session.user.id;
    const { targetId, courseId } = req.query;

    const messages = await Message.findAll({
      where: {
        courseId,
        [Op.or]: [
          { senderId: myId, receiverId: targetId },
          { senderId: targetId, receiverId: myId }
        ]
      },
      order: [['createdAt', 'ASC']],
      include: [{ model: User, as: 'sender', attributes: ['id', 'name'] }]
    });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '대화 불러오기 실패' });
  }
};

// 3. 메시지 전송 (+ 알림 추가)
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, courseId, content } = req.body;
    const senderId = req.session.user.id;

    // 1. 메시지 저장
    await Message.create({
      senderId,
      receiverId,
      courseId,
      content
    });

    // ★★★ [추가됨] 2. 받는 사람에게 알림(Notification) 보내기
    try {
      // 보낸 사람 이름 찾기 (알림 메시지용)
      const sender = await User.findByPk(senderId);
      const senderName = sender ? sender.name : '알 수 없음';

      await Notification.create({
        userId: receiverId,        // 받는 사람
        type: 'MESSAGE',           // 알림 타입
        title: '💬 새 메시지',      // 알림 제목
        message: `${senderName}: ${content.length > 20 ? content.slice(0, 20) + '...' : content}`, // 내용 요약
        courseId: courseId || null,
        isRead: false
      });
    } catch (notiErr) {
      console.error('알림 생성 실패 (메시지는 전송됨):', notiErr);
      // 알림 실패해도 메시지 전송은 성공으로 처리
    }

    res.json({ message: '전송 완료' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '전송 실패' });
  }
};