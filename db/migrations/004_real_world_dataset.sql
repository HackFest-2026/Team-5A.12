CREATE TABLE IF NOT EXISTS source_datasets (
  id text PRIMARY KEY,
  name text NOT NULL,
  source_url text NOT NULL,
  doi text,
  license text NOT NULL,
  imported_at timestamptz,
  source_row_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retail_transactions (
  dataset_id text NOT NULL REFERENCES source_datasets(id) ON DELETE CASCADE,
  source_row integer NOT NULL,
  invoice_no text NOT NULL,
  stock_code text NOT NULL,
  description text,
  quantity integer NOT NULL,
  source_invoice_at timestamp NOT NULL,
  unit_price_gbp numeric(14,4) NOT NULL,
  customer_ref text,
  country text NOT NULL,
  is_cancellation boolean NOT NULL DEFAULT false,
  PRIMARY KEY (dataset_id, source_row)
);

CREATE INDEX IF NOT EXISTS retail_transactions_invoice_idx
  ON retail_transactions(dataset_id, invoice_no);
CREATE INDEX IF NOT EXISTS retail_transactions_customer_idx
  ON retail_transactions(dataset_id, customer_ref);

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS source_dataset_id text REFERENCES source_datasets(id),
  ADD COLUMN IF NOT EXISTS source_record_id text;
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS source_dataset_id text REFERENCES source_datasets(id),
  ADD COLUMN IF NOT EXISTS source_record_id text;
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS source_dataset_id text REFERENCES source_datasets(id),
  ADD COLUMN IF NOT EXISTS source_record_id text;

CREATE UNIQUE INDEX IF NOT EXISTS customers_source_record_idx
  ON customers(source_dataset_id, source_record_id)
  WHERE source_dataset_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_source_record_idx
  ON invoices(source_dataset_id, source_record_id)
  WHERE source_dataset_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_source_record_idx
  ON payments(source_dataset_id, source_record_id)
  WHERE source_dataset_id IS NOT NULL;
