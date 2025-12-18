'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Excuses', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      // 모델에 있는 필드 그대로 생성
      studentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE'
      },
      reason: { type: Sequelize.TEXT, allowNull: false }, // 모델이 TEXT이므로 TEXT로
      fileUrl: { type: Sequelize.STRING(200), allowNull: true },
      status: { 
        type: Sequelize.ENUM('pending', 'approved', 'rejected'), 
        defaultValue: 'pending' 
      },
      adminComment: { type: Sequelize.STRING(200), allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Excuses');
  }
};