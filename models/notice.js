"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Notice extends Model {
    static associate(models) {
      // ✅ [핵심] foreignKey: "userId"가 반드시 있어야 writerId를 안 찾습니다!
      Notice.belongsTo(models.User, { foreignKey: "userId", as: "writer" });
      Notice.belongsTo(models.Course, { foreignKey: "courseId", as: "course" });
    }
  }

  Notice.init(
    {
      courseId: { type: DataTypes.INTEGER, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false }, // writerId 아님!
      title: { type: DataTypes.STRING, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      sequelize,
      modelName: "Notice",
      tableName: "Notices",
    }
  );

  return Notice;
};