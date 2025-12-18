"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class AuditLog extends Model {
    static associate(models) {
      AuditLog.belongsTo(models.User, { foreignKey: "actorId", as: "actor" });
      AuditLog.belongsTo(models.User, { foreignKey: "targetUserId", as: "targetUser" });
    }
  }

  AuditLog.init(
    {
      actorId: { type: DataTypes.INTEGER, allowNull: false }, // 실행한 사람
      targetUserId: { type: DataTypes.INTEGER, allowNull: true }, // 대상 유저
      entityType: { type: DataTypes.STRING, allowNull: true }, // 대상 (User, Course...)
      action: { type: DataTypes.STRING, allowNull: false }, // 동작 (CREATE, DELETE...)
      details: { type: DataTypes.TEXT, allowNull: true }, // 상세 내용
      ipAddress: { type: DataTypes.STRING, allowNull: true },
    },
    {
      sequelize,
      modelName: "AuditLog",
      tableName: "AuditLogs",
    }
  );

  return AuditLog;
};