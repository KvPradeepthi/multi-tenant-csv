const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.dbPoolMax,
  ssl: process.env.NODE_ENV === 'production' && process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined
});

function query(text, values) {
  return pool.query(text, values);
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, close };
