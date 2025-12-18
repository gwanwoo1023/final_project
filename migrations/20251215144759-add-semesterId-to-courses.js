// migrations/xxxxxxxxxxxxxx-add-semesterId-to-courses.js
"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Courses", "semesterId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: "Semesters", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex("Courses", ["semesterId"], {
      name: "idx_courses_semesterId",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("Courses", "idx_courses_semesterId");
    await queryInterface.removeColumn("Courses", "semesterId");
  },
};
