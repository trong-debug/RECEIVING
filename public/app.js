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
  const [drivers, sites] = await Promise.all([
    fetch('/api/drivers').then(r => r.json()),
    fetch('/api/sites').then(r => r.json())
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

  const payload = {
    driver_name,
    site_name,
    address: document.getElementById('address').value.trim() || null,
    arrived_at,
    num_pallets:  parseInt(document.getElementById('num-pallets').value)  || 0,
    num_cartons:  parseInt(document.getElementById('num-cartons').value)  || 0,
    num_satchels: parseInt(document.getElementById('num-satchels').value) || 0,
    condition: document.querySelector('input[name="condition"]:checked').value,
    recipient_name: document.getElementById('recipient').value.trim() || null,
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

    const parts = [
      `${payload.num_pallets} pallet${payload.num_pallets !== 1 ? 's' : ''}`,
      `${payload.num_cartons} carton${payload.num_cartons !== 1 ? 's' : ''}`,
      `${payload.num_satchels} satchel${payload.num_satchels !== 1 ? 's' : ''}`
    ].join(', ');

    document.getElementById('success-msg').textContent =
      `${driver_name} → ${site_name} at ${formatDatetime(arrived_at)} · ${parts}`;

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
}
