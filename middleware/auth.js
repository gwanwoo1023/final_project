// 세션(Session) 방식의 인증 미들웨어

exports.authenticate = (req, res, next) => {
    // 로그인 시 세션에 저장했던 user 정보가 있는지 확인
    if (req.session && req.session.user) {
        // 라우터에서 req.user로 편하게 쓰기 위해 할당
        req.user = req.session.user;
        next();
    } else {
        // 로그인 안 된 상태면 에러 반환 (또는 로그인 페이지로 리다이렉트)
        res.status(401).json({ message: '로그인이 필요합니다.' });
    }
};

exports.authorize = (...roles) => {
    return (req, res, next) => {
        // 로그인한 유저의 역할(role)이 허용된 역할 목록에 있는지 확인
        // 예: authorize('instructor', 'admin') -> 교원이나 관리자만 통과
        if (req.user && roles.includes(req.user.role)) {
            next();
        } else {
            res.status(403).json({ message: '접근 권한이 없습니다.' });
        }
    };
};