'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// =========================================================
// ★ [추가됨] 연쇄 삭제(CASCADE) 관계 강제 설정 ★
// 과목 삭제 시 세션/출석/수강내역이 함께 지워지도록 보강합니다.
// =========================================================
if (db.Course && db.ClassSession) {
  db.Course.hasMany(db.ClassSession, { foreignKey: 'courseId', onDelete: 'CASCADE', hooks: true });
  db.ClassSession.belongsTo(db.Course, { foreignKey: 'courseId' });
}
if (db.Course && db.Enrollment) {
  db.Course.hasMany(db.Enrollment, { foreignKey: 'courseId', onDelete: 'CASCADE', hooks: true });
}
if (db.ClassSession && db.Attendance) {
  db.ClassSession.hasMany(db.Attendance, { foreignKey: 'sessionId', onDelete: 'CASCADE', hooks: true });
}

// ★★★ [추가됨] 공휴일(Holiday) 모델 정의 ★★★
if (!db.Holiday) {
  db.Holiday = sequelize.define('Holiday', {
    name: { 
      type: Sequelize.DataTypes.STRING, 
      allowNull: false 
    },
    date: { 
      type: Sequelize.DataTypes.DATEONLY, 
      allowNull: false, 
      unique: true 
    }
  }, {
    timestamps: false,
    tableName: 'Holidays',
    charset: 'utf8',
    collate: 'utf8_general_ci'
  });
}

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;