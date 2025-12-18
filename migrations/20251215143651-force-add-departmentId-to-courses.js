"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) 컬럼 추가
    await queryInterface.addColumn("Courses", "departmentId", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // 2) FK 추가 (Departments.id 참조)
    await queryInterface.addConstraint("Courses", {
      fields: ["departmentId"],
      type: "foreign key",
      name: "fk_courses_departmentId",
      references: {
        table: "Departments",
        field: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint("Courses", "fk_courses_departmentId");
    await queryInterface.removeColumn("Courses", "departmentId");
  },
};
