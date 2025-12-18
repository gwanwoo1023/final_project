// controllers/courseController.js
// ✅ Enrollment(필터링용), Holiday(공휴일체크용) 모델 추가
const { Course, User, AuditLog, Department, Semester, Session, Enrollment, Holiday } = require("../models");

/** 감사 로그 기록 공통 함수 */
async function writeLog(actorId, action, details, ip) {
  try {
    await AuditLog.create({
      actorId: actorId,       
      action,
      entityType: "Course",   
      details,
      ipAddress: ip || null,
    });
  } catch (err) {
    console.error("AuditLog 기록 실패:", err);
  }
}

module.exports = {
  /** 전체 강의 조회 (권한별 필터링 적용 - 기존 기능 유지) */
  async getCourses(req, res) {
    try {
      const user = req.session.user; // 로그인한 사용자 정보
      let whereClause = {};

      // 1. 교수님(Instructor): 본인이 담당하는 강의만
      if (user.role === 'instructor') {
        whereClause = { instructorId: user.id };
      } 
      // 2. 학생(Student): 본인이 수강 신청한 강의만
      else if (user.role === 'student') {
        try {
          const myEnrollments = await Enrollment.findAll({
            where: { studentId: user.id },
            attributes: ['courseId']
          });
          const courseIds = myEnrollments.map(e => e.courseId);
          whereClause = { id: courseIds };
        } catch (e) {
          whereClause = { id: [] }; 
        }
      }
      // 3. 관리자(Admin): 모든 강의

      const courses = await Course.findAll({
        where: whereClause,
        include: [
          { model: User, as: "instructor", attributes: ["id", "name"] },
          { model: Department, as: "department", attributes: ["id", "name"] },
          { model: Semester, as: "semester", attributes: ["id", "name"] }
        ],
        order: [["createdAt", "DESC"]],
      });

      if (req.session.user) {
        await writeLog(req.session.user.id, "COURSE_LIST", "강의 목록 조회", req.ip);
      }

      return res.json(courses);
    } catch (err) {
      console.error("getCourses error:", err);
      return res.status(500).json({ error: "서버 오류" });
    }
  },

  /** 특정 강의 조회 (기능 유지) */
  async getCourse(req, res) {
    try {
      const { id } = req.params;
      const course = await Course.findByPk(id, {
        include: [
          { model: User, as: "instructor", attributes: ["id", "name"] },
          { model: Department, as: "department", attributes: ["id", "name"] },
          { model: Semester, as: "semester", attributes: ["id", "name"] }
        ],
      });

      if (!course) {
        return res.status(404).json({ message: "강의를 찾을 수 없습니다." });
      }

      await writeLog(req.session.user?.id || null, "COURSE_READ", `강의 조회: ${course.name}`, req.ip);
      return res.json(course);
    } catch (err) {
      console.error("getCourse error:", err);
      return res.status(500).json({ error: "서버 오류" });
    }
  },

  /** ★★★ 강의 생성 (스마트 스케줄러: 공휴일 체크 및 보강 자동 생성) ★★★ */
  async createCourse(req, res) {
    try {
      // 프론트엔드에서 dayOfWeek(요일 0:일 ~ 6:토), startDate(개강일)도 받는다고 가정
      // 기본값: 월요일(1), 2025-09-01
      const { name, departmentId, semesterId, dayOfWeek = 1, startDate = '2025-09-01' } = req.body;
      const instructorId = req.session.user.id;

      if (!name) {
        return res.status(400).json({ message: "강의명을 입력해주세요." });
      }

      // 1. 강의 생성
      const course = await Course.create({
        name,
        instructorId,
        departmentId: departmentId || null,
        semesterId: semesterId || null,
      });

      // 2. 공휴일 목록 미리 로딩 (DB에 있는 것들)
      // (DB에 Holiday 데이터가 없으면 그냥 빈 배열로 처리됨)
      let holidayMap = {};
      try {
        const holidays = await Holiday.findAll();
        holidays.forEach(h => { holidayMap[h.date] = h.name; });
      } catch (e) {
        console.log("Holiday 테이블이 없거나 비어있음. 공휴일 체크 패스.");
      }

      // 3. 날짜 계산 로직
      const sessions = [];
      const makeupQueue = []; // 보강해야 할 수업들 (16주차 이후로 밀림)
      
      let currentDate = new Date(startDate);
      // 시작일이 해당 요일이 아니면, 가장 가까운 해당 요일까지 날짜를 이동
      const targetDay = parseInt(dayOfWeek);
      const currentDay = currentDate.getDay();
      let diff = targetDay - currentDay;
      if (diff < 0) diff += 7;
      currentDate.setDate(currentDate.getDate() + diff);

      // 1주 ~ 15주 루프
      for (let i = 1; i <= 15; i++) {
        // 날짜 문자열 (YYYY-MM-DD 형식)
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // 공휴일 체크
        if (holidayMap[dateStr]) {
          // 🛑 공휴일 발견! -> "휴강" 세션으로 저장하고, 보강 큐에 추가
          sessions.push({
            courseId: course.id,
            week: i,
            date: dateStr,
            title: `${holidayMap[dateStr]} (휴강)`, // 예: "추석 (휴강)"
            isOpen: false, // 휴강이니까 출석 안 엶
            authCode: null,
            attendanceType: 'code'
          });
          // 보강 큐에 등록 (나중에 16주차로 생성)
          makeupQueue.push({ title: `${i}주차 보강` });
        } else {
          // ✅ 정상 수업
          sessions.push({
            courseId: course.id,
            week: i,
            date: dateStr,
            title: `${i}주차 수업`,
            attendanceType: 'code',
            authCode: Math.floor(1000 + Math.random() * 9000).toString(),
            isOpen: false
          });
        }

        // 다음 주 날짜로 이동 (+7일)
        currentDate.setDate(currentDate.getDate() + 7);
      }

      // 4. 16주차 이후 보강 생성 (makeupQueue에 쌓인 만큼 추가)
      for (let j = 0; j < makeupQueue.length; j++) {
        const item = makeupQueue[j];
        const dateStr = currentDate.toISOString().split('T')[0];
        
        sessions.push({
          courseId: course.id,
          week: 15 + j + 1, // 16주차, 17주차...
          date: dateStr,
          title: item.title, // "3주차 보강"
          attendanceType: 'code',
          authCode: Math.floor(1000 + Math.random() * 9000).toString(),
          isOpen: false
        });

        currentDate.setDate(currentDate.getDate() + 7);
      }

      // 한 번에 저장 (속도 최적화)
      await Session.bulkCreate(sessions);

      await writeLog(instructorId, "COURSE_CREATE", `강의 생성: ${name} (#${course.id})`, req.ip);

      return res.status(201).json({ message: "강의 및 스마트 일정 생성 완료", course });
    } catch (err) {
      console.error("createCourse error:", err);
      return res.status(500).json({ error: "서버 오류" });
    }
  },

  /** 강의 수정 (기능 유지) */
  async updateCourse(req, res) {
    try {
      const { id } = req.params;
      const { name, instructorId, departmentId, semesterId } = req.body;

      const course = await Course.findByPk(id);
      if (!course) {
        return res.status(404).json({ message: "강의를 찾을 수 없습니다." });
      }

      const oldValues = { ...course.get() };

      if (name) course.name = name;
      if (instructorId) course.instructorId = instructorId;
      if (departmentId !== undefined) course.departmentId = departmentId;
      if (semesterId !== undefined) course.semesterId = semesterId;

      await course.save();

      await writeLog(
        req.session.user.id,
        "COURSE_UPDATE",
        `강의 수정 (#${id}) → ${JSON.stringify({ before: oldValues, after: course.get() })}`,
        req.ip
      );

      return res.json({ message: "강의 수정 완료", course });
    } catch (err) {
      console.error("updateCourse error:", err);
      return res.status(500).json({ error: "서버 오류" });
    }
  },

  /** 강의 삭제 (기능 유지) */
  async deleteCourse(req, res) {
    try {
      const { id } = req.params;
      const course = await Course.findByPk(id);
      if (!course) {
        return res.status(404).json({ message: "강의를 찾을 수 없습니다." });
      }
      const oldName = course.name;
      await course.destroy();
      await writeLog(req.session.user.id, "COURSE_DELETE", `강의 삭제: ${oldName} (#${id})`, req.ip);
      return res.json({ message: "강의 삭제 완료" });
    } catch (err) {
      console.error("deleteCourse error:", err);
      return res.status(500).json({ error: "서버 오류" });
    }
  },
};