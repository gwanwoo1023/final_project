"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Excuse extends Model {
    static associate(models) {
      // 학생이 삭제되면 공결 기록의 주인은 '알 수 없음(NULL)'이 됨
      Excuse.belongsTo(models.User, {
        foreignKey: "studentId",
        as: "student",
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
    }
  }

  Excuse.init(
    {
      studentId: {
        type: DataTypes.INTEGER,
        allowNull: true, // ★ 여기가 핵심! false에서 true로 변경 (SET NULL을 위해)
      },
      reason: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileUrl: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      adminComment: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Excuse",
      tableName: "Excuses",
      charset: "utf8",
      collate: "utf8_general_ci",
    }
  );

  return Excuse;
};