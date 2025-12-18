const Sequelize = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Message extends Sequelize.Model {
    static associate(db) {
      // 관계 설정
      db.Message.belongsTo(db.User, { as: 'sender', foreignKey: 'senderId' });
      db.Message.belongsTo(db.User, { as: 'receiver', foreignKey: 'receiverId' });
      db.Message.belongsTo(db.Course, { foreignKey: 'courseId' });
    }
  }

  Message.init({
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    sequelize,
    timestamps: true,
    modelName: 'Message',
    tableName: 'Messages',
    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci',
  });

  return Message;
};