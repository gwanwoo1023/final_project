"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class OffvoteOption extends Model {
    static associate(models) {
      // 선택지는 하나의 투표 주제에 속함
      OffvoteOption.belongsTo(models.Offvote, {
        foreignKey: "offvoteId",
        as: "offvote",
      });
      // 선택지는 여러 명의 유저에게 선택받음
      OffvoteOption.hasMany(models.OffvoteVote, {
        foreignKey: "optionId",
        as: "votes",
      });
    }
  }

  OffvoteOption.init(
    {
      offvoteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      text: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      count: { // (선택사항) 집계 편의를 위해 카운트 필드 추가
        type: DataTypes.INTEGER,
        defaultValue: 0,
      }
    },
    {
      sequelize,
      modelName: "OffvoteOption",
      tableName: "OffvoteOptions",
    }
  );

  return OffvoteOption;
};