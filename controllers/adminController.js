const bcrypt = require('bcrypt');
const { User, Course, AuditLog, Excuse, Attendance, Offvote, Department, Semester, SystemSetting, Session, Holiday, Enrollment } = require("../models");

// ==============================
// 1. 사용자(User) 관리 (기존 로직 유지)
// ==============================
exports.listUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      order: [["createdAt", "DESC"]],
      attributes: ["id", "email", "name", "studentId", "role"],
    });
    return res.json(users);
  } catch (err) {
    console.error("listUsers error:", err);
    return res.status(500).json({ error: "서버 에러" });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { email, password, name, studentId, role } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ message: "이름, 이메일, 비밀번호는 필수입니다." });
    }
    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({
      email,
      password: hash,
      name,
      studentId: studentId || null,
      role: role || "student",
    });
    await AuditLog.create({
      actorId: req.user.id,
      action: "ADMIN_CREATE_USER",
      entityType: "User",
      details: JSON.stringify({ name: user.name, email: user.email, role: user.role }),
      ipAddress: req.ip,
    });
    return res.status(201).json({ message: "사용자 생성 완료", user });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: "이미 존재하는 이메일입니다." });
    }
    return res.status(500).json({ error: "서버 에러" });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, studentId, role } = req.body;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    const before = { ...user.get() };
    if (name) user.name = name;
    if (email) user.email = email;
    if (studentId !== undefined) user.studentId = studentId;
    if (role) user.role = role;
    await user.save();
    await AuditLog.create({
      actorId: req.user.id,
      action: "ADMIN_UPDATE_USER",
      entityType: "User",
      details: JSON.stringify({ before, after: user.get() }),
      ipAddress: req.ip,
    });
    return res.json({ message: "사용자 수정 완료", user });
  } catch (err) {
    return res.status(500).json({ error: "서버 에러" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    const oldData = { ...user.get() };
    await user.destroy();
    await AuditLog.create({
      actorId: req.user.id,
      action: "ADMIN_DELETE_USER",
      entityType: "User",
      details: JSON.stringify(oldData),
      ipAddress: req.ip,
    });
    return res.json({ message: "사용자 삭제 완료" });
  } catch (err) {
    return res.status(500).json({ error: "서버 에러" });
  }
};

// ==============================
// 2. 과목(Course) 관리 (스마트 스케줄러 보강)
// ==============================
exports.listCourses = async (req, res) => {
  try {
    const courses = await Course.findAll({
      include: [
        { model: User, as: "instructor", attributes: ["id", "name"] },
        { model: Department, as: "department", attributes: ["name"] },
        { model: Semester, as: "semester", attributes: ["name"] }
      ],
      order: [["createdAt", "DESC"]],
    });
    return res.json(courses);
  } catch (err) {
    return res.status(500).json({ error: "서버 에러" });
  }
};

exports.createCourse = async (req, res) => {
  try {
    const { name, instructorId, departmentId, semesterId, dayOfWeek = 1, startDate = '2025-09-01' } = req.body;
    if (!name) return res.status(400).json({ message: "강의명은 필수입니다." });

    const course = await Course.create({
      name,
      instructorId: instructorId || null,
      departmentId: departmentId || null,
      semesterId: semesterId || null
    });

    // ★ [보강] 공휴일 맵 생성 로직 (추석 등 하드코딩 포함) [cite: 3, 5, 9]
    let holidayMap = {
      '2025-10-06': '추석',
      '2025-10-07': '추석 연휴',
      '2025-10-08': '추석 연휴',
      '2025-10-03': '개천절',
      '2025-10-09': '한글날'
    };
    try {
      const dbHolidays = await Holiday.findAll();
      dbHolidays.forEach(h => { holidayMap[h.date] = h.name; });
    } catch (e) { console.log("Holiday 테이블 조회 실패(무시가능)"); }

    const sessions = [];
    const makeupQueue = []; // 보강이 필요한 주차를 담는 큐 
    
    let currentDate = new Date(startDate);
    const targetDay = parseInt(dayOfWeek); 
    const currentDay = currentDate.getDay(); 
    let diff = targetDay - currentDay;
    if (diff < 0) diff += 7;
    currentDate.setDate(currentDate.getDate() + diff);

    // ★ [로직 수정] 공휴일이면 보강 큐에 넣고, 정상 수업만 15주차를 채웁니다. [cite: 3, 9]
    let weekCount = 1;
    while (weekCount <= 15) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      if (holidayMap[dateStr]) {
        // 공휴일인 경우: 휴강 세션 생성 후 보강 큐에 추가 
        sessions.push({
          courseId: course.id, week: weekCount, date: dateStr,
          title: `${holidayMap[dateStr]} (휴강)`, isOpen: false, authCode: null, attendanceType: 'code'
        });
        makeupQueue.push({ originalWeek: weekCount, holidayName: holidayMap[dateStr] });
        // 공휴일은 수업 횟수(weekCount)에 포함하지 않고 날짜만 다음 주로 넘깁니다.
      } else {
        // 정상 수업일
        sessions.push({
          courseId: course.id, week: weekCount, date: dateStr,
          title: `${weekCount}주차 수업`, isOpen: false,
          authCode: Math.floor(1000 + Math.random() * 9000).toString(), attendanceType: 'code'
        });
        weekCount++;
      }
      currentDate.setDate(currentDate.getDate() + 7);
    }

    // ★ [보강 주차 생성] 15주 이후에 밀린 수업만큼 추가 (예: 16주차 보강) 
    for (let j = 0; j < makeupQueue.length; j++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      sessions.push({
        courseId: course.id, 
        week: 15 + j + 1, 
        date: dateStr,
        title: `${makeupQueue[j].originalWeek}주차 보강 (${makeupQueue[j].holidayName} 대체)`, 
        isOpen: false,
        authCode: Math.floor(1000 + Math.random() * 9000).toString(), 
        attendanceType: 'code'
      });
      currentDate.setDate(currentDate.getDate() + 7);
    }

    await Session.bulkCreate(sessions);

    await AuditLog.create({
      actorId: req.user.id,
      action: "ADMIN_CREATE_COURSE",
      entityType: "Course",
      details: JSON.stringify({ ...course.get(), startDate, dayOfWeek }),
      ipAddress: req.ip,
    });

    return res.status(201).json({ message: "강의 생성 완료 (공휴일 보강 포함)", course });
  } catch (err) {
    console.error("createCourse error:", err);
    return res.status(500).json({ error: "서버 에러" });
  }
};

