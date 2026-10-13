const { query } = require('../db');

async function findByEmail(email) {
  const result = await query(
    'SELECT id, tenant_id, email, password_hash, role FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

module.exports = { findByEmail };