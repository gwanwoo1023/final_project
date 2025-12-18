"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Offvote extends Model {
    static associate(models) {
      Offvote.hasMany(models.OffvoteOption, {
        foreignKey: "offvoteId",
        as: "options",
      });
      Offvote.hasMany(models.OffvoteVote, {
        foreignKey: "offvoteId",
        as: "votes",
      });
      // ★ [추가됨] 강의(Course)와 연결
      Offvote.belongsTo(models.Course, {
        foreignKey: "courseId",
        as: "course",
      });
    }
  }

  Offvote.init(
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isOpen: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      // ★ [추가됨] 어떤 강의의 투표인지 저장
      courseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      }
    },
    {
      sequelize,
      modelName: "Offvote",
      tableName: "Offvotes",
    }
  );

  return Offvote;
};