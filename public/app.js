// ── Pallet state ───────────────────────────────────────────────────────────

const palletCounts = { chep: 0, loscam: 0, plain: 0 };
const palletDisp   = { chep: null, loscam: null, plain: null };

function adjPallet(type, delta) {
  palletCounts[type] = Math.max(0, palletCounts[type] + delta);
  document.getElementById(type + '-count').textContent = palletCounts[type];
  const row = document.getElementById(type + '-disp-row');
  if (palletCounts[type] === 0) {
    row.classList.add('inactive');
    palletDisp[type] = null;
    row.querySelectorAll('.disp-btn').forEach(b => b.classList.remove('selected'));
    if (type === 'chep') {
      document.getElementById('chep-docket-field').classList.add('hidden');
      document.getElementById('chep-docket').value = '';
    }
  } else {
    row.classList.remove('inactive');
  }
}

function setPalletDisp(type, disp) {
  if (palletCounts[type] === 0) return;
  palletDisp[type] = disp;
  const row = document.getElementById(type + '-disp-row');
  row.querySelectorAll('.disp-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById(type + '-' + disp).classList.add('selected');
  if (type === 'chep') {
    const docketField = document.getElementById('chep-docket-field');
    if (disp === 'Transfer') docketField.classList.remove('hidden');
    else { docketField.classList.add('hidden'); document.getElementById('chep-docket').value = ''; }
  }
}

// ── Manage lists (delete entries) ─────────────────────────────────────────

let currentManageType = null;
const selectIdMap = { drivers: 'driver-select', sites: 'site-select', transports: 'transport-select', recipients: 'recipient-select' };

async function openManage(type, label) {
  currentManageType = type;
  document.getElementById('manage-title').textContent = 'Edit ' + label;
  await refreshManageList();
  document.getElementById('manage-modal').classList.remove('hidden');
}

async function refreshManageList() {
  const type = currentManageType;
  const items = await fetch('/api/' + type).then(r => r.json());
  const names = items.map(i => typeof i === 'string' ? i : i.name);
  const ul = document.getElementById('manage-list');
  ul.innerHTML = names.length
    ? names.map(n => `<li class="manage-item"><span>${n}</span><button type="button" class="btn-delete-entry" onclick="deleteEntry('${type}','${n.replace(/'/g,"\\'")}')">✕</button></li>`).join('')
    : '<li class="manage-empty">No entries saved yet.</li>';
}

async function deleteEntry(type, name) {
  await fetch('/api/' + type + '/' + encodeURIComponent(name), { method: 'DELETE' });
  // Remove from the select dropdown too
  const sel = document.getElementById(selectIdMap[type]);
  const opt = [...sel.options].find(o => o.value === name);
  if (opt) sel.removeChild(opt);
  await refreshManageList();
}

function closeManage(e) {
  if (e && e.target !== document.getElementById('manage-modal')) return;
  document.getElementById('manage-modal').classList.add('hidden');
}

// ── Temperature selection ──────────────────────────────────────────────────

let selectedTemp = null;

function setTemp(type) {
  selectedTemp = type;
  document.querySelectorAll('#temp-btn-row .disp-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('temp-' + type).classList.add('selected');
  document.getElementById('temp-value-field').classList.remove('hidden');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function localDatetimeValue() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

// ── Bootstrap ─────────────────────────────────────────────────────────────

document.getElementById('arrived-at').value = localDatetimeValue();

async function loadDropdowns() {
  const [drivers, sites, transports, recipients] = await Promise.all([
    fetch('/api/drivers').then(r => r.json()),
    fetch('/api/sites').then(r => r.json()),
    fetch('/api/transports').then(r => r.json()),
    fetch('/api/recipients').then(r => r.json())
  ]);

  const driverSel = document.getElementById('driver-select');
  drivers.forEach(name => {
    if (name === 'Add New Driver...') return;
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    driverSel.appendChild(opt);
  });
  const addDriverOpt = document.createElement('option');
  addDriverOpt.value = '__new__';
  addDriverOpt.textContent = '+ Add new driver…';
  driverSel.appendChild(addDriverOpt);

  const siteSel = document.getElementById('site-select');
  sites.forEach(({ name }) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    siteSel.appendChild(opt);
  });
  const addSiteOpt = document.createElement('option');
  addSiteOpt.value = '__new__';
  addSiteOpt.textContent = '+ Add new site…';
  siteSel.appendChild(addSiteOpt);

  const transportSel = document.getElementById('transport-select');
  transports.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    transportSel.appendChild(opt);
  });
  const addTransportOpt = document.createElement('option');
  addTransportOpt.value = '__new__';
  addTransportOpt.textContent = '+ Add new carrier…';
  transportSel.appendChild(addTransportOpt);

  const recipientSel = document.getElementById('recipient-select');
  recipients.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    recipientSel.appendChild(opt);
  });
  const addRecipientOpt = document.createElement('option');
  addRecipientOpt.value = '__new__';
  addRecipientOpt.textContent = '+ Add new recipient…';
  recipientSel.appendChild(addRecipientOpt);

  // Pre-fill address when site selected
  const siteMap = {};
  sites.forEach(s => { if (s.address) siteMap[s.name] = s.address; });
  siteSel.addEventListener('change', () => {
    const addr = siteMap[siteSel.value];
    if (addr) document.getElementById('address').value = addr;
    toggleNew('site-select', 'new-site-field');
  });
}

function toggleNew(selectId, fieldId) {
  const val = document.getElementById(selectId).value;
  const field = document.getElementById(fieldId);
  if (val === '__new__') show(field);
  else hide(field);
}

