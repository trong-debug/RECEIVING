// ── Hold-to-repeat for temperature +/- buttons ────────────────────────────

let holdTimer = null;
let holdInterval = null;

function stopHold() {
  clearTimeout(holdTimer);
  clearInterval(holdInterval);
  holdTimer = null;
  holdInterval = null;
}

// ── Location selection ────────────────────────────────────────────────────

const LOCATION_IDS = {
  'Dock 8':       'loc-btn-dock8',
  'Dock 9':       'loc-btn-dock9',
  'Dock 10':      'loc-btn-dock10',
  'Dock 11':      'loc-btn-dock11',
  'BC Hardstand': 'loc-btn-hardstand'
};
let selectedLocation = null;

function setLocation(loc) {
  if (selectedLocation === loc) {
    selectedLocation = null;
    document.getElementById(LOCATION_IDS[loc]).classList.remove('active');
    return;
  }
  for (const [l, id] of Object.entries(LOCATION_IDS)) {
    document.getElementById(id).classList.toggle('active', l === loc);
  }
  selectedLocation = loc;
}

// ── Drop off toggle state ─────────────────────────────────────────────────

const dropoffActive = { chep: false, loscam: false, plain: false, cartons: false };
const palletDisp    = { chep: null, loscam: null, plain: null };
const palletQty     = { chep: 0,    loscam: 0,    plain: 0    };

function adjPalletQty(type, delta) {
  palletQty[type] = Math.max(0, palletQty[type] + delta);
  document.getElementById(type + '-qty-display').textContent = palletQty[type];
}

function startPalletHold(type, delta, e) {
  if (e) e.preventDefault();
  adjPalletQty(type, delta);
  holdTimer = setTimeout(() => {
    holdInterval = setInterval(() => adjPalletQty(type, delta), 80);
  }, 400);
}

function toggleDropoff(type) {
  const wasActive = dropoffActive[type];

  // Deactivate all first
  for (const t of ['chep', 'loscam', 'plain', 'cartons']) {
    if (dropoffActive[t]) {
      dropoffActive[t] = false;
      document.getElementById('dropoff-btn-' + t).classList.remove('active');
      document.getElementById('dropoff-panel-' + t).classList.add('hidden');
      _resetDropoffPanel(t);
    }
  }

  // Activate clicked one only if it wasn't already active
  if (!wasActive) {
    dropoffActive[type] = true;
    document.getElementById('dropoff-btn-' + type).classList.add('active');
    document.getElementById('dropoff-panel-' + type).classList.remove('hidden');
  }
}

function _resetDropoffPanel(type) {
  if (type === 'chep' || type === 'loscam' || type === 'plain') {
    palletDisp[type] = null;
    palletQty[type]  = 0;
    document.getElementById(type + '-qty-display').textContent = '0';
    document.getElementById(type + '-disp-row').querySelectorAll('.disp-btn').forEach(b => b.classList.remove('selected'));
    if (type === 'chep') {
      document.getElementById('chep-docket-field').classList.add('hidden');
      document.getElementById('chep-docket').value = '';
    }
  } else if (type === 'cartons') {
    document.getElementById('num-cartons').value = '';
  }
}

function setPalletDisp(type, disp) {
  palletDisp[type] = disp;
  document.getElementById(type + '-disp-row').querySelectorAll('.disp-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById(type + '-' + disp).classList.add('selected');
  if (type === 'chep') {
    const docketField = document.getElementById('chep-docket-field');
    if (disp === 'Transfer') docketField.classList.remove('hidden');
    else { docketField.classList.add('hidden'); document.getElementById('chep-docket').value = ''; }
  }
}

// ── Manage lists (delete entries) ─────────────────────────────────────────

let currentManageType = null;
const selectIdMap = { clients: 'client-select', drivers: 'driver-select', sites: 'site-select', transports: 'transport-select', recipients: 'recipient-select' };

async function openManage(type, label) {
  currentManageType = type;
  document.getElementById('manage-title').textContent = 'Edit ' + label;
  await refreshManageList();
  document.getElementById('manage-modal').classList.remove('hidden');
  // Auto-submit when a multiline list is pasted
  const input = document.getElementById('manage-add-input');
  input.onpaste = e => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (text.includes('\n') || (text.match(/,/g) || []).length > 1) {
      e.preventDefault();
      input.value = text;
      setTimeout(addEntry, 0);
    }
  };
}

