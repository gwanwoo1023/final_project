'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('OffvoteOptions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      offvoteId: { 
        type: Sequelize.INTEGER, 
        allowNull: false,
        references: { model: 'Offvotes', key: 'id' },
        onDelete: 'CASCADE'
      },
      text: {
        type: Sequelize.STRING,
        allowNull: false
      },
      // 모델에 맞춰 voteCount 대신 count 사용
      count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('OffvoteOptions');
  }
};