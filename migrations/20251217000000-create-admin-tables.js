// migrations/20251217000000-create-admin-tables.js
'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. 학과 (Departments)
    await queryInterface.createTable('Departments', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      name: { type: Sequelize.STRING, allowNull: false, unique: true },
      code: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });

    // 2. 학기 (Semesters)
    await queryInterface.createTable('Semesters', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      name: { type: Sequelize.STRING, allowNull: false },
      year: { type: Sequelize.INTEGER, allowNull: false },
      term: { type: Sequelize.INTEGER, allowNull: false },
      startDate: { type: Sequelize.DATEONLY, allowNull: true },
      endDate: { type: Sequelize.DATEONLY, allowNull: true },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: false },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });

    // 3. 시스템 설정 (SystemSettings)
    await queryInterface.createTable('SystemSettings', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      key: { type: Sequelize.STRING, allowNull: false, unique: true },
      value: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.STRING, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });

    // 4. 감사 로그 (AuditLogs)
    await queryInterface.createTable('AuditLogs', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      actorId: { type: Sequelize.INTEGER, allowNull: false },
      targetUserId: { type: Sequelize.INTEGER, allowNull: true },
      entityType: { type: Sequelize.STRING, allowNull: false },
      entityId: { type: Sequelize.INTEGER, allowNull: true },
      action: { type: Sequelize.STRING, allowNull: false },
      details: { type: Sequelize.TEXT, allowNull: true },
      ipAddress: { type: Sequelize.STRING, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('AuditLogs');
    await queryInterface.dropTable('SystemSettings');
    await queryInterface.dropTable('Semesters');
    await queryInterface.dropTable('Departments');
  }
};