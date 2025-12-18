'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Offvotes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      // 모델에 맞춰서 isOpen 사용 (기존 isClosed 대신)
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      isOpen: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      courseId: { 
        type: Sequelize.INTEGER, 
        allowNull: true,
        references: { model: 'Courses', key: 'id' },
        onDelete: 'CASCADE'
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Offvotes');
  }
};