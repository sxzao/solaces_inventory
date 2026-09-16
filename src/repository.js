const { pool } = require('./db');

const categories = {
  TOP: 'Top',
  JKT: 'Jacket',
  DRS: 'Dress',
  BTM: 'Bottom',
  SKT: 'Skirt',
  OTH: 'Other'
};

function daysInStock(encodedAt, now = new Date()) {
  const start = new Date(encodedAt);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function ageGroup(days) {
  if (days <= 14) return 'fresh';
  if (days <= 30) return 'watch';
  return 'stale';
}

function decorate(item) {
  const normalized = {
    itemId: item.itemId,
    category: item.category,
    size: item.size,
    price: Number(item.price),
    status: item.status,
    encodedAt: item.encodedAt,
    soldAt: item.soldAt || null
  };
  const days = daysInStock(normalized.encodedAt);
  return { ...normalized, daysInStock: days, ageGroup: ageGroup(days) };
}

function validateItem(input) {
  const category = String(input.category || '').toUpperCase();
  if (!categories[category]) throw new Error('Choose a valid category');
  const size = String(input.size || '').trim();
  const price = Number(input.price);
  if (!size) throw new Error('Size is required');
  if (!Number.isFinite(price) || price < 0) throw new Error('Price must be a non-negative number');
  return { category, size, price: Math.round(price * 100) / 100 };
}

function dateCode(date) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function mapItem(row) {
  return {
    itemId: row.item_id,
    category: row.category,
    size: row.size_label,
    price: row.price,
    status: row.status,
    encodedAt: row.encoded_at,
    soldAt: row.sold_at
  };
}

function buildFilters(query = {}, params = []) {
  const conditions = [];
  if (query.search) {
    conditions.push('item_id LIKE ?');
    params.push(`%${String(query.search).toLowerCase()}%`);
  }
  if (query.status) {
    conditions.push('status = ?');
    params.push(String(query.status).toUpperCase());
  }
  if (query.category) {
    conditions.push('category = ?');
    params.push(String(query.category).toUpperCase());
  }
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
}

async function createItem(input) {
  const fields = validateItem(input);
  const encodedAt = input.encodedAt ? new Date(input.encodedAt) : new Date();
  if (Number.isNaN(encodedAt.getTime())) throw new Error('Encoded date is invalid');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const code = dateCode(encodedAt);
    const prefix = `${code}-${fields.category}-`;
    const [rows] = await connection.query(
      'SELECT item_id FROM items WHERE item_id LIKE ? ORDER BY item_id DESC LIMIT 1 FOR UPDATE',
      [`${prefix}%`]
    );
    const lastSequence = rows.length ? Number(rows[0].item_id.slice(prefix.length)) : 0;
    const itemId = `${prefix}${String(lastSequence + 1).padStart(3, '0')}`;
    await connection.query(
      "INSERT INTO items (item_id, category, size_label, price, status, encoded_at) VALUES (?, ?, ?, ?, 'UNSOLD', ?)",
      [itemId, fields.category, fields.size, fields.price, encodedAt]
    );
    await connection.commit();
    return decorate({ itemId, ...fields, status: 'UNSOLD', encodedAt, soldAt: null });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listItems(query = {}) {
  const params = [];
  const where = buildFilters({ ...query, status: query.status || 'UNSOLD' }, params);
  const [rows] = await pool.query(`SELECT item_id, category, size_label, price, status, encoded_at, sold_at FROM items ${where} ORDER BY encoded_at DESC`, params);
  const age = String(query.age || '').toLowerCase();
  return rows.map(mapItem).map(decorate).filter((item) => !age || item.ageGroup === age);
}

async function getDashboard(query = {}) {
  const [metricsRows] = await pool.query(`
    SELECT
      COALESCE(SUM(status = 'UNSOLD'), 0) AS unsold_count,
      COALESCE(SUM(CASE WHEN status = 'UNSOLD' THEN price ELSE 0 END), 0) AS unsold_value,
      COALESCE(SUM(status = 'SOLD' AND DATE(sold_at) = CURDATE()), 0) AS sold_today
    FROM items
  `);
  const items = await listItems({ ...query, status: 'UNSOLD' });
  return {
    metrics: {
      unsoldCount: Number(metricsRows[0].unsold_count),
      unsoldValue: Number(metricsRows[0].unsold_value),
      soldToday: Number(metricsRows[0].sold_today),
      staleCount: items.filter((item) => item.ageGroup === 'stale').length
    },
    items,
    categories
  };
}

async function updateStatus(itemId, requestedStatus) {
  const status = String(requestedStatus || '').toUpperCase();
  if (!['UNSOLD', 'SOLD'].includes(status)) throw new Error('Status must be UNSOLD or SOLD');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT item_id, category, size_label, price, status, encoded_at, sold_at FROM items WHERE item_id = ? FOR UPDATE', [itemId]);
    if (!rows.length) throw new Error('Item not found');
    const item = mapItem(rows[0]);
    if (item.status === status) {
      await connection.commit();
      return decorate(item);
    }
    const soldAt = status === 'SOLD' ? new Date() : null;
    await connection.query('UPDATE items SET status = ?, sold_at = ? WHERE item_id = ?', [status, soldAt, itemId]);
    if (status === 'SOLD') {
      await connection.query('INSERT INTO sales (item_id, category, size_label, price, encoded_at, sold_at) VALUES (?, ?, ?, ?, ?, ?)', [itemId, item.category, item.size, item.price, item.encodedAt, soldAt]);
    } else {
      await connection.query('DELETE FROM sales WHERE item_id = ?', [itemId]);
    }
    await connection.commit();
    return decorate({ ...item, status, soldAt });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listSales(query = {}) {
  const params = [];
  const search = String(query.search || '').toLowerCase();
  const where = search ? 'WHERE item_id LIKE ?' : '';
  if (search) params.push(`%${search}%`);
  const [rows] = await pool.query(`SELECT item_id, category, size_label, price, encoded_at, sold_at FROM sales ${where} ORDER BY sold_at DESC`, params);
  return rows.map((row) => ({ ...decorate({ ...mapItem(row), status: 'SOLD' }), soldAt: row.sold_at }));
}

module.exports = { createItem, getDashboard, listItems, listSales, updateStatus };
