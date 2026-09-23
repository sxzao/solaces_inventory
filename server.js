require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const repository = require('./src/repository');
const { checkConnection } = require('./src/db');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'solaces-inventory' });
});

app.get('/api/dashboard', async (req, res) => {
  try {
    res.json(await repository.getDashboard(req.query));
  } catch (error) {
    res.status(503).json({ message: 'Database unavailable. Check your MySQL connection settings.' });
  }
});

app.get('/api/items', async (req, res) => {
  try {
    res.json(await repository.listItems(req.query));
  } catch (error) {
    res.status(503).json({ message: 'Database unavailable. Check your MySQL connection settings.' });
  }
});

app.post('/api/items', async (req, res) => {
  try {
    const item = await repository.createItem(req.body);
    res.status(201).json(item);
  } catch (error) {
    const status = error.code === 'ECONNREFUSED' || error.code === 'ER_BAD_DB_ERROR' ? 503 : 400;
    res.status(status).json({ message: status === 503 ? 'Database unavailable. Check your MySQL connection settings.' : error.message });
  }
});

app.patch('/api/items/:id/status', async (req, res) => {
  try {
    const item = await repository.updateStatus(req.params.id, req.body.status);
    res.json(item);
  } catch (error) {
    const status = error.message === 'Item not found' ? 404 : (error.code === 'ECONNREFUSED' ? 503 : 400);
    res.status(status).json({ message: error.message });
  }
});

app.get('/api/sales', async (req, res) => {
  try {
    res.json(await repository.listSales(req.query));
  } catch (error) {
    res.status(503).json({ message: 'Database unavailable. Check your MySQL connection settings.' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Solaces Inventory running at http://localhost:${PORT}`);
  checkConnection()
    .then(() => console.log('MySQL connection established'))
    .catch(() => console.error('MySQL connection unavailable. Run schema.sql and check your .env settings.'));
});