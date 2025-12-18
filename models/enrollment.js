const Sequelize = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Enrollment extends Sequelize.Model {
    static associate(db) {
      // 관계 설정: 학생(User) <-> 강의(Course)
      db.Enrollment.belongsTo(db.User, { as: 'student', foreignKey: 'studentId' });
      db.Enrollment.belongsTo(db.Course, { as: 'course', foreignKey: 'courseId' });
    }
  }

  Enrollment.init({
    // 필요한 추가 필드가 있다면 여기에 작성 (지금은 연결만 하면 되므로 비워둠)
  }, {
    sequelize,
    timestamps: true,
    modelName: 'Enrollment',
    tableName: 'Enrollments',
    charset: 'utf8mb4',
    collate: 'utf8mb4_general_ci',
  });

  return Enrollment;
};