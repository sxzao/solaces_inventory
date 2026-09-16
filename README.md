# Solaces Inventory

A lightweight full-stack inventory and item status tracker for Solaces.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000.

Inventory is persisted in MySQL. The API exposes `/api/dashboard`, `/api/items`, and `/api/sales`.

## Connect MySQL Workbench

1. Open MySQL Workbench and run the complete `schema.sql` file. This creates the `solaces_inventory` database and its `items` and `sales` tables.
2. Copy `.env.example` to `.env`.
3. Set `DB_USER`, `DB_PASSWORD`, and any non-default host, port, or database values in `.env`.
4. Run `npm install`, then `npm start`.

The server uses a connection pool and all item creation/status updates are written directly to MySQL. The old `data/inventory.json` file is no longer read by the application.

## Item IDs

New items receive `YYMMDD-CAT-SEQ` IDs such as `260916-JKT-001`. Category codes are `TOP`, `JKT`, `DRS`, `BTM`, `SKT`, and `OTH`.
