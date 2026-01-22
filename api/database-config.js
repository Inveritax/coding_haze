// Database configuration module - PostgreSQL only
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Database = require('./database');
console.log('Using PostgreSQL database');

module.exports = {
  getDatabase: () => Database,
  isPostgres: () => true,

  getInstance: async () => {
    const db = new Database();
    await db.initializeTables();
    return db;
  }
};

module.exports.PostgresDatabase = Database;
