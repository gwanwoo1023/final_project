const { Enrollment, User, Course, Attendance, Session, ClassSession } = require('../models');
const { Op } = require('sequelize');

// 1. 현재 수강 중인 학생 목록 조회
exports.getStudents = async (req, res) => {
  try {
    const { courseId } = req.params;
    const list = await Enrollment.findAll({
      where: { courseId },
      include: [{ model: User, as: 'student', attributes: ['id', 'name', 'studentId', 'email'] }],
      order: [[{ model: User, as: 'student' }, 'name', 'ASC']]
    });
    // 보기 좋게 가공
    const students = list.map(item => item.student);
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '목록 조회 실패' });
  }
};

// 2. 수강생 추가 (학번으로 검색하여 등록) + 전 주차 출석 데이터(status: 0) 초기화
exports.addStudent = async (req, res) => {
  try {
    const { courseId, studentIdStr } = req.body; // studentIdStr는 학번(예: "20211234")

    // 1. 학생 찾기
    const student = await User.findOne({ where: { studentId: studentIdStr } });
    if (!student) {
      return res.status(404).json({ message: '해당 학번의 학생을 찾을 수 없습니다.' });
    }

    // 2. 이미 등록됐는지 확인
    const exists = await Enrollment.findOne({
      where: { courseId, studentId: student.id }
    });
    if (exists) {
      return res.status(400).json({ message: '이미 등록된 학생입니다.' });
    }

    // 3. 수강 등록 실행
    await Enrollment.create({
      courseId,
      studentId: student.id
    });

    // =========================================================
    // ★ [핵심 추가] 해당 학생의 전 주차 출석 데이터(status: 0) 생성 로직
    // =========================================================
    try {
      // 모델 이름이 Session 또는 ClassSession일 수 있으므로 유연하게 대응
      const TargetSessionModel = Session || ClassSession;
      
      // 해당 강의의 모든 세션(1~15주차) 가져오기
      const sessions = await TargetSessionModel.findAll({ 
        where: { courseId } 
      });

      if (sessions && sessions.length > 0) {
        const initialAttendance = sessions.map(s => ({
          sessionId: s.id,
          studentId: student.id,
          status: 0, // PDF 12번 요건: 미정(0) 코드로 기록
        }));

        // 출석 데이터 일괄 생성
        await Attendance.bulkCreate(initialAttendance, { ignoreDuplicates: true });
        console.log(`[성공] 학생 ID ${student.id}에 대해 ${sessions.length}개의 출석 데이터(status:0)가 생성되었습니다.`);
      }
    } catch (attendanceErr) {
      // 출석 데이터 생성 실패 시 등록은 취소되지 않도록 로그만 남김
      console.error("출석부 초기 데이터 생성 중 오류:", attendanceErr);
    }
    // =========================================================

    res.json({ message: `${student.name} 학생이 등록되었습니다.`, student });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '등록 실패' });
  }
};

// 3. 수강생 삭제 (수강취소)
exports.removeStudent = async (req, res) => {
  try {
    const { courseId, userId } = req.body; // userId는 User 테이블의 id (PK)
    
    await Enrollment.destroy({
      where: { courseId, studentId: userId }
    });

    // (참고) CASCADE 설정이 되어 있다면 관련 Attendance도 자동 삭제되나, 
    // 불안하다면 여기서 Attendance.destroy를 명시적으로 수행할 수도 있습니다.

    res.json({ message: '삭제되었습니다.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '삭제 실패' });
  }
};

// 4. 등록 가능한 전체 학생 목록 조회 (교수님 선택용)
exports.getAllCandidates = async (req, res) => {
  try {
    const students = await User.findAll({
      where: { role: 'student' },
      attributes: ['id', 'name', 'studentId', 'email'],
      order: [['name', 'ASC']]
    });
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '전체 학생 조회 실패' });
  }
};