const state = { items: [], filters: { search: '', category: '', age: '' } };
const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(value);
const date = (value) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const dateTime = (value) => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));

async function request(url, options) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'Something went wrong');
  return body;
}

async function loadDashboard() {
  const params = new URLSearchParams(state.filters);
  const data = await request(`/api/dashboard?${params}`);
  state.items = data.items;
  $('#unsold-count').textContent = data.metrics.unsoldCount;
  $('#unsold-value').textContent = money(data.metrics.unsoldValue);
  $('#sold-today').textContent = data.metrics.soldToday;
  $('#stale-count').textContent = data.metrics.staleCount;
  renderItems();
}

function renderItems() {
  const rows = $('#inventory-rows');
  $('#empty-state').hidden = state.items.length !== 0;
  rows.innerHTML = state.items.map((item) => `<tr><td><span class="item-id">${item.itemId}</span></td><td class="category">${categoryName(item.category)}</td><td>${item.size}</td><td class="price">${money(item.price)}</td><td><span class="age-badge ${item.ageGroup}"><i class="dot ${item.ageGroup}"></i>${item.daysInStock} day${item.daysInStock === 1 ? '' : 's'}</span></td><td class="subtle">${date(item.encodedAt)}</td><td><button class="action-button" data-sold="${item.itemId}">Mark sold</button></td></tr>`).join('');
  rows.querySelectorAll('[data-sold]').forEach((button) => button.addEventListener('click', () => markSold(button.dataset.sold)));
}

function categoryName(code) { return ({ TOP: 'Top', JKT: 'Jacket', DRS: 'Dress', BTM: 'Bottom', SKT: 'Skirt', OTH: 'Other' })[code] || code; }

async function markSold(itemId) {
  if (!window.confirm(`Mark ${itemId} as sold?`)) return;
  try { await request(`/api/items/${itemId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'SOLD' }) }); showToast(`${itemId} moved to sales history`); await loadDashboard(); } catch (error) { showToast(error.message); }
}

async function loadSales() {
  const search = encodeURIComponent($('#sales-search').value);
  const sales = await request(`/api/sales?search=${search}`);
  $('#sales-empty').hidden = sales.length !== 0;
  $('#sales-rows').innerHTML = sales.map((sale) => `<tr><td><span class="item-id">${sale.itemId}</span></td><td class="category">${categoryName(sale.category)}</td><td>${sale.size}</td><td class="price">${money(sale.price)}</td><td class="subtle">${dateTime(sale.soldAt)}</td><td><button class="action-button" data-unsold="${sale.itemId}">Undo sale</button></td></tr>`).join('');
  $('#sales-rows').querySelectorAll('[data-unsold]').forEach((button) => button.addEventListener('click', () => markUnsold(button.dataset.unsold)));
}

async function markUnsold(itemId) {
  if (!window.confirm(`Return ${itemId} to active inventory?`)) return;
  try {
    await request(`/api/items/${itemId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'UNSOLD' }) });
    showToast(`${itemId} returned to active inventory`);
    await Promise.all([loadDashboard(), loadSales()]);
  } catch (error) {
    showToast(error.message);
  }
}

function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); window.clearTimeout(showToast.timer); showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2800); }
function todayCode() { const today = new Date(); return `${String(today.getFullYear()).slice(-2)}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`; }

function openDialog() { $('#form-error').textContent = ''; $('#encode-dialog').showModal(); updatePreview(); }
function closeDialog() { $('#encode-form').reset(); $('#form-error').textContent = ''; $('#encode-dialog').close(); updatePreview(); }
function updatePreview() { $('#id-preview-value').textContent = `${todayCode()}-${$('select[name="category"]').value}-001`; }

$('#open-encode').addEventListener('click', openDialog);
$('#empty-encode').addEventListener('click', openDialog);
$('#close-encode').addEventListener('click', closeDialog);
$('#cancel-encode').addEventListener('click', closeDialog);
$('#refresh-button').addEventListener('click', () => loadDashboard().then(() => showToast('Inventory refreshed')));
$('select[name="category"]').addEventListener('change', updatePreview);
$('#search-input').addEventListener('input', (event) => { state.filters.search = event.target.value; loadDashboard(); });
$('#category-filter').addEventListener('change', (event) => { state.filters.category = event.target.value; loadDashboard(); });
$('#age-filter').addEventListener('change', (event) => { state.filters.age = event.target.value; loadDashboard(); });
$('#sales-search').addEventListener('input', loadSales);

$('.nav-tabs').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item === button));
  const isSales = button.dataset.view === 'sales';
  $('#inventory-view').hidden = isSales;
  $('#sales-view').hidden = !isSales;
  $('#page-title').textContent = isSales ? 'Sales history' : 'Active inventory';
  if (isSales) await loadSales();
});

$('#encode-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  try {
    const item = await request('/api/items', { method: 'POST', body: JSON.stringify({ category: form.get('category'), size: form.get('size'), price: form.get('price') }) });
    $('#encode-dialog').close(); event.target.reset(); showToast(`${item.itemId} added to inventory`); await loadDashboard();
  } catch (error) { $('#form-error').textContent = error.message; }
});

loadDashboard().catch((error) => showToast(error.message));