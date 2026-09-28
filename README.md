# Solaces Inventory

A lightweight full-stack inventory and item status tracker for Solaces.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:3000.

Inventory is persisted in MySQL. The API exposes `/api/dashboard`, `/api/items`, and `/api/sales`.

## Environment variables

Create a `.env` file in the project root with your database connection settings:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=solaces_inventory
PORT=3000
```

For deployment, replace the local values with the host values provided by your hosting platform, such as Railway.

## Connect MySQL Workbench

1. Open MySQL Workbench and run the complete `schema.sql` file. This creates the `solaces_inventory` database and its `items` and `sales` tables.
2. Set `DB_USER`, `DB_PASSWORD`, and any non-default host, port, or database values in `.env`.
3. Run `npm install`, then `npm start`.

The server uses a connection pool and all item creation/status updates are written directly to MySQL.

## Deploy to Railway

1. Push this repository to GitHub.
2. Create a Railway project and add a MySQL database service.
3. Copy the Railway MySQL connection values into the app environment variables:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_USER`
   - `DB_PASSWORD`
   - `DB_NAME`
4. Run `schema.sql` in the Railway database if needed.
5. Deploy the app service.

Use the Railway internal host value such as `mysql.railway.internal` for `DB_HOST`, not `localhost`, when the app is hosted on the internet.

## Item IDs

New items receive `YYMMDD-CAT-SEQ` IDs such as `260916-JKT-001`. Category codes are `TOP`, `JKT`, `DRS`, `BTM`, `SKT`, and `OTH`.
