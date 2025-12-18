const express = require("express");
const path = require("path");
const morgan = require("morgan");
const nunjucks = require("nunjucks");
const session = require("express-session");
const dotenv = require("dotenv");
const cors = require("cors");
const { sequelize } = require("./models"); 

// [1] 라우터 가져오기
const authRouter = require("./routes/auth");
const excuseRouter = require("./routes/excuse");
const noticeRouter = require("./routes/notice");
const coursesRouter = require("./routes/courses");
const sessionsRouter = require("./routes/sessions");
const attendanceRouter = require("./routes/attendance");
const notificationsRouter = require("./routes/notifications");
const offVoteRoutes = require("./routes/offvote");
const auditRouter = require("./routes/audit");
const adminRouter = require("./routes/admin");
const messageRouter = require("./routes/message");
const enrollmentRouter = require("./routes/enrollment");

dotenv.config();

const app = express();
app.set("port", process.env.PORT || 3001);
app.set("view engine", "html");

nunjucks.configure("views", {
  express: app,
  watch: true,
});

// CORS
app.use(cors());

// 기본 미들웨어
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// 세션 설정
app.use(
  session({
    resave: false,
    saveUninitialized: false,
    secret: process.env.COOKIE_SECRET || "secret",
    cookie: {
      httpOnly: true,
      secure: false,
    },
  })
);

// [2] 화면(View) 라우터
app.get("/", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("main", { user: req.session.user });
});

app.get("/join", (req, res) => res.render("join"));
app.get("/login", (req, res) => res.render("login"));

// [3] 기능(API) 라우터
app.use("/auth", authRouter);
app.use("/excuse", excuseRouter);
app.use("/notice", noticeRouter);
app.use("/courses", coursesRouter);
app.use("/sessions", sessionsRouter);
app.use("/attendance", attendanceRouter);
app.use("/notifications", notificationsRouter);
app.use("/offvote", offVoteRoutes);
app.use("/audit", auditRouter);
app.use("/admin", adminRouter);
app.use("/message", messageRouter);
app.use("/enrollment", enrollmentRouter);

// 404
app.use((req, res, next) => {
  const error = new Error(`${req.method} ${req.url} 라우터가 없습니다.`);
  error.status = 404;
  next(error);
});

// 에러 처리
app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = process.env.NODE_ENV !== "production" ? err : {};
  res.status(err.status || 500);

  if (req.accepts("html")) {
    res.render("error");
  } else {
    res.json({ message: err.message, error: err });
  }
});

// ★★★ [핵심] DB 강제 수정 및 연결 로직 ★★★
const startServer = async () => {
  try {
    // 1. DB 연결 테스트
    await sequelize.authenticate();
    console.log("🔌 DB 연결 확인 완료.");

    // 2. [자동 복구] Excuses 테이블 충돌 해결
    try {
      await sequelize.query("SET FOREIGN_KEY_CHECKS = 0"); 
      await sequelize.query("ALTER TABLE Excuses MODIFY COLUMN studentId INTEGER NULL");
      await sequelize.query("SET FOREIGN_KEY_CHECKS = 1"); 
      console.log("🛠️ [자동 복구] Excuses 테이블 스키마 강제 수정 완료.");
    } catch (dbErr) {
      // 무시
    }

    // 3. 모델 동기화 (ER_TOO_MANY_KEYS 에러 해결을 위해 alter를 false로 변경)
    // 이미 스키마는 업데이트되어 있으므로 alter를 꺼서 인덱스 중복 생성을 막습니다.
    await sequelize.sync({ force: false, alter: false });
    console.log("✅ 데이터베이스 동기화 완료 (Structure Fixed)");

    // 4. 서버 시작
    app.listen(app.get("port"), () => {
      console.log(`🚀 Server is running on port ${app.get("port")}`);
    });

  } catch (err) {
    console.error("❌ 서버 시작 실패:", err);
  }
};

startServer();