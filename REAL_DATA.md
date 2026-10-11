# Real-world data seed

CashPilot can ingest the [UCI Online Retail dataset](https://archive.ics.uci.edu/dataset/352/online+retail), a CC BY 4.0 dataset of 541,909 real transaction lines from a UK non-store retailer between December 2010 and December 2011.

## Why this dataset

- Real commercial transactions rather than generated fixtures.
- 541,909 line items, roughly 26,000 invoices, and thousands of customer IDs.
- Invoice number, timestamp, customer ID, item, quantity, unit price, and country map cleanly to CashPilot.
- CC BY 4.0 permits reuse and adaptation with attribution.
- Stable UCI page, DOI `10.24432/C5BW33`, and a published case-study pedigree.

The source does **not** contain contractual due dates, payment dates, contact names, emails, credit limits, or payment risk. The importer does not describe those fields as observed data.

## Import

Start PostgreSQL and apply migrations, then run:

```bash
npm run db:up
npm run db:migrate
npm run db:seed:real
```

The first run downloads the official workbook into the gitignored `data/` directory. The complete source is loaded into `retail_transactions`; the default UI-facing projection loads the 5,000 newest valid invoices into tenant `t1` so the current unpaginated API remains responsive.

Options can be passed after `--`:

```bash
npm run db:seed:real -- --app-limit 10000 --fx-gbp-inr 100 --tenant t1
npm run db:seed:real -- --raw-only
npm run db:seed:real -- --project-only --app-limit 5000
npm run db:seed:real -- --source /absolute/path/Online\ Retail.xlsx
```

## Provenance and transformations

The raw table preserves every source value in GBP. Product-facing records are an explicit demo projection:

- line items are aggregated by source invoice number;
- rows without a customer ID and cancellation documents are retained in raw storage but omitted from the UI projection;
- source customer IDs remain pseudonymous, with `.invalid` placeholder emails;
- due date is derived as invoice date plus 30 days;
- a completed non-cancellation retail transaction is represented as paid, with payment time set to the source invoice date because payment timing is absent;
- GBP amounts are converted to INR using the configurable import rate (default `100`) because CashPilot is INR-only;
- health score, segment, and credit limit are demo-derived values, not source observations.

These rules are also recorded in `source_datasets.metadata`, and every projected customer, invoice, and payment carries its source dataset and source record ID.

## Attribution

Chen, D. (2015). *Online Retail* [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5BW33. Licensed under CC BY 4.0.
