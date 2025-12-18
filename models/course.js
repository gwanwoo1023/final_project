"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Course extends Model {
    static associate(models) {
      // 1. 교수님 연결
      Course.belongsTo(models.User, {
        foreignKey: "instructorId",
        as: "instructor",
      });

      // 2. 학과 연결
      Course.belongsTo(models.Department, {
        foreignKey: "departmentId",
        as: "department",
      });

      // 3. 학기 연결
      Course.belongsTo(models.Semester, {
        foreignKey: "semesterId",
        as: "semester",
      });

      // 4. 수업(Session) 연결 (강의 삭제 시 수업도 삭제되도록 CASCADE 추가)
      Course.hasMany(models.Session, {
        foreignKey: "courseId",
        as: "sessions",
        onDelete: "CASCADE", 
      });

      // 5. 공지사항 연결
      Course.hasMany(models.Notice, {
        foreignKey: "courseId",
        as: "notices",
      });

      // ✅ 6. [추가] 공강 투표 연결 (이게 있어야 투표 기능 에러가 안 남)
      Course.hasMany(models.Offvote, {
        foreignKey: "courseId",
        as: "offvotes",
      });
    }
  }

  Course.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      instructorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      departmentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "소속 학과 ID (관리자 기능용)",
      },
      semesterId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: "Course",
      tableName: "Courses", // 님 원래 설정 유지
    }
  );

  return Course;
};