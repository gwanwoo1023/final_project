// models/semester.js
"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Semester extends Model {
    static associate(models) {
      Semester.hasMany(models.Course, { foreignKey: "semesterId", as: "courses" });
    }
  }

  Semester.init(
    {
      name: { type: DataTypes.STRING, allowNull: false }, // 예: 2025-2학기
      
      // ★ [핵심] 이 두 줄이 없어서 에러가 났던 겁니다!
      year: { type: DataTypes.INTEGER, allowNull: false }, // 2025
      term: { type: DataTypes.INTEGER, allowNull: false }, // 2
      
      startDate: { type: DataTypes.DATEONLY, allowNull: false },
      endDate: { type: DataTypes.DATEONLY, allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    {
      sequelize,
      modelName: "Semester",
      tableName: "Semesters",
    }
  );

  return Semester;
};