// controllers/authController.js
const bcrypt = require('bcrypt');
const { User, AuditLog } = require('../models');

// 감사 로그 기록 헬퍼 함수
async function logAudit(req, actorId, action, details) {
  try {
    await AuditLog.create({
      actorId: actorId,         // ✅ actorId 사용 (최신 DB 구조 반영)
      action: action,
      entityType: 'User',
      targetUserId: actorId,    // 가입/로그인은 본인이 대상
      details: details,
      ipAddress: req.ip
    });
  } catch (err) {
    console.error('AuditLog Error:', err);
  }
}

exports.join = async (req, res) => {
  try {
    const { email, password, name, studentId, role } = req.body;

    // 1. 중복 확인
    const exUser = await User.findOne({ where: { email } });
    if (exUser) {
      return res.status(400).json({ message: '이미 존재하는 이메일입니다.' });
    }

    // 2. 비밀번호 해시
    const hash = await bcrypt.hash(password, 12);

    // 3. 사용자 생성
    const newUser = await User.create({
      email,
      name,
      password: hash,
      studentId: studentId || null,
      role: role || 'student',
    });

    // 4. 감사 로그 기록
    await logAudit(req, newUser.id, 'JOIN', `회원가입: ${email}`);

    return res.status(201).json({ message: '가입 성공' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: '서버 에러' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // 1. 사용자 확인
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: '가입되지 않은 이메일입니다.' });
    }

    // 2. 비밀번호 확인
    const result = await bcrypt.compare(password, user.password);
    if (result) {
      // 세션 저장
      req.session.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        studentId: user.studentId
      };

      // 로그 기록
      await logAudit(req, user.id, 'LOGIN', `로그인 성공: ${email}`);

      return res.json({ message: '로그인 성공', user: req.session.user });
    } else {
      return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: '서버 에러' });
  }
};

exports.logout = async (req, res) => {
  const userId = req.session.user ? req.session.user.id : null;
  if (userId) {
    await logAudit(req, userId, 'LOGOUT', '로그아웃');
  }

  req.session.destroy(() => {
    res.json({ message: '로그아웃 성공' });
  });
};

exports.me = (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: '로그인 필요' });
  }
  res.json(req.session.user);
};