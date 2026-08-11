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
  const totalCHEP     = rows.reduce((s, r) => s + (r.chep_count   || 0), 0);
  const totalLOSCAM   = rows.reduce((s, r) => s + (r.loscam_count || 0), 0);
  const totalPLAIN    = rows.reduce((s, r) => s + (r.plain_count  || 0), 0);
  const totalCartons  = rows.reduce((s, r) => s + (r.num_cartons  || 0), 0);
  const totalSatchels = rows.reduce((s, r) => s + (r.num_satchels || 0), 0);

  const stats = [
    { value: rows.length,               label: 'Drop-offs' },
    { value: totalCHEP,                 label: 'CHEP Pallets' },
    { value: totalLOSCAM,               label: 'LOSCAM Pallets' },
    { value: totalPLAIN,                label: 'Plain Pallets' },
    { value: totalCartons,              label: 'Cartons' },
    { value: totalSatchels,             label: 'Satchels' }
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
      <td>${esc(r.client_name) || ''}</td>
      <td>${palletCell(r)}</td>
      <td style="text-align:center">${r.num_cartons || 0}</td>
      <td style="text-align:center">${r.num_satchels || 0}</td>
      <td>${esc(r.transport_name) || ''}</td>
      <td>${r.temperature ? esc(r.temperature) + (r.temperature_value ? ' ' + esc(r.temperature_value) + '°C' : '') : ''}</td>
      <td>${esc(r.chep_docket) || ''}</td>
      <td><span class="badge ${badgeCls}">${esc(r.condition)}</span></td>
      <td>${esc(r.recipient_name) || ''}</td>
      <td style="max-width:180px;word-break:break-word">${esc(r.notes) || ''}</td>
      <td><button class="btn-delete-row" onclick="deleteRecord(${r.id})">Delete</button></td>
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

function palletCell(r) {
  const parts = [];
  if (r.chep_count   > 0) parts.push(`<span class="pallet-chip chep-chip">${r.chep_count} CHEP</span> <span class="disp-chip">${esc(r.chep_disposition) || '?'}</span>`);
  if (r.loscam_count > 0) parts.push(`<span class="pallet-chip loscam-chip">${r.loscam_count} LOSCAM</span> <span class="disp-chip">${esc(r.loscam_disposition) || '?'}</span>`);
  if (r.plain_count  > 0) parts.push(`<span class="pallet-chip plain-chip">${r.plain_count} Plain</span> <span class="disp-chip">${esc(r.plain_disposition) || '?'}</span>`);
  if (parts.length === 0 && r.num_pallets > 0) return `<span style="color:#888">${r.num_pallets} (legacy)</span>`;
  return parts.length ? parts.join('<br>') : '<span style="color:#ccc">—</span>';
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

async function deleteRecord(id) {
  if (!confirm(`Delete record #${id}? This cannot be undone.`)) return;
  await fetch(`/api/deliveries/${id}`, { method: 'DELETE' });
  loadRecords();
}

async function clearAllRecords() {
  if (!confirm('Delete ALL records? This cannot be undone.')) return;
  if (!confirm('Are you sure? All delivery records will be permanently deleted.')) return;
  await fetch('/api/deliveries', { method: 'DELETE' });
  loadRecords();
}

loadDropdowns();
loadRecords();
