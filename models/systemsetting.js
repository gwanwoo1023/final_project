// models/systemsetting.js
"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class SystemSetting extends Model {
    static associate(models) {
      // 설정은 다른 모델과 연결될 필요가 보통 없습니다.
    }
  }

  SystemSetting.init(
    {
      key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        comment: "설정 키 (예: NOTIFICATION_ENABLED)",
      },
      value: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "설정 값 (예: Y, N, 10...)",
      },
      description: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: "설정 설명",
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      }
    },
    {
      sequelize,
      modelName: "SystemSetting",
      tableName: "SystemSettings",
      timestamps: true, // createdAt, updatedAt 자동 생성
    }
  );

  return SystemSetting;
};