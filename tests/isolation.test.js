const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const config = require('../src/config');
const { close } = require('../src/db');

async function login(email, password = 'secret123') {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token;
}

function csvRows(text) {
  const [, ...lines] = text.trim().split('\n');
  return lines.map((line) => line.split(','));
}

describe('multi-tenant sales export', () => {
  afterAll(async () => {
    await close();
  });

  test('login returns tenant and role claims', async () => {
    const token = await login('adminA@example.com');
    const claims = jwt.verify(token, config.jwtSecret);
    expect(claims).toEqual(expect.objectContaining({
      userId: expect.any(Number),
      tenantId: expect.any(Number),
      role: 'admin'
    }));
  });

  test('invalid credentials and malformed tokens are rejected', async () => {
    await expect(request(app).post('/api/auth/login')
      .send({ email: 'missing@example.com', password: 'bad' }))
      .resolves.toMatchObject({ status: 401 });
    await expect(request(app).get('/api/reports/sales'))
      .resolves.toMatchObject({ status: 401 });
    await expect(request(app).get('/api/reports/sales')
      .set('Authorization', 'Bearer malformed'))
      .resolves.toMatchObject({ status: 401 });
  });

  test('tenant isolation: Tenant A admin cannot export Tenant B records', async () => {
    const token = await login('adminA@example.com');
    const response = await request(app)
      .get('/api/reports/sales?tenant_id=2')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/csv/);
    expect(response.headers['content-disposition']).toBe('attachment; filename="sales_report.csv"');
    expect(response.text.split('\n')[0]).toBe('id,amount,sale_date,client_name');
    expect(response.text).toContain('Tenant A Client');
    expect(response.text).not.toContain('Tenant B Client');
    expect(response.text).not.toContain('Initech Ltd');
  });

  test('admin receives all records in their tenant', async () => {
    const token = await login('adminA@example.com');
    const response = await request(app).get('/api/reports/sales')
      .set('Authorization', `Bearer ${token}`);
    const rows = csvRows(response.text);
    expect(response.status).toBe(200);
    expect(rows).toHaveLength(3);
  });

  test('agent receives only records assigned to that agent', async () => {
    const token = await login('agentA@example.com');
    const response = await request(app).get('/api/reports/sales')
      .set('Authorization', `Bearer ${token}`);
    const rows = csvRows(response.text);
    expect(response.status).toBe(200);
    expect(rows).toHaveLength(2);
    expect(response.text).toContain('Tenant A Client');
    expect(response.text).not.toContain('Globex Inc');
  });

  test('Tenant B admin receives only Tenant B records and cannot see Tenant A data', async () => {
    const token = await login('adminB@example.com');
    const response = await request(app).get('/api/reports/sales?tenant_id=1')
      .set('Authorization', `Bearer ${token}`);
    const rows = csvRows(response.text);
    expect(response.status).toBe(200);
    expect(rows).toHaveLength(2);
    expect(response.text).toContain('Tenant B Client');
    expect(response.text).toContain('Initech Ltd');
    expect(response.text).not.toContain('Tenant A Client');
    expect(response.text).not.toContain('Acme Corp');
    expect(response.text).not.toContain('Globex Inc');
  });

  test('agent query parameter override attempt is ignored', async () => {
    const token = await login('agentA@example.com');
    const response = await request(app)
      .get('/api/reports/sales?tenant_id=2&agent_id=999')
      .set('Authorization', `Bearer ${token}`);
    const rows = csvRows(response.text);
    expect(response.status).toBe(200);
    expect(rows).toHaveLength(2);
    expect(response.text).toContain('Tenant A Client');
    expect(response.text).not.toContain('Globex Inc');
    expect(response.text).not.toContain('Tenant B Client');
  });

  test('expired and invalid signature tokens are rejected with 401', async () => {
    const expiredToken = jwt.sign(
      { userId: 1, tenantId: 1, role: 'admin' },
      config.jwtSecret,
      { expiresIn: '-1s' }
    );
    await expect(request(app).get('/api/reports/sales')
      .set('Authorization', `Bearer ${expiredToken}`))
      .resolves.toMatchObject({ status: 401 });

    const badSecretToken = jwt.sign(
      { userId: 1, tenantId: 1, role: 'admin' },
      'wrong-secret-key-that-does-not-match'
    );
    await expect(request(app).get('/api/reports/sales')
      .set('Authorization', `Bearer ${badSecretToken}`))
      .resolves.toMatchObject({ status: 401 });

    const invalidClaimsToken = jwt.sign(
      { userId: 1 },
      config.jwtSecret
    );
    await expect(request(app).get('/api/reports/sales')
      .set('Authorization', `Bearer ${invalidClaimsToken}`))
      .resolves.toMatchObject({ status: 401 });
  });

  test('CSV escaping correctly handles commas, quotes, and newlines', () => {
    const { salesToCsv } = require('../src/csv');
    const testRecords = [
      { id: 1, amount: '100.00', sale_date: '2026-10-01', client_name: 'Regular Client' },
      { id: 2, amount: '200.00', sale_date: '2026-10-02', client_name: 'Acme, Inc.' },
      { id: 3, amount: '300.00', sale_date: '2026-10-03', client_name: 'Say "Hello" Corp' },
      { id: 4, amount: '400.00', sale_date: '2026-10-04', client_name: 'Line 1\nLine 2 Ltd' },
    ];
    const csvOutput = salesToCsv(testRecords);
    expect(csvOutput).toContain('id,amount,sale_date,client_name\n');
    expect(csvOutput).toContain('1,100.00,2026-10-01,Regular Client\n');
    expect(csvOutput).toContain('2,200.00,2026-10-02,"Acme, Inc."\n');
    expect(csvOutput).toContain('3,300.00,2026-10-03,"Say ""Hello"" Corp"\n');
    expect(csvOutput).toContain('4,400.00,2026-10-04,"Line 1\nLine 2 Ltd"\n');
  });

  test('malformed JSON in login request returns 400 Bad Request', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{invalid-json');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Malformed JSON payload' });
  });
});
