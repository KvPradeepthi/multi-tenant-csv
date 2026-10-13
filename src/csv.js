const headers = ['id', 'amount', 'sale_date', 'client_name'];

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function salesToCsv(rows) {
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))
  ].join('\n') + '\n';
}

module.exports = { salesToCsv };
