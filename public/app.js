const state = { role: 'ADMIN', items: [], sales: [], filters: { search: '', category: '', age: '' } };
const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(value);
const manilaTimeZone = 'Asia/Manila';
const date = (value) => new Intl.DateTimeFormat('en-PH', { timeZone: manilaTimeZone, month: 'short', day: 'numeric', year: 'numeric' }).format(parseManilaDate(value));
const dateTime = (value) => new Intl.DateTimeFormat('en-PH', { timeZone: manilaTimeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parseManilaDate(value));
const pageTitles = { dashboard: 'Dashboard', encode: 'Encode item', stock: 'Unsold stock', sales: 'Sales log' };

function parseManilaDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?)?$/.test(value)) {
    return new Date(`${value.replace(' ', 'T')}+08:00`);
  }
  return new Date(value);
}

function manilaTimestamp(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: manilaTimeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(parseManilaDate(value));
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+08:00`;
}

function updateManilaClock() {
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-PH', {
    timeZone: manilaTimeZone, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  }).format(now).toUpperCase();
  const time = new Intl.DateTimeFormat('en-PH', {
    timeZone: manilaTimeZone, hour: 'numeric', minute: '2-digit', hour12: true
  }).format(now);
  $('#today-label').textContent = `${today} | ${time} PHT`;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.message || 'Something went wrong');
  return body;
}

async function setRole(role) {
  state.role = role;
  localStorage.setItem('solaces-role', role);
  document.querySelectorAll('[data-role-mode]').forEach((button) => {
    const selected = button.dataset.roleMode === role;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.querySelectorAll('[data-role="admin"]').forEach((item) => { item.hidden = role !== 'ADMIN'; });
  const currentPage = document.querySelector('.page-view:not([hidden])')?.dataset.page;
  const page = role === 'STAFF' && ['dashboard', 'sales'].includes(currentPage)
    ? 'stock'
    : (currentPage || (role === 'ADMIN' ? 'dashboard' : 'encode'));
  await showView(page);
}

async function showView(view) {
  if (view === 'dashboard' || view === 'sales') {
    if (state.role !== 'ADMIN') return;
  }
  document.querySelectorAll('[data-view].nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  document.querySelectorAll('.page-view').forEach((page) => { page.hidden = page.dataset.page !== view; });
  $('#page-title').textContent = pageTitles[view];
  try {
    if (view === 'dashboard') await loadDashboard();
    if (view === 'stock') await loadItems();
    if (view === 'sales') await loadSales();
  } catch (error) {
    showToast(error.message);
  }
}

async function loadDashboard() {
  const data = await request('/api/dashboard');
  $('#unsold-count').textContent = data.metrics.unsoldCount;
  $('#unsold-value').textContent = money(data.metrics.unsoldValue);
  $('#sold-today').textContent = data.metrics.soldToday;
  $('#stale-count').textContent = data.metrics.staleCount;
}

async function loadItems() {
  const params = new URLSearchParams(state.filters);
  state.items = await request(`/api/items?${params}`);
  renderItems();
}

function renderItems() {
  const rows = $('#inventory-rows');
  $('#empty-state').hidden = state.items.length !== 0;
  rows.innerHTML = state.items.map((item) => `<tr><td><span class="item-id">${escapeHtml(item.itemId)}</span></td><td class="category">${escapeHtml(categoryName(item.category))}</td><td>${escapeHtml(item.size)}</td><td class="price">${money(item.price)}</td><td><span class="age-badge ${item.ageGroup}"><i class="dot ${item.ageGroup}"></i>${item.daysInStock} day${item.daysInStock === 1 ? '' : 's'}</span></td><td class="subtle">${date(item.encodedAt)}</td><td><button class="action-button" data-sold="${escapeHtml(item.itemId)}">Mark sold</button></td></tr>`).join('');
  rows.querySelectorAll('[data-sold]').forEach((button) => button.addEventListener('click', () => markSold(button.dataset.sold)));
}

function categoryName(code) { return ({ TOP: 'Top', JKT: 'Jacket', DRS: 'Dress', BTM: 'Bottom', SKT: 'Skirt', OTH: 'Other' })[code] || code; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }

async function markSold(itemId) {
  if (!window.confirm(`Mark ${itemId} as sold?`)) return;
  try {
    await request(`/api/items/${encodeURIComponent(itemId)}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'SOLD' }) });
    showToast(`${itemId} moved to sales log`);
    await loadItems();
    if (state.role === 'ADMIN') await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

