'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AuditLogs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      // 실행한 사람 (Users 테이블 참조)
      actorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      // 대상 유저 (Users 테이블 참조, 없을 수도 있음)
      targetUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      // 엔티티 타입 (예: 'ATTENDANCE', 'COURSE')
      entityType: {
        type: Sequelize.STRING,
        allowNull: false
      },
      // 엔티티 ID
      entityId: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      // 액션 (예: 'CREATE', 'UPDATE')
      action: {
        type: Sequelize.STRING,
        allowNull: false
      },
      // 상세 내용
      details: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      // IP 주소
      ipAddress: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('AuditLogs');
  }
};