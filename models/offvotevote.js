// models/offvotevote.js
"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class OffvoteVote extends Model {
    static associate(models) {
      OffvoteVote.belongsTo(models.Offvote, {
        foreignKey: "offvoteId",
        as: "offvote",
      });

      OffvoteVote.belongsTo(models.OffvoteOption, {
        foreignKey: "optionId",
        as: "option",
      });

      OffvoteVote.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
      });
    }
  }

  OffvoteVote.init(
    {
      offvoteId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      optionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "OffvoteVote",
      tableName: "OffvoteVotes",
    }
  );

  return OffvoteVote;
};