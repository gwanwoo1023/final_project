"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    const rows = [
      {
        key: "ATTENDANCE_OPEN_MINUTES",
        value: "10",
        description: "출석 오픈 후 허용 시간(분)",
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "ABSENT_WARN_COUNT",
        value: "2",
        description: "결석 경고 기준 횟수",
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "ABSENT_DANGER_COUNT",
        value: "3",
        description: "결석 위험 기준 횟수",
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "OFFVOTE_ENABLED",
        value: "true",
        description: "공강 투표 기능 활성화 여부",
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "EXCUSE_REQUIRE_FILE",
        value: "true",
        description: "공결 신청 시 증빙 파일 필수 여부",
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "NOTIFICATION_ENABLED",
        value: "true",
        description: "알림 기능 활성화 여부",
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "AUDIT_LOG_ENABLED",
        value: "true",
        description: "감사로그 활성화 여부",
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "SESSION_TIMEOUT_MINUTES",
        value: "60",
        description: "세션 타임아웃(분) - 정책용 값 (express-session 설정과 별개)",
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "SEMESTER_START_DATE",
        value: "2025-03-01",
        description: "학기 시작일 (YYYY-MM-DD)",
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "SEMESTER_END_DATE",
        value: "2025-06-30",
        description: "학기 종료일 (YYYY-MM-DD)",
        createdAt: now,
        updatedAt: now,
      },
      {
        key: "SYSTEM_MAINTENANCE",
        value: "false",
        description: "시스템 점검 모드 여부",
        createdAt: now,
        updatedAt: now,
      },
    ];

    // 중복 방지: 이미 있으면 skip하고 싶은 경우, 여기선 bulkInsert만 수행
    await queryInterface.bulkInsert("SystemSettings", rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("SystemSettings", {
      key: [
        "ATTENDANCE_OPEN_MINUTES",
        "ABSENT_WARN_COUNT",
        "ABSENT_DANGER_COUNT",
        "OFFVOTE_ENABLED",
        "EXCUSE_REQUIRE_FILE",
        "NOTIFICATION_ENABLED",
        "AUDIT_LOG_ENABLED",
        "SESSION_TIMEOUT_MINUTES",
        "SEMESTER_START_DATE",
        "SEMESTER_END_DATE",
        "SYSTEM_MAINTENANCE",
      ],
    });
  },
};
