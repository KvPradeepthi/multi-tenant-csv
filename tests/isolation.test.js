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
});