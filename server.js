const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Deliveries ──────────────────────────────────────────────────────────────

app.post('/api/deliveries', (req, res) => {
  const {
    driver_name, site_name, address, arrived_at,
    num_pallets, num_cartons, num_satchels,
    condition, recipient_name, notes
  } = req.body;

  if (!driver_name || !site_name || !arrived_at) {
    return res.status(400).json({ error: 'driver_name, site_name, and arrived_at are required' });
  }

  const stmt = db.prepare(`
    INSERT INTO deliveries
      (driver_name, site_name, address, arrived_at, num_pallets, num_cartons, num_satchels, condition, recipient_name, notes)
    VALUES
      (@driver_name, @site_name, @address, @arrived_at, @num_pallets, @num_cartons, @num_satchels, @condition, @recipient_name, @notes)
  `);

  const result = stmt.run({
    driver_name, site_name,
    address: address || null,
    arrived_at,
    num_pallets: num_pallets || 0,
    num_cartons: num_cartons || 0,
    num_satchels: num_satchels || 0,
    condition: condition || 'Good',
    recipient_name: recipient_name || null,
    notes: notes || null
  });

  // Persist new driver/site names automatically
  db.prepare('INSERT OR IGNORE INTO drivers (name) VALUES (?)').run(driver_name);
  db.prepare('INSERT OR IGNORE INTO sites (name, address) VALUES (?, ?)').run(site_name, address || null);

  res.json({ id: result.lastInsertRowid });
});

app.get('/api/deliveries', (req, res) => {
  const { driver, site, date_from, date_to, limit = 200, offset = 0 } = req.query;

  let query = 'SELECT * FROM deliveries WHERE 1=1';
  const params = [];

  if (driver) { query += ' AND driver_name = ?'; params.push(driver); }
  if (site)   { query += ' AND site_name = ?';   params.push(site); }
  if (date_from) { query += ' AND arrived_at >= ?'; params.push(date_from); }
  if (date_to)   { query += ' AND arrived_at <= ?'; params.push(date_to + 'T23:59:59'); }

  query += ' ORDER BY arrived_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

app.get('/api/deliveries/csv', (req, res) => {
  const { driver, site, date_from, date_to } = req.query;

  let query = 'SELECT * FROM deliveries WHERE 1=1';
  const params = [];

  if (driver) { query += ' AND driver_name = ?'; params.push(driver); }
  if (site)   { query += ' AND site_name = ?';   params.push(site); }
  if (date_from) { query += ' AND arrived_at >= ?'; params.push(date_from); }
  if (date_to)   { query += ' AND arrived_at <= ?'; params.push(date_to + 'T23:59:59'); }

  query += ' ORDER BY arrived_at DESC';

  const rows = db.prepare(query).all(...params);

  const headers = ['ID','Driver','Site','Address','Arrived At','Pallets','Cartons','Satchels','Condition','Recipient','Notes','Submitted At'];
  const csv = [
    headers.join(','),
    ...rows.map(r => [
      r.id, csv_esc(r.driver_name), csv_esc(r.site_name), csv_esc(r.address),
      r.arrived_at, r.num_pallets, r.num_cartons, r.num_satchels,
      csv_esc(r.condition), csv_esc(r.recipient_name), csv_esc(r.notes), r.submitted_at
    ].join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="deliveries.csv"');
  res.send(csv);
});

function csv_esc(v) {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

// ── Drivers & Sites (for dropdowns) ─────────────────────────────────────────

app.get('/api/drivers', (_req, res) => {
  res.json(db.prepare('SELECT name FROM drivers ORDER BY name').all().map(r => r.name));
});

app.get('/api/sites', (_req, res) => {
  res.json(db.prepare('SELECT name, address FROM sites ORDER BY name').all());
});

// ── Serve SPA pages ──────────────────────────────────────────────────────────

app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