async function refreshManageList() {
  const type = currentManageType;
  const items = await fetch('/api/' + type).then(r => r.json());
  const names = items.map(i => typeof i === 'string' ? i : i.name).sort((a, b) => a.localeCompare(b));
  const ul = document.getElementById('manage-list');
  ul.innerHTML = names.length
    ? names.map(n => `<li class="manage-item"><span>${n}</span><button type="button" class="btn-delete-entry" onclick="deleteEntry('${type}','${n.replace(/'/g,"\\'")}')">✕</button></li>`).join('')
    : '<li class="manage-empty">No entries saved yet.</li>';
}

function sortSelect(sel) {
  const saved = sel.value;
  const newOpt = sel.querySelector('option[value="__new__"]');
  const blank  = sel.querySelector('option[value=""]');
  const opts   = [...sel.options].filter(o => o.value !== '__new__' && o.value !== '');
  opts.sort((a, b) => a.text.localeCompare(b.text));
  opts.forEach(o => sel.insertBefore(o, newOpt || null));
  sel.value = saved;
}

async function addEntry() {
  const input = document.getElementById('manage-add-input');
  const raw   = input.value;
  // Split by newline or comma to support pasted lists
  const names = raw.split(/[\n,]+/).map(n => n.trim()).filter(Boolean);
  if (!names.length) return;

  const sel    = document.getElementById(selectIdMap[currentManageType]);
  const newOpt = sel ? sel.querySelector('option[value="__new__"]') : null;

  for (const name of names) {
    await fetch('/api/' + currentManageType, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (sel && ![...sel.options].some(o => o.value === name)) {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      sel.insertBefore(opt, newOpt || null);
    }
  }

  if (sel) sortSelect(sel);
  input.value = '';
  input.focus();
  await refreshManageList();
}

async function clearAllEntries() {
  if (!confirm('Clear all entries from this list? This cannot be undone.')) return;
  await fetch('/api/' + currentManageType, { method: 'DELETE' });
  const sel = document.getElementById(selectIdMap[currentManageType]);
  if (sel) {
    [...sel.options].forEach(o => { if (o.value !== '' && o.value !== '__new__') sel.removeChild(o); });
  }
  await refreshManageList();
}

async function deleteEntry(type, name) {
  await fetch('/api/' + type + '/' + encodeURIComponent(name), { method: 'DELETE' });
  const sel = document.getElementById(selectIdMap[type]);
  const opt = [...sel.options].find(o => o.value === name);
  if (opt) sel.removeChild(opt);
  await refreshManageList();
}

function closeManage(e) {
  if (e && e.target !== document.getElementById('manage-modal')) return;
  document.getElementById('manage-modal').classList.add('hidden');
}

// ── Dispatch time offset input ─────────────────────────────────────────────

function updateDispatchFromOffset() {
  const dateVal = document.getElementById('arrival-date').value;
  const timeVal = document.getElementById('arrived-at').value;
  const mins    = parseInt(document.getElementById('dispatch-offset').value);
  if (!dateVal || !timeVal || isNaN(mins) || mins < 0) return;
  const base = new Date(`${dateVal}T${timeVal}`);
  base.setMinutes(base.getMinutes() + mins);
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('dispatch-time').value =
    `${pad(base.getHours())}:${pad(base.getMinutes())}`;
}

// ── Direction selection ────────────────────────────────────────────────────

let selectedDirection = null;

function setDirection(dir) {
  selectedDirection = dir;
  document.querySelectorAll('#direction-btn-row .disp-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('direction-' + dir).classList.add('selected');
}

// ── Temperature selection ──────────────────────────────────────────────────

let selectedTemp = null;
let tempValue = 0;

function setTemp(type) {
  selectedTemp = type;
  document.querySelectorAll('#temp-btn-row .disp-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('temp-' + type).classList.add('selected');
  document.getElementById('temp-value-field').classList.remove('hidden');
}

function adjTemp(delta) {
  tempValue += delta;
  document.getElementById('temp-value-display').textContent = tempValue;
}

function startTempHold(delta, e) {
  if (e && e.cancelable) e.preventDefault();
  adjTemp(delta);
  holdTimer = setTimeout(() => {
    holdInterval = setInterval(() => adjTemp(delta), 80);
  }, 450);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function localDateValue() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
}

function localTimeValue() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

// ── Bootstrap ─────────────────────────────────────────────────────────────

document.getElementById('arrival-date').value = localDateValue();
document.getElementById('arrived-at').value    = localTimeValue();

async function loadDropdowns() {
  const [drivers, sites, clients, transports, recipients] = await Promise.all([
    fetch('/api/drivers').then(r => r.json()),
    fetch('/api/sites').then(r => r.json()),
    fetch('/api/clients').then(r => r.json()),
    fetch('/api/transports').then(r => r.json()),
    fetch('/api/recipients').then(r => r.json())
  ]);

  const driverSel = document.getElementById('driver-select');
  drivers.forEach(name => {
    if (name === 'Add New Driver...') return;
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    driverSel.appendChild(opt);
  });
  const addDriverOpt = document.createElement('option');
  addDriverOpt.value = '__new__'; addDriverOpt.textContent = '+ Add new driver…';
  driverSel.appendChild(addDriverOpt);

  const siteSel = document.getElementById('site-select');
  sites.forEach(({ name }) => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    siteSel.appendChild(opt);
  });
  const addSiteOpt = document.createElement('option');
  addSiteOpt.value = '__new__'; addSiteOpt.textContent = '+ Add new site…';
  siteSel.appendChild(addSiteOpt);

  const clientSel = document.getElementById('client-select');
  clients.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    clientSel.appendChild(opt);
  });
  const addClientOpt = document.createElement('option');
  addClientOpt.value = '__new__'; addClientOpt.textContent = '+ Add new client…';
  clientSel.appendChild(addClientOpt);

  const transportSel = document.getElementById('transport-select');
  transports.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    transportSel.appendChild(opt);
  });
  const addTransportOpt = document.createElement('option');
  addTransportOpt.value = '__new__'; addTransportOpt.textContent = '+ Add new carrier…';
  transportSel.appendChild(addTransportOpt);

  const recipientSel = document.getElementById('recipient-select');
  recipients.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name; opt.textContent = name;
    recipientSel.appendChild(opt);
  });
  const addRecipientOpt = document.createElement('option');
  addRecipientOpt.value = '__new__'; addRecipientOpt.textContent = '+ Add new recipient…';
  recipientSel.appendChild(addRecipientOpt);

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

