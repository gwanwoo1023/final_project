// migrations/xxxxxxxxxxxxxx-create-semesters.js
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Semesters", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },

      // 예: 2025
      year: { type: Sequelize.INTEGER, allowNull: false },

      // 예: 1, 2 (1학기/2학기)
      term: { type: Sequelize.INTEGER, allowNull: false },

      // 예: "2025-1학기" (편하게 표시용)
      name: { type: Sequelize.STRING, allowNull: false },

      // 선택: 시작/종료일
      startDate: { type: Sequelize.DATEONLY, allowNull: true },
      endDate: { type: Sequelize.DATEONLY, allowNull: true },

      // 선택: 현재 학기 표시
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },

      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    // 같은 year+term 중복 방지(권장)
    await queryInterface.addConstraint("Semesters", {
      fields: ["year", "term"],
      type: "unique",
      name: "uniq_semesters_year_term",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("Semesters");
  },
};
