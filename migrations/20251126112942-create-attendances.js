"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Attendances", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      sessionId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Sessions", key: "id" },
        onDelete: "CASCADE",
      },
      studentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      checkedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Attendances");
  },
};
