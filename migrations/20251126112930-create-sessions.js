'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Sessions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      courseId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Courses',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      week: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      // 님 코드에 있는 추가 필드들 (DB에도 추가!)
      date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      startTime: {
        type: Sequelize.TIME,
        allowNull: true
      },
      endTime: {
        type: Sequelize.TIME,
        allowNull: true
      },
      attendanceType: {
        type: Sequelize.ENUM('code', 'simple'),
        defaultValue: 'code'
      },
      authCode: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      isOpen: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      openUntil: {
        type: Sequelize.DATE,
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
    await queryInterface.dropTable('Sessions');
  }
};