document.getElementById('driver-select').addEventListener('change', () => toggleNew('driver-select', 'new-driver-field'));
document.getElementById('site-select').addEventListener('change', () => toggleNew('site-select', 'new-site-field'));
document.getElementById('transport-select').addEventListener('change', () => toggleNew('transport-select', 'new-transport-field'));
document.getElementById('recipient-select').addEventListener('change', () => toggleNew('recipient-select', 'new-recipient-field'));

loadDropdowns();

// ── Submit ─────────────────────────────────────────────────────────────────

document.getElementById('delivery-form').addEventListener('submit', async e => {
  e.preventDefault();

  const errEl = document.getElementById('error-msg');
  hide(errEl);

  const driverSel = document.getElementById('driver-select').value;
  const driver_name = driverSel === '__new__'
    ? document.getElementById('new-driver').value.trim()
    : driverSel;

  const siteSel = document.getElementById('site-select').value;
  const site_name = siteSel === '__new__'
    ? document.getElementById('new-site').value.trim()
    : siteSel;

  const arrived_at = document.getElementById('arrived-at').value;

  // Validation
  if (!driver_name) { showError('Please select or enter your name.'); return; }
  if (!site_name)   { showError('Please select or enter a site name.'); return; }
  if (!arrived_at)  { showError('Please enter the arrival time.'); return; }

  for (const type of ['chep', 'loscam', 'plain']) {
    if (palletCounts[type] > 0 && !palletDisp[type]) {
      showError(`Please select Exchanged or Transfer for ${type.toUpperCase()} pallets.`);
      return;
    }
  }

  const payload = {
    driver_name,
    site_name,
    address: document.getElementById('address').value.trim() || null,
    arrived_at,
    chep_count:        palletCounts.chep,
    chep_disposition:  palletDisp.chep,
    loscam_count:      palletCounts.loscam,
    loscam_disposition:palletDisp.loscam,
    plain_count:       palletCounts.plain,
    plain_disposition: palletDisp.plain,
    num_cartons:  parseInt(document.getElementById('num-cartons').value)  || 0,
    num_satchels: parseInt(document.getElementById('num-satchels').value) || 0,
    transport_name: (() => { const s = document.getElementById('transport-select').value; return s === '__new__' ? document.getElementById('new-transport').value.trim() || null : s || null; })(),
    temperature: selectedTemp || null,
    temperature_value: document.getElementById('temperature-value').value.trim() || null,
    chep_docket: document.getElementById('chep-docket').value.trim() || null,
    condition: document.querySelector('input[name="condition"]:checked').value,
    recipient_name: (() => { const s = document.getElementById('recipient-select').value; return s === '__new__' ? document.getElementById('new-recipient').value.trim() || null : s || null; })(),
    notes: document.getElementById('notes').value.trim() || null
  };

  const btn = document.getElementById('submit-btn');
  const btnText = document.getElementById('btn-text');
  const spinner = document.getElementById('btn-spinner');
  btn.disabled = true;
  hide(btnText);
  show(spinner);

  try {
    const res = await fetch('/api/deliveries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server error');

    const palletParts = [];
    if (palletCounts.chep   > 0) palletParts.push(`${palletCounts.chep} CHEP (${palletDisp.chep})`);
    if (palletCounts.loscam > 0) palletParts.push(`${palletCounts.loscam} LOSCAM (${palletDisp.loscam})`);
    if (palletCounts.plain  > 0) palletParts.push(`${palletCounts.plain} Plain (${palletDisp.plain})`);
    const stockParts = [];
    if (palletParts.length)      stockParts.push(palletParts.join(', '));
    if (payload.num_cartons)     stockParts.push(`${payload.num_cartons} carton${payload.num_cartons !== 1 ? 's' : ''}`);
    if (payload.num_satchels)    stockParts.push(`${payload.num_satchels} satchel${payload.num_satchels !== 1 ? 's' : ''}`);

    document.getElementById('success-msg').textContent =
      `${driver_name} → ${site_name} at ${formatDatetime(arrived_at)}` +
      (stockParts.length ? ` · ${stockParts.join(', ')}` : '');

    show(document.getElementById('success-banner'));
    hide(document.getElementById('delivery-form'));

  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    show(btnText);
    hide(spinner);
  }
});

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  show(el);
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function formatDatetime(str) {
  const d = new Date(str);
  return d.toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' });
}

function resetForm() {
  hide(document.getElementById('success-banner'));
  show(document.getElementById('delivery-form'));
  document.getElementById('delivery-form').reset();
  document.getElementById('arrived-at').value = localDatetimeValue();
  hide(document.getElementById('new-driver-field'));
  hide(document.getElementById('new-site-field'));
  hide(document.getElementById('new-transport-field'));
  hide(document.getElementById('new-recipient-field'));
  for (const type of ['chep', 'loscam', 'plain']) {
    palletCounts[type] = 0;
    palletDisp[type]   = null;
    document.getElementById(type + '-count').textContent = '0';
    const row = document.getElementById(type + '-disp-row');
    row.classList.add('inactive');
    row.querySelectorAll('.disp-btn').forEach(b => b.classList.remove('selected'));
  }
  document.getElementById('chep-docket-field').classList.add('hidden');
  document.getElementById('chep-docket').value = '';
  selectedTemp = null;
  document.querySelectorAll('#temp-btn-row .disp-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('temp-value-field').classList.add('hidden');
  document.getElementById('temperature-value').value = '';
}
