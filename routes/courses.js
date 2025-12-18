const express = require("express");
const router = express.Router();

const courseController = require("../controllers/courseController");
const { authenticate, authorize } = require("../middleware/auth");

// ===========================================================
// 과목 목록 조회 - 로그인한 사람 누구나 (필터링은 컨트롤러에서 처리)
// ===========================================================
router.get(
  "/",
  authenticate,
  authorize("student", "instructor", "admin"),
  courseController.getCourses
);

// [참고] 과목 삭제 로직은 admin.js에 위치하는 것이 일반적이나, 
// 만약 이 파일에서 삭제를 처리하고 싶다면 아래와 같은 구조가 필요합니다.
router.delete("/:id", authenticate, authorize("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        const { Course } = require("../models");

        const course = await Course.findByPk(id);
        if (!course) {
            return res.status(404).json({ message: "삭제할 과목을 찾을 수 없습니다." });
        }

        // 삭제 실행
        await course.destroy();

        res.json({ message: "과목이 성공적으로 삭제되었습니다." });
    } catch (error) {
        console.error("과목 삭제 에러:", error);
        
        // ★ 에러 발생 시 error.html 렌더링 대신 JSON 응답을 보내 에러를 방지합니다.
        res.status(500).json({ 
            message: "삭제 실패: 해당 과목에 등록된 출석 데이터가 있어 삭제할 수 없습니다. DB에서 CASCADE 설정을 확인하세요.",
            error: error.message 
        });
    }
});

module.exports = router;