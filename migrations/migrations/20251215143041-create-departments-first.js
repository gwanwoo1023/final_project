"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // ✅ 이 파일은 SequelizeMeta 불일치 해결용(복구용)입니다.
    // 실제로 이미 실행된 상태라면 여기서 아무 것도 하지 않아도 됩니다.
  },

  async down(queryInterface, Sequelize) {
    // ✅ undo 시에도 아무 것도 하지 않음
    // (이미 다른 departments 마이그레이션이 있을 수 있어 충돌 방지)
  },
};
