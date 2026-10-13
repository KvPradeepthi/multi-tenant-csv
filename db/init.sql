CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'agent'))
);

CREATE TABLE IF NOT EXISTS sales_records (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  sale_date DATE NOT NULL,
  client_name VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS sales_records_tenant_date_idx
  ON sales_records (tenant_id, sale_date);
CREATE INDEX IF NOT EXISTS sales_records_tenant_agent_idx
  ON sales_records (tenant_id, agent_id);

INSERT INTO tenants (name) VALUES ('Tenant A'), ('Tenant B')
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (tenant_id, email, password_hash, role)
SELECT t.id, seed.email, seed.password_hash, seed.role
FROM tenants t
JOIN (VALUES
  ('Tenant A', 'adminA@example.com', '$2a$10$zB39h7DoCJpP46dRa60LQuWgdBM3aLXz06Ybm9838v5XebVNN10De', 'admin'),
  ('Tenant A', 'agentA@example.com', '$2a$10$zB39h7DoCJpP46dRa60LQuWgdBM3aLXz06Ybm9838v5XebVNN10De', 'agent'),
  ('Tenant A', 'agentA2@example.com', '$2a$10$zB39h7DoCJpP46dRa60LQuWgdBM3aLXz06Ybm9838v5XebVNN10De', 'agent'),
  ('Tenant B', 'adminB@example.com', '$2a$10$zB39h7DoCJpP46dRa60LQuWgdBM3aLXz06Ybm9838v5XebVNN10De', 'admin')
) AS seed(tenant_name, email, password_hash, role) ON seed.tenant_name = t.name
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;

INSERT INTO sales_records (tenant_id, agent_id, amount, sale_date, client_name)
SELECT t.id, u.id, seed.amount, seed.sale_date::date, seed.client_name
FROM (VALUES
  ('Tenant A', 'agentA@example.com', 1500.00, '2026-10-01', 'Tenant A Client'),
  ('Tenant A', 'agentA@example.com', 450.50, '2026-10-02', 'Acme Corp'),
  ('Tenant A', 'agentA2@example.com', 875.25, '2026-10-03', 'Globex Inc'),
  ('Tenant B', 'adminB@example.com', 2200.00, '2026-10-01', 'Tenant B Client'),
  ('Tenant B', 'adminB@example.com', 675.75, '2026-10-04', 'Initech Ltd')
) AS seed(tenant_name, email, amount, sale_date, client_name)
JOIN tenants t ON t.name = seed.tenant_name
JOIN users u ON u.email = seed.email
WHERE NOT EXISTS (
  SELECT 1 FROM sales_records r WHERE r.client_name = seed.client_name
);