document.getElementById('dispatch-offset').addEventListener('input', updateDispatchFromOffset);
document.getElementById('arrived-at').addEventListener('change', updateDispatchFromOffset);
document.getElementById('driver-select').addEventListener('change', () => toggleNew('driver-select', 'new-driver-field'));
document.getElementById('site-select').addEventListener('change', () => toggleNew('site-select', 'new-site-field'));
document.getElementById('client-select').addEventListener('change', () => toggleNew('client-select', 'new-client-field'));
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

  const arrival_date = document.getElementById('arrival-date').value;
  const arrival_time = document.getElementById('arrived-at').value;
  const arrived_at   = arrival_date && arrival_time ? `${arrival_date}T${arrival_time}` : '';

  if (!driver_name)  { showError('Please select or enter your name.'); return; }
  if (!site_name)    { showError('Please select or enter a site name.'); return; }
  if (!arrival_date) { showError('Please enter the arrival date.'); return; }
  if (!arrival_time) { showError('Please enter the arrival time.'); return; }
  if (!selectedDirection) { showError('Please select Inbound or Outbound.'); return; }

  const anyDropoff = Object.values(dropoffActive).some(Boolean);
  if (!anyDropoff) { showError('Please select a drop off type — CHEPS, LOSCAM, PLAIN or CARTONS.'); return; }

  for (const type of ['chep', 'loscam', 'plain']) {
    if (dropoffActive[type]) {
      if (palletQty[type] <= 0) { showError(`Please select a quantity for ${type.toUpperCase()}.`); return; }
      if (!palletDisp[type])    { showError(`Please select a disposition for ${type.toUpperCase()}.`); return; }
    }
  }
  if (dropoffActive.cartons) {
    const qty = parseInt(document.getElementById('num-cartons').value) || 0;
    if (qty <= 0) { showError('Please enter a carton quantity.'); return; }
  }

  const payload = {
    driver_name,
    site_name,
    address: document.getElementById('address').value.trim() || null,
    arrived_at,
    chep_count:         dropoffActive.chep    ? palletQty.chep    : 0,
    chep_disposition:   dropoffActive.chep    ? palletDisp.chep   : null,
    loscam_count:       dropoffActive.loscam  ? palletQty.loscam  : 0,
    loscam_disposition: dropoffActive.loscam  ? palletDisp.loscam : null,
    plain_count:        dropoffActive.plain   ? palletQty.plain   : 0,
    plain_disposition:  dropoffActive.plain   ? palletDisp.plain  : null,
    num_cartons:        dropoffActive.cartons ? Math.max(0, parseInt(document.getElementById('num-cartons').value) || 0) : 0,
    num_satchels: 0,
    client_name: (() => { const s = document.getElementById('client-select').value; return s === '__new__' ? document.getElementById('new-client').value.trim() || null : s || null; })(),
    direction: selectedDirection,
    dispatch_time: (() => { const t = document.getElementById('dispatch-time').value; return t ? `${arrival_date}T${t}` : null; })(),
    transport_name: (() => { const s = document.getElementById('transport-select').value; return s === '__new__' ? document.getElementById('new-transport').value.trim() || null : s || null; })(),
    temperature: selectedTemp || null,
    temperature_value: selectedTemp ? String(tempValue) : null,
    chep_docket: document.getElementById('chep-docket').value.trim() || null,
    condition: document.querySelector('input[name="condition"]:checked').value,
    recipient_name: (() => { const s = document.getElementById('recipient-select').value; return s === '__new__' ? document.getElementById('new-recipient').value.trim() || null : s || null; })(),
    notes: document.getElementById('notes').value.trim() || null,
    location: selectedLocation || null
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
    if (payload.chep_count   > 0) palletParts.push(`${payload.chep_count} CHEP (${palletDisp.chep})`);
    if (payload.loscam_count > 0) palletParts.push(`${payload.loscam_count} LOSCAM (${palletDisp.loscam})`);
    if (payload.plain_count  > 0) palletParts.push(`${payload.plain_count} Plain (${palletDisp.plain})`);
    const stockParts = [];
    if (palletParts.length)       stockParts.push(palletParts.join(', '));
    if (payload.num_cartons)      stockParts.push(`${payload.num_cartons} carton${payload.num_cartons !== 1 ? 's' : ''}`);

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
  document.getElementById('arrival-date').value = localDateValue();
  document.getElementById('arrived-at').value    = localTimeValue();
  hide(document.getElementById('new-driver-field'));
  hide(document.getElementById('new-site-field'));
  hide(document.getElementById('new-client-field'));
  selectedDirection = null;
  document.querySelectorAll('#direction-btn-row .disp-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('dispatch-offset').value = '';
  document.getElementById('dispatch-time').value = '';
  hide(document.getElementById('new-transport-field'));
  hide(document.getElementById('new-recipient-field'));

  for (const type of ['chep', 'loscam', 'plain', 'cartons']) {
    dropoffActive[type] = false;
    document.getElementById('dropoff-btn-' + type).classList.remove('active');
    document.getElementById('dropoff-panel-' + type).classList.add('hidden');
  }
  for (const type of ['chep', 'loscam', 'plain']) {
    palletDisp[type] = null;
    palletQty[type]  = 0;
    document.getElementById(type + '-qty-display').textContent = '0';
    document.getElementById(type + '-disp-row').querySelectorAll('.disp-btn').forEach(b => b.classList.remove('selected'));
  }
  document.getElementById('chep-docket-field').classList.add('hidden');
  document.getElementById('chep-docket').value = '';
  document.getElementById('num-cartons').value = '';

  selectedLocation = null;
  for (const id of Object.values(LOCATION_IDS)) document.getElementById(id).classList.remove('active');

  selectedTemp = null;
  tempValue = 0;
  document.querySelectorAll('#temp-btn-row .disp-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('temp-value-field').classList.add('hidden');
  document.getElementById('temp-value-display').textContent = '0';
}
