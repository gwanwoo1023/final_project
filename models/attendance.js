// models/attendance.js
"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Attendance extends Model {
    static associate(models) {
      // 출석은 하나의 회차에 속함
      Attendance.belongsTo(models.Session, {
        foreignKey: "sessionId",
        as: "session",
      });

      // 출석은 하나의 학생(User)에 속함
      Attendance.belongsTo(models.User, {
        foreignKey: "studentId",
        as: "student",
      });
    }
  }

  Attendance.init(
    {
      sessionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      studentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING, // 'present', 'late', 'absent' 등
        allowNull: false,
      },
      checkedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Attendance",
      tableName: "Attendances",
    }
  );

  return Attendance;
};
