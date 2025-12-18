"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Session extends Model {
    static associate(models) {
      // 어떤 과목의 회차인지
      Session.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });

      // 이 회차의 출석들
      Session.hasMany(models.Attendance, {
        foreignKey: "sessionId",
        as: "attendances",
      });
    }
  }

  Session.init(
    {
      courseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      week: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      // ★ [추가] 실제 수업 날짜 (예: 2025-09-01)
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      // ★ [추가] 수업 제목 (예: "1주차 수업", "추석 휴강", "보강")
      title: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      startTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      endTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },

      // 🔹 출석 방식: 인증코드(code) / 전자출결(simple)
      attendanceType: {
        type: DataTypes.ENUM("code", "simple"),
        allowNull: false,
        defaultValue: "code",
      },

      // 🔹 인증번호 방식일 때 사용하는 4자리 코드
      authCode: {
        type: DataTypes.STRING(10),
        allowNull: true,
      },

      // 🔹 출석 열려있는지 여부
      isOpen: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // 🔹 (선택) 상태 값 - READY / OPEN / CLOSED 등
      status: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      openUntil: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Session",
      tableName: "Sessions",
      charset: "utf8",
      collate: "utf8_general_ci",
    }
  );

  return Session;
};