async function loadDropdowns() {
  const [drivers, sites] = await Promise.all([
    fetch('/api/drivers').then(r => r.json()),
    fetch('/api/sites').then(r => r.json())
  ]);

  const dSel = document.getElementById('f-driver');
  drivers.forEach(name => {
    if (name === 'Add New Driver...') return;
    const o = document.createElement('option');
    o.value = name; o.textContent = name;
    dSel.appendChild(o);
  });

  const sSel = document.getElementById('f-site');
  sites.forEach(({ name }) => {
    const o = document.createElement('option');
    o.value = name; o.textContent = name;
    sSel.appendChild(o);
  });
}

async function loadRecords() {
  const params = new URLSearchParams();
  const driver = document.getElementById('f-driver').value;
  const site   = document.getElementById('f-site').value;
  const from   = document.getElementById('f-from').value;
  const to     = document.getElementById('f-to').value;
  if (driver) params.set('driver', driver);
  if (site)   params.set('site', site);
  if (from)   params.set('date_from', from);
  if (to)     params.set('date_to', to);

  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('table-wrap').classList.add('hidden');
  document.getElementById('no-records').classList.add('hidden');
  document.getElementById('stats-row').innerHTML = '';

  const rows = await fetch('/api/deliveries?' + params).then(r => r.json());

  document.getElementById('loading').classList.add('hidden');

  renderStats(rows);
  renderTable(rows);
}

function renderStats(rows) {
  const totalPallets  = rows.reduce((s, r) => s + (r.num_pallets  || 0), 0);
  const totalCartons  = rows.reduce((s, r) => s + (r.num_cartons  || 0), 0);
  const totalSatchels = rows.reduce((s, r) => s + (r.num_satchels || 0), 0);

  const stats = [
    { value: rows.length,    label: 'Drop-offs' },
    { value: totalPallets,   label: 'Pallets' },
    { value: totalCartons,   label: 'Cartons' },
    { value: totalSatchels,  label: 'Satchels' }
  ];

  const row = document.getElementById('stats-row');
  row.innerHTML = stats.map(s => `
    <div class="stat-card">
      <div class="stat-value">${s.value.toLocaleString()}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');
}

function renderTable(rows) {
  if (rows.length === 0) {
    document.getElementById('no-records').classList.remove('hidden');
    return;
  }
  const tbody = document.getElementById('records-tbody');
  tbody.innerHTML = rows.map(r => {
    const badgeCls = r.condition === 'Good' ? 'badge-good' : r.condition === 'Damaged' ? 'badge-damaged' : 'badge-partial';
    return `<tr>
      <td>${r.id}</td>
      <td><strong>${esc(r.driver_name)}</strong></td>
      <td>${esc(r.site_name)}${r.address ? `<br><small style="color:#888">${esc(r.address)}</small>` : ''}</td>
      <td style="white-space:nowrap">${formatDatetime(r.arrived_at)}</td>
      <td style="text-align:center">${r.num_pallets || 0}</td>
      <td style="text-align:center">${r.num_cartons || 0}</td>
      <td style="text-align:center">${r.num_satchels || 0}</td>
      <td><span class="badge ${badgeCls}">${esc(r.condition)}</span></td>
      <td>${esc(r.recipient_name) || ''}</td>
      <td style="max-width:180px;word-break:break-word">${esc(r.notes) || ''}</td>
    </tr>`;
  }).join('');
  document.getElementById('table-wrap').classList.remove('hidden');
}

function exportCSV() {
  const params = new URLSearchParams();
  const driver = document.getElementById('f-driver').value;
  const site   = document.getElementById('f-site').value;
  const from   = document.getElementById('f-from').value;
  const to     = document.getElementById('f-to').value;
  if (driver) params.set('driver', driver);
  if (site)   params.set('site', site);
  if (from)   params.set('date_from', from);
  if (to)     params.set('date_to', to);
  window.location = '/api/deliveries/csv?' + params;
}

function clearFilters() {
  document.getElementById('f-driver').value = '';
  document.getElementById('f-site').value   = '';
  document.getElementById('f-from').value   = '';
  document.getElementById('f-to').value     = '';
  loadRecords();
}

function formatDatetime(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' });
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

loadDropdowns();
loadRecords();
