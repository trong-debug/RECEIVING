const express = require('express');
const path = require('path');
const db = require('./db');

async function syncToSheets(delivery) {
  const url = process.env.GOOGLE_SHEET_WEBHOOK;
  if (!url) { console.log('Sheets sync: no webhook URL set'); return; }
  try {
    console.log('Sheets sync: sending delivery #' + delivery.id);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(delivery),
      signal: AbortSignal.timeout(10000)
    });
    const text = await res.text();
    console.log('Sheets sync: response status=' + res.status + ' body=' + text);
  } catch (err) {
    console.error('Sheets sync error:', err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Deliveries ──────────────────────────────────────────────────────────────

app.post('/api/deliveries', (req, res) => {
  const {
    driver_name, site_name, address, arrived_at,
    num_cartons, num_satchels,
    chep_count, chep_disposition,
    loscam_count, loscam_disposition,
    plain_count, plain_disposition,
    client_name, direction, dispatch_time,
    transport_name, temperature, temperature_value,
    chep_docket, location,
    condition, recipient_name, notes
  } = req.body;

  if (!driver_name || !site_name || !arrived_at) {
    return res.status(400).json({ error: 'driver_name, site_name, and arrived_at are required' });
  }

  const chep   = Math.max(0, parseInt(chep_count)   || 0);
  const loscam = Math.max(0, parseInt(loscam_count) || 0);
  const plain  = Math.max(0, parseInt(plain_count)  || 0);

  const stmt = db.prepare(`
    INSERT INTO deliveries
      (driver_name, site_name, address, arrived_at,
       num_pallets, num_cartons, num_satchels,
       chep_count, chep_disposition,
       loscam_count, loscam_disposition,
       plain_count, plain_disposition,
       client_name, direction, dispatch_time,
       transport_name, temperature, temperature_value,
       chep_docket, location,
       condition, recipient_name, notes)
    VALUES
      (@driver_name, @site_name, @address, @arrived_at,
       @num_pallets, @num_cartons, @num_satchels,
       @chep_count, @chep_disposition,
       @loscam_count, @loscam_disposition,
       @plain_count, @plain_disposition,
       @client_name, @direction, @dispatch_time,
       @transport_name, @temperature, @temperature_value,
       @chep_docket, @location,
       @condition, @recipient_name, @notes)
  `);

  const result = stmt.run({
    driver_name, site_name,
    address: address || null,
    arrived_at,
    num_pallets: chep + loscam + plain,
    num_cartons: Math.max(0, parseInt(num_cartons) || 0),
    num_satchels: Math.max(0, parseInt(num_satchels) || 0),
    chep_count: chep,
    chep_disposition: chep > 0 ? (chep_disposition || null) : null,
    loscam_count: loscam,
    loscam_disposition: loscam > 0 ? (loscam_disposition || null) : null,
    plain_count: plain,
    plain_disposition: plain > 0 ? (plain_disposition || null) : null,
    client_name: client_name || null,
    direction: direction || null,
    dispatch_time: dispatch_time || null,
    transport_name: transport_name || null,
    temperature: temperature || null,
    temperature_value: temperature_value || null,
    chep_docket: chep_docket || null,
    location: location || null,
    condition: condition || 'Good',
    recipient_name: recipient_name || null,
    notes: notes || null
  });

  // Persist new driver/site/transport names automatically
  db.prepare('INSERT OR IGNORE INTO drivers (name) VALUES (?)').run(driver_name);
  db.prepare('INSERT OR IGNORE INTO sites (name, address) VALUES (?, ?)').run(site_name, address || null);
  if (client_name)    db.prepare('INSERT OR IGNORE INTO clients    (name) VALUES (?)').run(client_name);
  if (transport_name) db.prepare('INSERT OR IGNORE INTO transports (name) VALUES (?)').run(transport_name);
  if (recipient_name) db.prepare('INSERT OR IGNORE INTO recipients (name) VALUES (?)').run(recipient_name);

  const newRecord = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(result.lastInsertRowid);
  syncToSheets(newRecord); // fire-and-forget

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

  const headers = ['ID','Driver','Site','Address','Arrived At',
    'CHEP Count','CHEP Disposition','LOSCAM Count','LOSCAM Disposition','PLAIN Count','PLAIN Disposition',
    'Total Pallets','Cartons','Satchels','Client Name','Direction','Dispatch Time','Transport Name','Temperature Type','Temperature Value','CHEP Docket','Condition','Recipient','Notes','Submitted At'];
  const csv = [
    headers.join(','),
    ...rows.map(r => [
      r.id, csv_esc(r.driver_name), csv_esc(r.site_name), csv_esc(r.address),
      r.arrived_at,
      r.chep_count || 0, csv_esc(r.chep_disposition),
      r.loscam_count || 0, csv_esc(r.loscam_disposition),
      r.plain_count || 0, csv_esc(r.plain_disposition),
      r.num_pallets || 0, r.num_cartons || 0, r.num_satchels || 0,
      csv_esc(r.client_name), csv_esc(r.direction), csv_esc(r.dispatch_time), csv_esc(r.transport_name), csv_esc(r.temperature), csv_esc(r.temperature_value),
      csv_esc(r.chep_docket),
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

app.delete('/api/deliveries/:id', (req, res) => {
  db.prepare('DELETE FROM deliveries WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/deliveries', (_req, res) => {
  db.prepare('DELETE FROM deliveries').run();
  res.json({ ok: true });
});

app.post('/api/sync-to-sheets', async (_req, res) => {
  try {
    const url = process.env.GOOGLE_SHEET_WEBHOOK;
    if (!url) return res.status(400).json({ error: 'No Google Sheet webhook URL configured' });

    const rows = db.prepare('SELECT * FROM deliveries ORDER BY id ASC').all();
    let synced = 0, errors = 0;
    const failed = [];

    for (const row of rows) {
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row),
          signal: AbortSignal.timeout(15000)
        });
        if (r.ok) {
          synced++;
        } else {
          const text = await r.text().catch(() => '');
          console.error(`Manual sync: record #${row.id} failed status=${r.status} body=${text.slice(0, 200)}`);
          failed.push(row.id);
          errors++;
        }
      } catch (err) {
        console.error(`Manual sync: record #${row.id} error — ${err.message}`);
        failed.push(row.id);
        errors++;
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`Manual sync: ${synced} synced, ${errors} errors out of ${rows.length}${failed.length ? ' — failed IDs: ' + failed.join(',') : ''}`);
    res.json({ synced, errors, total: rows.length, failed });
  } catch (err) {
    console.error('Manual sync fatal error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// ── Drivers & Sites (for dropdowns) ─────────────────────────────────────────

app.get('/api/drivers', (_req, res) => {
  res.json(db.prepare('SELECT name FROM drivers ORDER BY name').all().map(r => r.name));
});

app.get('/api/sites', (_req, res) => {
  res.json(db.prepare('SELECT name, address FROM sites ORDER BY name').all());
});

app.get('/api/clients', (_req, res) => {
  res.json(db.prepare('SELECT name FROM clients ORDER BY name').all().map(r => r.name));
});

app.get('/api/transports', (_req, res) => {
  res.json(db.prepare('SELECT name FROM transports ORDER BY name').all().map(r => r.name));
});

app.get('/api/recipients', (_req, res) => {
  res.json(db.prepare('SELECT name FROM recipients ORDER BY name').all().map(r => r.name));
});

app.delete('/api/clients/:name',    (req, res) => { db.prepare('DELETE FROM clients    WHERE name = ?').run(decodeURIComponent(req.params.name)); res.json({ ok: true }); });
app.delete('/api/drivers/:name',    (req, res) => { db.prepare('DELETE FROM drivers    WHERE name = ?').run(decodeURIComponent(req.params.name)); res.json({ ok: true }); });
app.delete('/api/sites/:name',      (req, res) => { db.prepare('DELETE FROM sites      WHERE name = ?').run(decodeURIComponent(req.params.name)); res.json({ ok: true }); });
app.delete('/api/transports/:name', (req, res) => { db.prepare('DELETE FROM transports WHERE name = ?').run(decodeURIComponent(req.params.name)); res.json({ ok: true }); });
app.delete('/api/recipients/:name', (req, res) => { db.prepare('DELETE FROM recipients WHERE name = ?').run(decodeURIComponent(req.params.name)); res.json({ ok: true }); });

// ── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Serve SPA pages ──────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) return next(); // if env vars not set, allow through (dev mode)

  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Basic ')) {
    const [u, p] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    if (u === user && p === pass) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Be Cool Admin"');
  res.status(401).send('Unauthorised');
}

app.get('/admin', requireAuth, (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

async function syncSequenceWithSheets() {
  const url = process.env.GOOGLE_SHEET_WEBHOOK;
  if (!url) { console.log('Sequence sync: no webhook URL set, skipping'); return; }
  try {
    const res = await fetch(url + '?action=maxId', { signal: AbortSignal.timeout(8000) });
    const { maxId } = await res.json();
    if (maxId > 0) {
      const row = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'deliveries'").get();
      const currentSeq = row ? row.seq : 0;
      if (maxId > currentSeq) {
        if (row) {
          db.prepare("UPDATE sqlite_sequence SET seq = ? WHERE name = 'deliveries'").run(maxId);
        } else {
          db.prepare("INSERT INTO sqlite_sequence (name, seq) VALUES ('deliveries', ?)").run(maxId);
        }
        console.log(`Sequence sync: bumped SQLite seq from ${currentSeq} to ${maxId}`);
      } else {
        console.log(`Sequence sync: SQLite seq (${currentSeq}) already ahead of Sheets max (${maxId}), no change`);
      }
    } else {
      console.log('Sequence sync: Sheets has no records, keeping SQLite seq as-is');
    }
  } catch (err) {
    console.log('Sequence sync: skipped —', err.message);
  }
}

syncSequenceWithSheets().then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
});