async function loadSales() {
  const search = encodeURIComponent($('#sales-search').value);
  state.sales = await request(`/api/sales?search=${search}`);
  $('#export-sales').disabled = state.sales.length === 0;
  $('#sales-empty').hidden = state.sales.length !== 0;
  $('#sales-rows').innerHTML = state.sales.map((sale) => `<tr><td><span class="item-id">${escapeHtml(sale.itemId)}</span></td><td class="category">${escapeHtml(categoryName(sale.category))}</td><td>${escapeHtml(sale.size)}</td><td class="price">${money(sale.price)}</td><td class="subtle">${dateTime(sale.soldAt)}</td><td><button class="action-button" data-unsold="${escapeHtml(sale.itemId)}">Undo sale</button></td></tr>`).join('');
  $('#sales-rows').querySelectorAll('[data-unsold]').forEach((button) => button.addEventListener('click', () => markUnsold(button.dataset.unsold)));
}

function csvCell(value, protectFormula = false) {
  let text = String(value ?? '');
  if (protectFormula && /^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadSalesCsv() {
  if (state.role !== 'ADMIN' || state.sales.length === 0) return;
  const columns = ['Item ID', 'Category', 'Size', 'Price (PHP)', 'Encoded At', 'Sold At'];
  const rows = state.sales.map((sale) => [
    csvCell(sale.itemId, true), csvCell(categoryName(sale.category), true), csvCell(sale.size, true),
    csvCell(Number(sale.price).toFixed(2)), csvCell(manilaTimestamp(sale.encodedAt)), csvCell(manilaTimestamp(sale.soldAt))
  ]);
  const csv = `\uFEFF${[columns.map((column) => csvCell(column)).join(','), ...rows.map((row) => row.join(','))].join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `solaces-sales-archive-${todayCode()}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showToast(`Exported ${state.sales.length} sales records`);
}

async function markUnsold(itemId) {
  if (!window.confirm(`Return ${itemId} to active inventory?`)) return;
  try {
    await request(`/api/items/${encodeURIComponent(itemId)}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'UNSOLD' }) });
    showToast(`${itemId} returned to unsold stock`);
    await Promise.all([loadSales(), loadItems(), loadDashboard()]);
  } catch (error) {
    showToast(error.message);
  }
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2800);
}

function todayCode() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: manilaTimeZone, year: '2-digit', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

function updatePreview() {
  $('#id-preview-value').textContent = `${todayCode()}-${$('select[name="category"]').value}-001`;
}

async function refreshCurrentPage() {
  const view = document.querySelector('.page-view:not([hidden])')?.dataset.page;
  if (view) await showView(view);
  showToast('Page refreshed');
}

$('.nav-tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]');
  if (button) showView(button.dataset.view);
});
$('.dashboard-links').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]');
  if (button) showView(button.dataset.view);
});
$('#refresh-button').addEventListener('click', refreshCurrentPage);
document.querySelectorAll('[data-role-mode]').forEach((button) => button.addEventListener('click', () => setRole(button.dataset.roleMode)));
$('select[name="category"]').addEventListener('change', updatePreview);
$('#search-input').addEventListener('input', (event) => { state.filters.search = event.target.value; loadItems().catch((error) => showToast(error.message)); });
$('#category-filter').addEventListener('change', (event) => { state.filters.category = event.target.value; loadItems().catch((error) => showToast(error.message)); });
$('#age-filter').addEventListener('change', (event) => { state.filters.age = event.target.value; loadItems().catch((error) => showToast(error.message)); });
$('#sales-search').addEventListener('input', () => loadSales().catch((error) => showToast(error.message)));
$('#export-sales').addEventListener('click', downloadSalesCsv);

$('#encode-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#form-error').textContent = '';
  const form = new FormData(event.target);
  try {
    const item = await request('/api/items', { method: 'POST', body: JSON.stringify({ category: form.get('category'), size: form.get('size'), price: form.get('price') }) });
    event.target.reset();
    updatePreview();
    showToast(`${item.itemId} added to inventory`);
    await showView('stock');
    if (state.role === 'ADMIN') await loadDashboard();
  } catch (error) {
    $('#form-error').textContent = error.message;
  }
});

updatePreview();
updateManilaClock();
window.setInterval(updateManilaClock, 60_000);
setRole(localStorage.getItem('solaces-role') === 'STAFF' ? 'STAFF' : 'ADMIN');