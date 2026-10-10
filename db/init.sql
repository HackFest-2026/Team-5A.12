CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE app_role AS ENUM ('cfo', 'manager', 'customer', 'platform_admin');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'overdue', 'partially_paid', 'paid', 'disputed');

CREATE TABLE tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  contact_email text NOT NULL,
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  seat_limit integer NOT NULL DEFAULT 10 CHECK (seat_limit > 0),
  monthly_volume numeric(14,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  company text NOT NULL,
  email text NOT NULL,
  segment text NOT NULL,
  health_score integer NOT NULL CHECK (health_score BETWEEN 0 AND 100),
  credit_limit numeric(14,2) NOT NULL,
  payment_terms integer NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id text PRIMARY KEY,
  tenant_id text REFERENCES tenants(id),
  customer_id text REFERENCES customers(id),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role app_role NOT NULL,
  avatar text NOT NULL,
  password_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoices (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  customer_id text NOT NULL REFERENCES customers(id),
  number text NOT NULL UNIQUE,
  amount numeric(14,2) NOT NULL,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  category text NOT NULL,
  risk_score integer NOT NULL DEFAULT 0,
  reminder_count integer NOT NULL DEFAULT 0,
  last_reminded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payments (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  invoice_id text NOT NULL REFERENCES invoices(id),
  customer_id text NOT NULL REFERENCES customers(id),
  amount numeric(14,2) NOT NULL,
  method text NOT NULL,
  reference text NOT NULL,
  status text NOT NULL,
  paid_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE disputes (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  invoice_id text NOT NULL REFERENCES invoices(id),
  customer_id text NOT NULL REFERENCES customers(id),
  reason text NOT NULL,
  detail text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolution_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id text PRIMARY KEY,
  tenant_id text REFERENCES tenants(id),
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  detail text NOT NULL,
  route text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE approvals (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  title text NOT NULL,
  description text NOT NULL,
  action_type text NOT NULL,
  amount numeric(14,2),
  risk text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_by text NOT NULL,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  tenant_id text,
  actor_name text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  detail text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cashflow_months (
  tenant_id text NOT NULL REFERENCES tenants(id),
  month_start date NOT NULL,
  inflow numeric(14,2) NOT NULL,
  outflow numeric(14,2) NOT NULL,
  forecast numeric(14,2) NOT NULL,
  PRIMARY KEY (tenant_id, month_start)
);

INSERT INTO tenants (id, name, slug, contact_email, plan, status, seat_limit, monthly_volume) VALUES
  ('t1', 'Northstar Labs', 'northstar-labs', 'finance@northstarlabs.in', 'Scale', 'active', 50, 12840000),
  ('t2', 'Bluepeak Retail', 'bluepeak-retail', 'accounts@bluepeak.in', 'Growth', 'active', 20, 4620000),
  ('t3', 'Morrow Health', 'morrow-health', 'admin@morrowhealth.in', 'Starter', 'review', 8, 1780000);

INSERT INTO customers (id, tenant_id, name, company, email, segment, health_score, credit_limit, payment_terms) VALUES
  ('c1', 't1', 'Riya Mehta', 'Acme Retail India', 'riya@acmeretail.in', 'Enterprise', 62, 3500000, 30),
  ('c2', 't1', 'Arjun Rao', 'Kite Logistics', 'arjun@kitelogistics.in', 'Enterprise', 88, 2500000, 30),
  ('c3', 't1', 'Naina Shah', 'Lumon Foods', 'naina@lumonfoods.in', 'Growth', 74, 1200000, 21),
  ('c4', 't1', 'Kabir Jain', 'Orbit Systems', 'kabir@orbitsystems.in', 'Enterprise', 91, 4200000, 45),
  ('c5', 't1', 'Ishita Sen', 'Paperlane Studios', 'ishita@paperlane.co', 'SMB', 80, 650000, 15),
  ('c6', 't1', 'Vikram Das', 'Terra Hospitality', 'vikram@terrahotels.in', 'Growth', 49, 1800000, 30),
  ('c7', 't1', 'Aarav Bhat', 'Fieldnote AI', 'aarav@fieldnote.ai', 'SMB', 94, 800000, 15),
  ('c8', 't1', 'Sana Khan', 'Mosaic Commerce', 'sana@mosaiccommerce.in', 'Growth', 69, 1400000, 30);

INSERT INTO users (id, tenant_id, customer_id, name, email, role, avatar, password_hash) VALUES
  ('u-cfo', 't1', NULL, 'Maya Iyer', 'maya@northstarlabs.in', 'cfo', 'MI', crypt('demo1234', gen_salt('bf'))),
  ('u-manager', 't1', NULL, 'Dev Malhotra', 'dev@northstarlabs.in', 'manager', 'DM', crypt('demo1234', gen_salt('bf'))),
  ('u-customer', 't1', 'c1', 'Riya Mehta', 'riya@acmeretail.in', 'customer', 'RM', crypt('demo1234', gen_salt('bf'))),
  ('u-admin', NULL, NULL, 'Anika Bose', 'anika@cashpilot.app', 'platform_admin', 'AB', crypt('demo1234', gen_salt('bf'))),
  ('u-bluepeak', 't2', NULL, 'Sameer Kulkarni', 'sameer@bluepeak.in', 'cfo', 'SK', crypt('demo1234', gen_salt('bf'))),
  ('u-morrow', 't3', NULL, 'Leena Thomas', 'leena@morrowhealth.in', 'manager', 'LT', crypt('demo1234', gen_salt('bf')));

INSERT INTO invoices (id, tenant_id, customer_id, number, amount, paid_amount, status, issue_date, due_date, category, risk_score, reminder_count) VALUES
  ('i1','t1','c1','INV-2048',1480000,420000,'overdue',CURRENT_DATE-58,CURRENT_DATE-28,'Annual platform',88,2),
  ('i2','t1','c6','INV-2051',860000,0,'overdue',CURRENT_DATE-44,CURRENT_DATE-14,'Implementation',81,1),
  ('i3','t1','c3','INV-2057',620000,120000,'partially_paid',CURRENT_DATE-31,CURRENT_DATE-10,'Usage',64,1),
  ('i4','t1','c2','INV-2062',1250000,1250000,'paid',CURRENT_DATE-25,CURRENT_DATE+5,'Annual platform',8,0),
  ('i5','t1','c4','INV-2068',1980000,0,'sent',CURRENT_DATE-18,CURRENT_DATE+27,'Enterprise expansion',21,0),
  ('i6','t1','c5','INV-2070',285000,0,'sent',CURRENT_DATE-12,CURRENT_DATE+3,'Usage',34,0),
  ('i7','t1','c7','INV-2074',440000,440000,'paid',CURRENT_DATE-10,CURRENT_DATE+5,'Quarterly plan',5,0),
  ('i8','t1','c8','INV-2078',735000,0,'disputed',CURRENT_DATE-21,CURRENT_DATE+9,'Implementation',76,0),
  ('i9','t1','c2','INV-2081',390000,0,'draft',CURRENT_DATE-2,CURRENT_DATE+28,'Usage',12,0),
  ('i10','t1','c1','INV-2084',575000,0,'sent',CURRENT_DATE-4,CURRENT_DATE+26,'Usage',30,0),
  ('i11','t1','c4','INV-2031',1120000,1120000,'paid',CURRENT_DATE-76,CURRENT_DATE-46,'Quarterly plan',4,0),
  ('i12','t1','c3','INV-2038',510000,510000,'paid',CURRENT_DATE-66,CURRENT_DATE-36,'Usage',6,0);

INSERT INTO payments (id, tenant_id, invoice_id, customer_id, amount, method, reference, status, paid_at) VALUES
  ('p1','t1','i1','c1',420000,'Bank transfer','UTR884921','settled',now()-interval '19 days'),
  ('p2','t1','i3','c3',120000,'UPI','UPI-209842','settled',now()-interval '8 days'),
  ('p3','t1','i4','c2',1250000,'Bank transfer','UTR901177','settled',now()-interval '9 days'),
  ('p4','t1','i7','c7',440000,'Card','PAY-441029','settled',now()-interval '4 days'),
  ('p5','t1','i11','c4',1120000,'Bank transfer','UTR809119','settled',now()-interval '50 days'),
  ('p6','t1','i12','c3',510000,'Bank transfer','UTR821410','settled',now()-interval '39 days');

INSERT INTO disputes (id, tenant_id, invoice_id, customer_id, reason, detail, status, resolution_note, reviewed_by, reviewed_at, created_at) VALUES
  ('d1','t1','i8','c8','Scope mismatch','Implementation milestone 3 was billed before acceptance.','under_review','Acceptance documents requested from the delivery team.','Dev Malhotra',now()-interval '1 day',now()-interval '3 days'),
  ('d2','t1','i1','c1','Billing mismatch','The initial payment was not reflected in the first reminder.','resolved','₹4.2L payment matched to UTR884921; the outstanding balance and reminder were corrected.','Dev Malhotra',now()-interval '12 days',now()-interval '15 days');

INSERT INTO approvals (id, tenant_id, title, description, action_type, amount, risk, status, requested_by, created_at) VALUES
  ('a1','t1','Offer payment plan to Acme Retail','Split ₹10.6L outstanding into three instalments to protect the strategic account.','payment_plan',1060000,'medium','pending','Dev Malhotra',now()-interval '3 hours'),
  ('a2','t1','Issue dispute credit','Credit implementation milestone pending acceptance for Mosaic Commerce.','credit_note',185000,'high','pending','Dev Malhotra',now()-interval '1 day'),
  ('a3','t1','Escalate Terra Hospitality','Move account to formal collections after 14 days overdue.','collections',860000,'high','pending','System signal',now()-interval '2 days');

INSERT INTO audit_logs (tenant_id, actor_name, actor_role, action, entity_type, entity_id, detail, created_at) VALUES
  ('t1','Dev Malhotra','manager','sent reminder','invoice','INV-2048','Second collection reminder delivered to Acme Retail India.',now()-interval '6 hours'),
  ('t1','System','system','raised risk signal','customer','c6','Payment risk crossed threshold after invoice became 14 days overdue.',now()-interval '9 hours'),
  ('t1','Riya Mehta','customer','recorded dispute note','invoice','INV-2078','Customer supplied acceptance-document context.',now()-interval '1 day'),
  ('t1','Maya Iyer','cfo','approved action','approval','a4','Approved reminder sequence for high-risk receivables.',now()-interval '2 days');

INSERT INTO notifications (id,tenant_id,user_id,type,title,detail,route,read_at,created_at) VALUES
  ('n1','t1','u-cfo','risk','Cash gap forecast','A ₹18.4L cash gap is projected within 14 days.','/cashflow',NULL,now()-interval '25 minutes'),
  ('n2','t1','u-cfo','approval','Three approvals need review','Payment plans and collections actions are waiting.','/approvals',NULL,now()-interval '2 hours'),
  ('n3','t1','u-manager','case','Dispute awaiting review','Mosaic Commerce submitted context for INV-2078.','/disputes',NULL,now()-interval '45 minutes'),
  ('n4','t1','u-manager','collection','Invoice risk increased','Terra Hospitality is now 14 days overdue.','/invoices',NULL,now()-interval '4 hours'),
  ('n5','t1','u-customer','invoice','Invoice due soon','INV-2084 is due within the next 30 days.','/invoices',NULL,now()-interval '1 day'),
  ('n6',NULL,'u-admin','tenant','Tenant requires review','Morrow Health onboarding is waiting for platform review.','/tenants',NULL,now()-interval '3 hours');

INSERT INTO cashflow_months (tenant_id, month_start, inflow, outflow, forecast)
SELECT 't1', date_trunc('month', CURRENT_DATE)::date - (n || ' month')::interval,
       (ARRAY[3820000,4280000,3970000,5120000,4680000,4210000])[6-n],
       (ARRAY[2980000,3160000,3250000,3390000,3510000,3650000])[6-n],
       (ARRAY[920000,1180000,1040000,1560000,1310000,730000])[6-n]
FROM generate_series(0,5) AS n;

CREATE INDEX invoices_tenant_status_idx ON invoices(tenant_id, status);
CREATE INDEX invoices_customer_idx ON invoices(customer_id);
CREATE INDEX audit_tenant_created_idx ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX sessions_token_idx ON sessions(token_hash);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE INDEX users_tenant_idx ON users(tenant_id);
CREATE INDEX notifications_user_created_idx ON notifications(user_id, created_at DESC);
