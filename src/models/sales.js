const { query } = require('../db');

async function findForExport({ tenantId, userId, role }) {
  const params = [tenantId];
  let sql = `
    SELECT id, amount::text AS amount, sale_date::text AS sale_date, client_name
    FROM sales_records
    WHERE tenant_id = $1
  `;

  if (role === 'agent') {
    params.push(userId);
    sql += ' AND agent_id = $2';
  }

  sql += ' ORDER BY sale_date ASC, id ASC';
  const result = await query(sql, params);
  return result.rows;
}

module.exports = { findForExport };
