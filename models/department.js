"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Department extends Model {
    static associate(models) {
      Department.hasMany(models.Course, { foreignKey: "departmentId", as: "courses" });
    }
  }

  Department.init(
    {
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      code: { type: DataTypes.STRING, allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    {
      sequelize,
      modelName: "Department",
      tableName: "Departments",
    }
  );

  return Department;
};