// 이하 updateCourse, deleteCourse, Department, Semester, Settings 관리 로직은 기존과 동일 (생략 없이 유지됨)
exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, instructorId, departmentId, semesterId } = req.body;
    const course = await Course.findByPk(id);
    if (!course) return res.status(404).json({ message: "강의를 찾을 수 없습니다." });
    const before = { ...course.get() };
    if (name) course.name = name;
    if (instructorId !== undefined) course.instructorId = instructorId;
    if (departmentId !== undefined) course.departmentId = departmentId;
    if (semesterId !== undefined) course.semesterId = semesterId;
    await course.save();
    await AuditLog.create({
      actorId: req.user.id,
      action: "ADMIN_UPDATE_COURSE",
      entityType: "Course",
      details: JSON.stringify({ before, after: course.get() }),
      ipAddress: req.ip,
    });
    return res.json({ message: "강의 수정 완료", course });
  } catch (err) {
    return res.status(500).json({ error: "서버 에러" });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findByPk(id);
    if (!course) return res.status(404).json({ message: "강의를 찾을 수 없습니다." });
    const old = { ...course.get() };
    const sessions = await Session.findAll({ where: { courseId: id }, attributes: ['id'] });
    const sessionIds = sessions.map(s => s.id);
    if (sessionIds.length > 0) {
      await Attendance.destroy({ where: { sessionId: sessionIds } });
    }
    await Enrollment.destroy({ where: { courseId: id } });
    await Session.destroy({ where: { courseId: id } });
    await course.destroy();
    await AuditLog.create({
      actorId: req.user.id,
      action: "ADMIN_DELETE_COURSE",
      entityType: "Course",
      details: JSON.stringify(old),
      ipAddress: req.ip,
    });
    return res.json({ message: "강의 및 모든 관련 데이터 삭제 완료" });
  } catch (err) {
    console.error("deleteCourse error:", err);
    return res.status(500).json({ error: "서버 에러", message: "삭제 실패" });
  }
};

// 학과, 학기, 시스템 설정, 감사 로그 등의 로직도 기존 코드 그대로 유지
exports.listDepartments = async (req, res) => {
  try {
    const depts = await Department.findAll({ order: [['name', 'ASC']] });
    res.json(depts);
  } catch (err) {
    res.status(500).json({ message: "서버 에러" });
  }
};

