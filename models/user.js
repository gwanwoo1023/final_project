// models/user.js
"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // ✅ 강의(담당 교수)
      User.hasMany(models.Course, {
        foreignKey: "instructorId",
        as: "courses",
      });

      // ✅ 출석(학생)
      User.hasMany(models.Attendance, {
        foreignKey: "studentId",
        as: "attendances",
      });

      // 🚨 [수정 핵심] 여기가 writerId로 되어 있어서 에러가 났던 겁니다!
      // Notice 모델과 똑같이 "userId"로 맞춰줍니다.
      User.hasMany(models.Notice, {
        foreignKey: "userId", // ★ writerId -> userId로 수정 완료
        as: "notices",
      });

      // ✅ 공결(신청 학생)
      User.hasMany(models.Excuse, {
        foreignKey: "studentId",
        as: "excuses",
      });

      // ✅ 감사 로그
      User.hasMany(models.AuditLog, { foreignKey: "actorId", as: "actorLogs" });
      User.hasMany(models.AuditLog, { foreignKey: "targetUserId", as: "targetLogs" });
    }

    toJSON() {
      const values = { ...this.get() };
      delete values.password;
      return values;
    }
  }

  User.init(
    {
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      password: { type: DataTypes.STRING, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      studentId: { type: DataTypes.STRING, allowNull: true },
      role: { type: DataTypes.STRING, allowNull: false, defaultValue: "student" },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "Users",
    }
  );

  return User;
};