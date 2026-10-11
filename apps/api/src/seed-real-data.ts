import "./config.js";
import { createWriteStream } from "node:fs";
import { access, mkdir } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ExcelJS from "exceljs";
import { db } from "./db.js";

const execFileAsync = promisify(execFile);
const DATASET_ID = "uci-online-retail-352";
const SOURCE_URL =
  "https://archive.ics.uci.edu/static/public/352/online%2Bretail.zip";
const DOI = "10.24432/C5BW33";
const DEFAULT_XLSX = resolve("data/uci-online-retail/Online Retail.xlsx");
const DEFAULT_ZIP = resolve("data/uci-online-retail/online-retail.zip");

type Args = {
  source: string;
  tenantId: string;
  fxRate: number;
  appLimit: number;
  rawOnly: boolean;
  projectOnly: boolean;
};

function parseArgs(): Args {
  const values = process.argv.slice(2);
  const read = (name: string, fallback: string) => {
    const index = values.indexOf(name);
    return index === -1 ? fallback : values[index + 1] ?? fallback;
  };
  const args = {
    source: resolve(read("--source", DEFAULT_XLSX)),
    tenantId: read("--tenant", "t1"),
    fxRate: Number(read("--fx-gbp-inr", "100")),
    appLimit: Number(read("--app-limit", "5000")),
    rawOnly: values.includes("--raw-only"),
    projectOnly: values.includes("--project-only"),
  };
  if (!Number.isFinite(args.fxRate) || args.fxRate <= 0)
    throw new Error("--fx-gbp-inr must be a positive number");
  if (!Number.isInteger(args.appLimit) || args.appLimit < 0)
    throw new Error("--app-limit must be a non-negative integer");
  return args;
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureWorkbook(source: string) {
  if (await exists(source)) return;
  if (source !== DEFAULT_XLSX) {
    throw new Error(`Workbook not found: ${source}`);
  }
  await mkdir(dirname(DEFAULT_XLSX), { recursive: true });
  console.log(`Downloading ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok || !response.body)
    throw new Error(`Dataset download failed: ${response.status}`);
  await pipeline(response.body as any, createWriteStream(DEFAULT_ZIP));
  await execFileAsync("unzip", ["-o", DEFAULT_ZIP, "-d", dirname(DEFAULT_XLSX)]);
  if (!(await exists(DEFAULT_XLSX)))
    throw new Error(`Expected ${basename(DEFAULT_XLSX)} in the UCI archive`);
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value && "text" in value)
    return String((value as { text: unknown }).text);
  return String(value).trim();
}

function excelDate(value: unknown) {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    return new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid invoice date: ${value}`);
  return parsed;
}

async function insertBatch(client: any, rows: unknown[][]) {
  if (!rows.length) return;
  const columns = 11;
  const params = rows.flat();
  const values = rows
    .map(
      (_, row) =>
        `(${Array.from({ length: columns }, (_unused, col) => `$${row * columns + col + 1}`).join(",")})`,
    )
    .join(",");
  await client.query(
    `INSERT INTO retail_transactions
      (dataset_id,source_row,invoice_no,stock_code,description,quantity,
       source_invoice_at,unit_price_gbp,customer_ref,country,is_cancellation)
     VALUES ${values}`,
    params,
  );
}

async function importRaw(source: string) {
  const client = await db.connect();
  let imported = 0;
  try {
    await client.query(
      `INSERT INTO source_datasets
        (id,name,source_url,doi,license,metadata)
       VALUES ($1,$2,$3,$4,'CC BY 4.0',$5::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         name=EXCLUDED.name,source_url=EXCLUDED.source_url,doi=EXCLUDED.doi,
         license=EXCLUDED.license,metadata=EXCLUDED.metadata,
         imported_at=NULL,source_row_count=0`,
      [
        DATASET_ID,
        "UCI Online Retail",
        SOURCE_URL,
        DOI,
        JSON.stringify({
          publisher: "UCI Machine Learning Repository",
          sourceCurrency: "GBP",
          observedPeriod: "2010-12-01 to 2011-12-09",
          importer: "apps/api/src/seed-real-data.ts",
        }),
      ],
    );
    await client.query(`DELETE FROM retail_transactions WHERE dataset_id=$1`, [
      DATASET_ID,
    ]);

    const workbook = new ExcelJS.stream.xlsx.WorkbookReader(source, {
      entries: "emit",
      sharedStrings: "cache",
      hyperlinks: "ignore",
      styles: "cache",
      worksheets: "emit",
    });
    let batch: unknown[][] = [];
    for await (const worksheet of workbook) {
      for await (const row of worksheet) {
        if (row.number === 1) continue;
        const values = row.values as unknown[];
        const invoiceNo = cellText(values[1]);
        const stockCode = cellText(values[2]);
        const description = cellText(values[3]) || null;
        const quantity = Number(values[4]);
        const invoiceAt = excelDate(values[5]);
        const unitPrice = Number(values[6]);
        const customerRef = cellText(values[7]) || null;
        const country = cellText(values[8]);
        if (
          !invoiceNo ||
          !stockCode ||
          !Number.isFinite(quantity) ||
          !Number.isFinite(unitPrice) ||
          !country
        ) {
          throw new Error(`Invalid source row ${row.number}`);
        }
        batch.push([
          DATASET_ID,
          row.number,
          invoiceNo,
          stockCode,
          description,
          quantity,
          invoiceAt,
          unitPrice,
          customerRef,
          country,
          /^c/i.test(invoiceNo),
        ]);
        if (batch.length === 500) {
          await insertBatch(client, batch);
          imported += batch.length;
          batch = [];
          if (imported % 25_000 === 0)
            console.log(`Imported ${imported.toLocaleString()} source rows`);
        }
      }
    }
    await insertBatch(client, batch);
    imported += batch.length;
    await client.query(
      `UPDATE source_datasets
       SET imported_at=now(),source_row_count=$2
       WHERE id=$1`,
      [DATASET_ID, imported],
    );
    console.log(`Imported ${imported.toLocaleString()} source rows in total`);
  } finally {
    client.release();
  }
  return imported;
}

async function projectIntoCashPilot(args: Args) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const tenant = await client.query(`SELECT id FROM tenants WHERE id=$1`, [
      args.tenantId,
    ]);
    if (!tenant.rowCount) throw new Error(`Unknown tenant: ${args.tenantId}`);
    const source = await client.query<{ source_row_count: number }>(
      `SELECT source_row_count FROM source_datasets WHERE id=$1`,
      [DATASET_ID],
    );
    if (!source.rowCount || Number(source.rows[0].source_row_count) === 0)
      throw new Error("Raw UCI data is not loaded; run without --project-only first");

    await client.query(`DELETE FROM payments WHERE source_dataset_id=$1`, [
      DATASET_ID,
    ]);
    await client.query(`DELETE FROM invoices WHERE source_dataset_id=$1`, [
      DATASET_ID,
    ]);
    await client.query(`DELETE FROM customers WHERE source_dataset_id=$1`, [
      DATASET_ID,
    ]);
    await client.query(
      `CREATE TEMP TABLE selected_uci_invoices ON COMMIT DROP AS
       SELECT invoice_no,
              max(customer_ref) customer_ref,
              max(country) country,
              min(source_invoice_at)::date issue_date,
              round(sum(quantity * unit_price_gbp),2) amount_gbp
       FROM retail_transactions
       WHERE dataset_id=$1 AND NOT is_cancellation AND customer_ref IS NOT NULL
       GROUP BY invoice_no
       HAVING sum(quantity * unit_price_gbp) > 0
       ORDER BY min(source_invoice_at) DESC, invoice_no DESC
       LIMIT $2`,
      [DATASET_ID, args.appLimit],
    );
    const selected = await client.query<{ count: number }>(
      `SELECT count(*)::int count FROM selected_uci_invoices`,
    );
    const projectedCount = Number(selected.rows[0].count);
    await client.query(
      `INSERT INTO customers
        (id,tenant_id,name,company,email,segment,health_score,credit_limit,
         payment_terms,source_dataset_id,source_record_id)
       SELECT 'uci-c-' || customer_ref,
              $2,
              'Customer ' || customer_ref,
              'Retail customer ' || customer_ref || ' · ' || max(country),
              'uci-' || customer_ref || '@example.invalid',
              CASE
                WHEN sum(amount_gbp) >= 5000 THEN 'Enterprise'
                WHEN sum(amount_gbp) >= 1000 THEN 'Growth'
                ELSE 'SMB'
              END,
              80,
              round(greatest(max(amount_gbp) * $3 * 3,10000),2),
              30,$1,customer_ref
       FROM selected_uci_invoices
       GROUP BY customer_ref`,
      [DATASET_ID, args.tenantId, args.fxRate],
    );
    await client.query(
      `INSERT INTO invoices
        (id,tenant_id,customer_id,number,amount,paid_amount,status,issue_date,
         due_date,category,risk_score,source_dataset_id,source_record_id)
       SELECT 'uci-i-' || lower(invoice_no),$2,'uci-c-' || customer_ref,
              'UCI-' || invoice_no,round(amount_gbp * $3,2),
              round(amount_gbp * $3,2),'paid',issue_date,issue_date + 30,
              'Retail transaction · ' || country,0,$1,invoice_no
       FROM selected_uci_invoices`,
      [DATASET_ID, args.tenantId, args.fxRate],
    );
    await client.query(
      `INSERT INTO payments
        (id,tenant_id,invoice_id,customer_id,amount,method,reference,status,
         paid_at,source_dataset_id,source_record_id)
       SELECT 'uci-p-' || lower(invoice_no),$2,'uci-i-' || lower(invoice_no),
              'uci-c-' || customer_ref,round(amount_gbp * $3,2),
              'Source retail sale','UCI-' || invoice_no,'settled',
              issue_date::timestamptz,$1,invoice_no
       FROM selected_uci_invoices`,
      [DATASET_ID, args.tenantId, args.fxRate],
    );
    await client.query(
      `INSERT INTO audit_logs
        (tenant_id,actor_name,actor_role,action,entity_type,entity_id,detail)
       VALUES ($1,'Dataset importer','system','imported real-world dataset',
         'dataset',$2,$3)`,
      [
        args.tenantId,
        DATASET_ID,
        `Projected ${projectedCount} UCI invoices using GBP→INR ${args.fxRate} and documented assumptions.`,
      ],
    );
    await client.query(
      `UPDATE source_datasets
       SET metadata = metadata || jsonb_build_object(
         'projection',jsonb_build_object(
           'tenantId',$2::text,
           'invoiceCount',$3::int,
           'gbpToInrRate',$4::numeric,
           'dueDateRule','source invoice date + 30 days',
           'paymentRule','completed non-cancellation retail sale represented as paid',
           'projectedAt',now()
         )
       )
       WHERE id=$1`,
      [DATASET_ID, args.tenantId, projectedCount, args.fxRate],
    );
    await client.query("COMMIT");
    console.log(
      `Projected ${projectedCount.toLocaleString()} invoices into tenant ${args.tenantId}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const args = parseArgs();
  if (!args.projectOnly) {
    await ensureWorkbook(args.source);
    await importRaw(args.source);
  }
  if (!args.rawOnly) await projectIntoCashPilot(args);
}

main()
  .then(() => db.end())
  .catch(async (error) => {
    console.error(error);
    await db.end();
    process.exitCode = 1;
  });
