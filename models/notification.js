// models/notification.js
"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    static associate(models) {
      Notification.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });

      // 코스/세션과 연동하고 싶으면 옵션으로:
      Notification.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });

      Notification.belongsTo(models.Session, {
        foreignKey: "sessionId",
        as: "session",
      });
    }
  }

  Notification.init(
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      type: {
        // 예: ATTENDANCE_OPEN, ATTENDANCE_WARNING, EXCUSE_RESULT ...
        type: DataTypes.STRING,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      courseId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      sessionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Notification",
      tableName: "Notifications",
    }
  );

  return Notification;
};