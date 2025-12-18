'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('OffvoteVotes', {
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
      optionId: { 
        type: Sequelize.INTEGER, 
        allowNull: false,
        references: { model: 'OffvoteOptions', key: 'id' },
        onDelete: 'CASCADE'
      },
      // 모델에 맞춰 studentId 대신 userId 사용
      userId: { 
        type: Sequelize.INTEGER, 
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE'
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });

    // 🔥 [복구 완료] 한 학생은 하나의 투표에 한 번만 투표 가능 (Unique Constraint)
    // 변수명만 studentId -> userId로 맞춰서 기능을 살렸습니다.
    await queryInterface.addConstraint('OffvoteVotes', {
      fields: ['offvoteId', 'userId'],
      type: 'unique',
      name: 'unique_vote_per_user'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('OffvoteVotes');
  }
};