exports.createDepartment = async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name) return res.status(400).json({ message: "학과명 필수" });
    const dept = await Department.create({ name, code, description });
    await AuditLog.create({
      actorId: req.user.id,
      action: "ADMIN_CREATE_DEPT",
      entityType: "Department",
      details: JSON.stringify(dept),
      ipAddress: req.ip,
    });
    res.status(201).json(dept);
  } catch (err) {
    if(err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: "이미 존재하는 학과명 또는 코드입니다." });
    }
    res.status(500).json({ message: "서버 에러" });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if(!dept) return res.status(404).json({ message: "학과 없음" });
    await dept.update(req.body);
    res.json({ message: "수정 완료" });
  } catch(err) {
    res.status(500).json({ message: "에러 발생" });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if(!dept) return res.status(404).json({ message: "학과 없음" });
    await dept.destroy();
    res.json({ message: "삭제 완료" });
  } catch(err) {
    res.status(500).json({ message: "에러 발생" });
  }
};

exports.listSemesters = async (req, res) => {
  try {
    const sems = await Semester.findAll({ order: [['year', 'DESC'], ['term', 'DESC']] });
    res.json(sems);
  } catch (err) {
    res.status(500).json({ message: "서버 에러" });
  }
};

exports.createSemester = async (req, res) => {
  try {
    const { name, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ message: "학기명, 시작일, 종료일 필수" });
    }
    let year = new Date().getFullYear();
    let term = 1;
    const nums = name.match(/\d+/g);
    if (nums && nums.length >= 2) {
      year = parseInt(nums[0]);
      term = parseInt(nums[1]);
    } else if (nums && nums.length === 1) {
      year = parseInt(nums[0]);
    }
    const sem = await Semester.create({
      name, startDate, endDate, year, term, isActive: true
    });
    await AuditLog.create({
      actorId: req.user.id,
      action: "ADMIN_CREATE_SEMESTER",
      entityType: "Semester",
      details: JSON.stringify(sem),
      ipAddress: req.ip,
    });
    res.status(201).json(sem);
  } catch (err) {
    res.status(500).json({ message: "서버 에러" });
  }
};

exports.updateSemester = async (req, res) => {
  try {
    const sem = await Semester.findByPk(req.params.id);
    if(!sem) return res.status(404).json({ message: "학기 없음" });
    await sem.update(req.body);
    res.json({ message: "수정 완료" });
  } catch(err) {
    res.status(500).json({ message: "에러 발생" });
  }
};

exports.deleteSemester = async (req, res) => {
  try {
    const sem = await Semester.findByPk(req.params.id);
    if(!sem) return res.status(404).json({ message: "학기 없음" });
    await sem.destroy();
    res.json({ message: "삭제 완료" });
  } catch(err) {
    res.status(500).json({ message: "에러 발생" });
  }
};

exports.listSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.findAll({ order: [['key', 'ASC']] });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: "서버 에러" });
  }
};

exports.updateSetting = async (req, res) => {
  try {
    const { key, value } = req.body;
    if(!key) return res.status(400).json({ message: "Key 필수" });
    let setting = await SystemSetting.findOne({ where: { key } });
    if (setting) {
      setting.value = value;
      await setting.save();
    } else {
      setting = await SystemSetting.create({ key, value });
    }
    await AuditLog.create({ actorId: req.user.id, action: "POLICY_CHANGE", entityType: "SystemSetting", details: JSON.stringify({ key, value }), ipAddress: req.ip });
    res.json({ message: "설정 저장 완료" });
  } catch (err) {
    res.status(500).json({ message: "서버 에러" });
  }
};

exports.getSystemStats = async (req, res) => {
  try {
    const users = await User.count();
    const courses = await Course.count();
    const excuses = await Excuse.count();
    const attendances = await Attendance.count();
    const votes = await Offvote.count();
    const sessions = await Session.count(); 
    return res.json({ users, courses, excuses, attendances, votes, sessions });
  } catch (err) {
    return res.status(500).json({ error: "서버 에러" });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    const logs = await AuditLog.findAll({
      include: [{ model: User, as: "actor", attributes: ["id", "email", "name", "role"] }],
      order: [["createdAt", "DESC"]],
      limit: limit,
    });
    return res.json(logs);
  } catch (err) {
    return res.status(500).json({ error: "서버 에러" });
  }
};