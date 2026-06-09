// server.js — Full Backend: Auth + Products + Customers + Subscriptions
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = 3251;
const JWT_SECRET = 'change_this_in_production_please';

// ─── DATABASE SETUP ───────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, 'database.db');
const db = new Database(DB_PATH);

db.exec(`PRAGMA journal_mode = WAL`);
db.exec(`PRAGMA foreign_keys = ON`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    email       TEXT    UNIQUE NOT NULL,
    password    TEXT    NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    name        TEXT    NOT NULL,
    price       REAL    NOT NULL DEFAULT 0,
    quantity    INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS customers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    name        TEXT    NOT NULL,
    email       TEXT,
    phone       TEXT,
    notes       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    customer_id    INTEGER NOT NULL,
    product_id     INTEGER NOT NULL,
    price          REAL    NOT NULL DEFAULT 0,
    num_users      INTEGER NOT NULL DEFAULT 1,
    billing_period TEXT    NOT NULL DEFAULT 'monthly',
    start_date     TEXT    NOT NULL,
    end_date       TEXT    NOT NULL,
    status         TEXT    NOT NULL DEFAULT 'active',
    auto_renewal   INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT    NOT NULL DEFAULT 'unpaid',
    notes          TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(id)     ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)  REFERENCES products(id)  ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscription_users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    user_name       TEXT    NOT NULL,
    start_date      TEXT    NOT NULL,
    end_date        TEXT    NOT NULL,
    price           REAL    NOT NULL DEFAULT 0,
    description     TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
  );
`);

// Save DB to file on process exit
process.on('exit', () => { try { db.close(); } catch(e) {} });
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// Migrate: add num_users column if not exists
try {
  db.exec(`ALTER TABLE subscriptions ADD COLUMN num_users INTEGER NOT NULL DEFAULT 1`);
} catch(e) {}

// Migrate: add transaction_date column to subscriptions if not exists
try {
  db.exec(`ALTER TABLE subscriptions ADD COLUMN transaction_date TEXT`);
  // Default to start_date for existing records
  db.exec(`UPDATE subscriptions SET transaction_date = start_date WHERE transaction_date IS NULL`);
  console.log('✅ Migrated: transaction_date column added');
} catch(e) {}

// Migrate: add voucher_no column
try {
  db.exec(`ALTER TABLE subscriptions ADD COLUMN voucher_no TEXT`);
  console.log('✅ Migrated: voucher_no column added');
} catch(e) {}

// Migrate: add price column to subscription_users if not exists
try {
  db.exec(`ALTER TABLE subscription_users ADD COLUMN price REAL NOT NULL DEFAULT 0`);
  console.log('✅ Migrated: subscription_users.price column added');
} catch(e) {}

// Migrate: add description column to subscription_users if not exists
try {
  db.exec(`ALTER TABLE subscription_users ADD COLUMN description TEXT`);
  console.log('✅ Migrated: subscription_users.description column added');
} catch(e) {}

console.log('✅ Database ready');

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:3252', credentials: true }));
app.use(express.json());

const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token required.' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(403).json({ message: 'Invalid token.' }); }
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const calcEndDate = (startDate, period) => {
  const d = new Date(startDate);
  switch (period) {
    case 'daily':        d.setDate(d.getDate() + 1);       break;
    case 'monthly':      d.setMonth(d.getMonth() + 1);     break;
    case 'quarterly':    d.setMonth(d.getMonth() + 3);     break;
    case 'half_yearly':  d.setMonth(d.getMonth() + 6);     break;
    case 'yearly':       d.setFullYear(d.getFullYear() + 1); break;
    default:             d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split('T')[0];
};

const syncStatus = () => {
  const today = new Date().toISOString().split('T')[0];
  db.run(`UPDATE subscriptions SET status='expired' WHERE end_date < ? AND status='active'`, [today]);
};

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields required.' });
    if (password.length < 6) return res.status(400).json({ message: 'Password min 6 characters.' });
    if (db.get('SELECT id FROM users WHERE email=?', [email.toLowerCase()]))
      return res.status(409).json({ message: 'Email already registered.' });
    const hashed = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (name,email,password) VALUES (?,?,?)', [name, email.toLowerCase(), hashed]);
    const user = db.get('SELECT * FROM users WHERE email=?', [email.toLowerCase()]);
    const token = jwt.sign({ id: user.id, name, email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'Registered!', token, user: { id: user.id, name, email } });
  } catch(e) { console.error(e); res.status(500).json({ message: 'Server error.' }); }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });
    const user = db.get('SELECT * FROM users WHERE email=?', [email.toLowerCase()]);
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: 'Invalid email or password.' });
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Login successful!', token, user: { id: user.id, name: user.name, email: user.email } });
  } catch(e) { console.error(e); res.status(500).json({ message: 'Server error.' }); }
});

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
app.get('/api/stats', auth, (req, res) => {
  syncStatus();
  const uid = req.user.id;
  const in7 = new Date(); in7.setDate(in7.getDate() + 7);
  const in7str = in7.toISOString().split('T')[0];

  const active         = db.get(`SELECT COUNT(*) as c FROM subscriptions WHERE user_id=? AND status='active'`, [uid]).c;
  const expiringSoon   = db.get(`SELECT COUNT(*) as c FROM subscriptions WHERE user_id=? AND status='active' AND end_date<=?`, [uid, in7str]).c;
  const totalCustomers = db.get(`SELECT COUNT(*) as c FROM customers WHERE user_id=?`, [uid]).c;
  const totalProducts  = db.get(`SELECT COUNT(*) as c FROM products WHERE user_id=?`, [uid]).c;

  const subs = db.all(`SELECT price, billing_period FROM subscriptions WHERE user_id=? AND status='active'`, [uid]);
  const periodToMonths = { daily: 1/30, monthly: 1, quarterly: 1/3, half_yearly: 1/6, yearly: 1/12 };
  const mrr = subs.reduce((sum, s) => sum + s.price * (periodToMonths[s.billing_period] || 1), 0);

  const unpaidCount = db.get(`SELECT COUNT(*) as c FROM subscriptions WHERE user_id=? AND payment_status='unpaid' AND status='active'`, [uid]).c;

  res.json({ stats: { active, expiringSoon, totalCustomers, totalProducts, mrr: Math.round(mrr), unpaidCount } });
});

// ─── PRODUCTS CRUD ────────────────────────────────────────────────────────────
app.get('/api/products', auth, (req, res) => {
  const { search } = req.query;
  let q = 'SELECT * FROM products WHERE user_id=?';
  const p = [req.user.id];
  if (search) { q += ' AND (name LIKE ? OR description LIKE ?)'; p.push(`%${search}%`, `%${search}%`); }
  res.json({ products: db.all(q + ' ORDER BY name', p) });
});

app.post('/api/products', auth, (req, res) => {
  const { name, price, quantity, description } = req.body;
  if (!name) return res.status(400).json({ message: 'Product name required.' });
  db.run('INSERT INTO products (user_id,name,price,quantity,description) VALUES (?,?,?,?,?)',
    [req.user.id, name.trim(), price||0, quantity||0, description||'']);
  const product = db.get('SELECT * FROM products WHERE rowid=last_insert_rowid()');
  res.status(201).json({ product });
});

app.put('/api/products/:id', auth, (req, res) => {
  const { name, price, quantity, description } = req.body;
  if (!name) return res.status(400).json({ message: 'Product name required.' });
  const exists = db.get('SELECT id FROM products WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!exists) return res.status(404).json({ message: 'Product not found.' });
  db.run('UPDATE products SET name=?,price=?,quantity=?,description=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?',
    [name.trim(), price||0, quantity||0, description||'', req.params.id, req.user.id]);
  res.json({ product: db.get('SELECT * FROM products WHERE id=?', [req.params.id]) });
});

app.delete('/api/products/:id', auth, (req, res) => {
  const exists = db.get('SELECT id FROM products WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!exists) return res.status(404).json({ message: 'Product not found.' });
  db.run('DELETE FROM products WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ message: 'Deleted.' });
});

// ─── CUSTOMERS CRUD ───────────────────────────────────────────────────────────
app.get('/api/customers', auth, (req, res) => {
  const { search } = req.query;
  let q = 'SELECT * FROM customers WHERE user_id=?';
  const p = [req.user.id];
  if (search) { q += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'; p.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const customers = db.all(q + ' ORDER BY name', p);

  // Add revenue + rating to each customer
  const revenues = customers.map(c => {
    const rev = db.get('SELECT COALESCE(SUM(price),0) as r FROM subscriptions WHERE user_id=? AND customer_id=?', [req.user.id, c.id]);
    return { id: c.id, rev: rev?.r || 0 };
  });
  const sorted = [...revenues].sort((a,b) => b.rev - a.rev);
  const total = sorted.length;

  const getRating = (rev) => {
    const rank = sorted.findIndex(r => r.id !== -1 && r.rev <= rev);
    const pct = total > 0 ? (sorted.findIndex(r => r.rev === rev) + 1) / total : 1;
    return pct <= 0.25 ? 'A' : pct <= 0.5 ? 'B' : pct <= 0.75 ? 'C' : 'D';
  };

  const result = customers.map(c => {
    const rev = revenues.find(r => r.id === c.id)?.rev || 0;
    return { ...c, total_revenue: rev, rating: total > 0 ? getRating(rev) : null };
  });

  res.json({ customers: result });
});

app.post('/api/customers', auth, (req, res) => {
  const { name, email, phone, notes } = req.body;
  if (!name) return res.status(400).json({ message: 'Customer name required.' });

  // Duplicate check — same name + phone
  const dupByPhone = phone
    ? db.get('SELECT id FROM customers WHERE user_id=? AND LOWER(name)=LOWER(?) AND phone=?',
        [req.user.id, name.trim(), phone.trim()])
    : null;
  if (dupByPhone) return res.status(409).json({ message: `Customer "${name}" with this phone already exists.` });

  // Duplicate check — same email
  const dupByEmail = email
    ? db.get('SELECT id FROM customers WHERE user_id=? AND LOWER(email)=LOWER(?)',
        [req.user.id, email.trim()])
    : null;
  if (dupByEmail) return res.status(409).json({ message: `A customer with email "${email}" already exists.` });

  // Duplicate check — same name (warn but allow if no phone/email match)
  const dupByName = db.get('SELECT id FROM customers WHERE user_id=? AND LOWER(name)=LOWER(?)',
    [req.user.id, name.trim()]);
  if (dupByName && !phone && !email)
    return res.status(409).json({ message: `Customer "${name}" already exists. Add phone or email to differentiate.` });

  db.run('INSERT INTO customers (user_id,name,email,phone,notes) VALUES (?,?,?,?,?)',
    [req.user.id, name.trim(), email||'', phone||'', notes||'']);
  const customer = db.get('SELECT * FROM customers WHERE rowid=last_insert_rowid()');
  res.status(201).json({ customer });
});

app.put('/api/customers/:id', auth, (req, res) => {
  const { name, email, phone, notes } = req.body;
  if (!name) return res.status(400).json({ message: 'Customer name required.' });
  const exists = db.get('SELECT id FROM customers WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!exists) return res.status(404).json({ message: 'Customer not found.' });
  db.run('UPDATE customers SET name=?,email=?,phone=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?',
    [name.trim(), email||'', phone||'', notes||'', req.params.id, req.user.id]);
  res.json({ customer: db.get('SELECT * FROM customers WHERE id=?', [req.params.id]) });
});

app.delete('/api/customers/:id', auth, (req, res) => {
  const exists = db.get('SELECT id FROM customers WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!exists) return res.status(404).json({ message: 'Customer not found.' });
  db.run('DELETE FROM customers WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ message: 'Deleted.' });
});

// Customer Profile — full history + FY analysis + rating
app.get('/api/customers/:id/profile', auth, (req, res) => {
  const uid = req.user.id;
  const cid = req.params.id;

  const customer = db.get('SELECT * FROM customers WHERE id=? AND user_id=?', [cid, uid]);
  if (!customer) return res.status(404).json({ message: 'Customer not found.' });

  syncStatus();

  // All subscriptions for this customer
  const subs = db.all(`
    SELECT s.*, p.name as product_name
    FROM subscriptions s
    JOIN products p ON s.product_id = p.id
    WHERE s.user_id=? AND s.customer_id=?
    ORDER BY s.transaction_date ASC, s.start_date ASC
  `, [uid, cid]);

  // Summary stats
  const totalRevenue  = subs.reduce((sum, s) => sum + (s.price || 0), 0);
  const paidRevenue   = subs.filter(s => s.payment_status === 'paid').reduce((sum, s) => sum + (s.price||0), 0);
  const unpaidRevenue = subs.filter(s => s.payment_status !== 'paid').reduce((sum, s) => sum + (s.price||0), 0);
  const activeCount   = subs.filter(s => s.status === 'active').length;
  const totalSubs     = subs.length;
  const firstDate     = subs.length > 0 ? (subs[0].transaction_date || subs[0].start_date) : null;
  const uniqueProducts= [...new Set(subs.map(s => s.product_id))].length;

  // FY grouping (Apr-Mar)
  const getFYStart = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const m = d.getMonth(), y = d.getFullYear();
    return m >= 3 ? y : y - 1;
  };

  // Product-wise FY history
  const productMap = {};
  for (const s of subs) {
    const pid = s.product_id;
    if (!productMap[pid]) {
      productMap[pid] = { product_id: pid, product_name: s.product_name, subs: [], total_revenue: 0 };
    }
    productMap[pid].subs.push(s);
    productMap[pid].total_revenue += s.price || 0;
  }

  const currentFYStart = getFYStart(new Date().toISOString().split('T')[0]);
  const firstFYStart   = firstDate ? getFYStart(firstDate) : currentFYStart;

  // All FY years from first to current
  const allFYs = [];
  for (let y = firstFYStart; y <= currentFYStart; y++) allFYs.push(y);

  const productHistory = Object.values(productMap).map(prod => {
    const fyMap = {};
    for (const s of prod.subs) {
      const fy = getFYStart(s.transaction_date || s.start_date);
      if (!fyMap[fy]) fyMap[fy] = { fy, subs: [], revenue: 0, status: s.status };
      fyMap[fy].subs.push(s);
      fyMap[fy].revenue += s.price || 0;
      fyMap[fy].status = s.status; // latest status
    }
    const timeline = allFYs.map(fy => ({
      fy,
      fy_label: `FY ${fy}-${String(fy+1).slice(2)}`,
      found: !!fyMap[fy],
      revenue: fyMap[fy]?.revenue || 0,
      status: fyMap[fy]?.status || 'missed',
      subs: fyMap[fy]?.subs || [],
    }));
    const missedFYs = timeline.filter(t => !t.found).length;
    const activeFYs = timeline.filter(t => t.found).length;
    return { ...prod, timeline, missed_fys: missedFYs, active_fys: activeFYs };
  }).sort((a, b) => b.total_revenue - a.total_revenue);

  // FY summary (all products combined)
  const fyRevMap = {};
  for (const s of subs) {
    const fy = getFYStart(s.transaction_date || s.start_date);
    if (!fyRevMap[fy]) fyRevMap[fy] = { fy, revenue: 0, count: 0, paid: 0, unpaid: 0, subs: [] };
    fyRevMap[fy].revenue += s.price || 0;
    fyRevMap[fy].count++;
    fyRevMap[fy].subs.push(s);
    if (s.payment_status === 'paid') fyRevMap[fy].paid += s.price || 0;
    else fyRevMap[fy].unpaid += s.price || 0;
  }
  const fyHistory = allFYs.map(fy => ({
    fy,
    fy_label: `FY ${fy}-${String(fy+1).slice(2)}`,
    found: !!fyRevMap[fy],
    revenue: fyRevMap[fy]?.revenue || 0,
    count: fyRevMap[fy]?.count || 0,
    paid: fyRevMap[fy]?.paid || 0,
    unpaid: fyRevMap[fy]?.unpaid || 0,
    subs: fyRevMap[fy]?.subs || [],
    status: fyRevMap[fy] ? 'active' : 'missed',
  }));

  // Rating — based on total revenue vs all customers
  const allRevenues = db.all(
    `SELECT SUM(price) as rev FROM subscriptions WHERE user_id=? GROUP BY customer_id ORDER BY rev DESC`,
    [uid]
  ).map(r => r.rev || 0);
  const rank = allRevenues.findIndex(r => r <= totalRevenue) + 1;
  const pct  = allRevenues.length > 0 ? rank / allRevenues.length : 1;
  const rating = pct <= 0.25 ? 'A' : pct <= 0.5 ? 'B' : pct <= 0.75 ? 'C' : 'D';
  const ratingLabel = { A:'⭐⭐⭐⭐ Gold', B:'⭐⭐⭐ Silver', C:'⭐⭐ Bronze', D:'⭐ Basic' };

  res.json({
    customer,
    stats: { totalRevenue, paidRevenue, unpaidRevenue, activeCount, totalSubs, firstDate, uniqueProducts },
    rating, ratingLabel: ratingLabel[rating],
    productHistory,
    fyHistory,
    allFYs,
    subs,
  });
});

// ─── SUBSCRIPTIONS CRUD ───────────────────────────────────────────────────────
app.get('/api/subscriptions', auth, (req, res) => {
  syncStatus();
  const {
    status, payment_status, search,
    billing_period, customer_id, product_id,
    fy, year, date_from, date_to,
    expiring_days, is_user_based, voucher_no,
  } = req.query;

  let q = `
    SELECT s.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
           p.name as product_name
    FROM subscriptions s
    JOIN customers c ON s.customer_id = c.id
    JOIN products  p ON s.product_id  = p.id
    WHERE s.user_id = ?
  `;
  const params = [req.user.id];

  if (status)         { q += ' AND s.status=?';         params.push(status); }
  if (payment_status) { q += ' AND s.payment_status=?'; params.push(payment_status); }
  if (billing_period) { q += ' AND s.billing_period=?'; params.push(billing_period); }
  if (customer_id)    { q += ' AND s.customer_id=?';    params.push(customer_id); }
  if (product_id)     { q += ' AND s.product_id=?';     params.push(product_id); }
  if (voucher_no)     { q += ' AND s.voucher_no LIKE ?'; params.push(`%${voucher_no}%`); }
  if (is_user_based !== undefined && is_user_based !== '') {
    q += ' AND s.is_user_based=?'; params.push(is_user_based === '1' ? 1 : 0);
  }
  if (search) {
    q += ' AND (c.name LIKE ? OR p.name LIKE ? OR s.voucher_no LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  // Financial Year filter (Apr-Mar) — based on transaction_date
  if (fy) {
    const fyStart = parseInt(fy);
    q += ` AND ((strftime('%m', s.transaction_date) >= '04' AND strftime('%Y', s.transaction_date) = ?)
            OR  (strftime('%m', s.transaction_date) < '04'  AND strftime('%Y', s.transaction_date) = ?))`;
    params.push(String(fyStart), String(fyStart + 1));
  }

  // Calendar year filter
  if (year) {
    q += ` AND strftime('%Y', s.transaction_date) = ?`;
    params.push(year);
  }

  // Date range filter
  if (date_from) { q += ' AND s.transaction_date >= ?'; params.push(date_from); }
  if (date_to)   { q += ' AND s.transaction_date <= ?'; params.push(date_to); }

  // Expiring in N days
  if (expiring_days) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(expiring_days));
    const futureDateStr = futureDate.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    q += ` AND s.end_date >= ? AND s.end_date <= ? AND s.status='active'`;
    params.push(todayStr, futureDateStr);
  }

  q += ' ORDER BY s.transaction_date DESC, s.end_date ASC';
  const subs = db.all(q, params);

  const result = subs.map(s => ({
    ...s,
    sub_users: db.all('SELECT * FROM subscription_users WHERE subscription_id=? ORDER BY start_date ASC', [s.id])
  }));

  res.json({ subscriptions: result });
});

app.post('/api/subscriptions', auth, (req, res) => {
  try {
    const { customer_id, product_id, price, num_users, billing_period, start_date, transaction_date, auto_renewal, payment_status, notes, sub_users, is_user_based, voucher_no } = req.body;
    if (!customer_id || !product_id) return res.status(400).json({ message: 'Customer and product required.' });
    if (!start_date) return res.status(400).json({ message: 'Start date required.' });

    const validPeriods = ['daily','monthly','quarterly','half_yearly','yearly'];
    if (!validPeriods.includes(billing_period)) return res.status(400).json({ message: 'Invalid billing period.' });

    const end_date = calcEndDate(start_date, billing_period);
    const today = new Date().toISOString().split('T')[0];
    const status = end_date < today ? 'expired' : 'active';
    const userBased = is_user_based ? 1 : 0;
    const txnDate = transaction_date || start_date;

    db.run(`INSERT INTO subscriptions (user_id,customer_id,product_id,price,num_users,billing_period,start_date,end_date,status,auto_renewal,payment_status,notes,is_user_based,transaction_date,voucher_no)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [req.user.id, customer_id, product_id, price||0, parseInt(num_users)||1, billing_period, start_date, end_date, status, auto_renewal?1:0, payment_status||'unpaid', notes||'', userBased, txnDate, voucher_no||'']);

    const newSub = db.get('SELECT id FROM subscriptions WHERE rowid=last_insert_rowid()');
    const subId = newSub.id;

    // Save sub_users only if user-based
    if (userBased && Array.isArray(sub_users)) {
      for (const u of sub_users) {
        if (u.user_name && u.start_date && u.end_date) {
          db.run('INSERT INTO subscription_users (subscription_id,user_name,start_date,end_date,price,description) VALUES (?,?,?,?,?,?)',
            [subId, u.user_name.trim(), u.start_date, u.end_date, parseFloat(u.price)||0, u.description||'']);
        }
      }
    }

    const sub = db.get(`
      SELECT s.*, c.name as customer_name, p.name as product_name
      FROM subscriptions s JOIN customers c ON s.customer_id=c.id JOIN products p ON s.product_id=p.id
      WHERE s.id=?`, [subId]);
    sub.sub_users = db.all('SELECT * FROM subscription_users WHERE subscription_id=?', [subId]);

    res.status(201).json({ message: 'Subscription created!', subscription: sub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/subscriptions/:id', auth, (req, res) => {
  try {
    const exists = db.get('SELECT id FROM subscriptions WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!exists) return res.status(404).json({ message: 'Subscription not found.' });

    const { customer_id, product_id, price, num_users, billing_period, start_date, transaction_date, auto_renewal, payment_status, notes, status, sub_users, is_user_based, voucher_no } = req.body;
    const end_date = calcEndDate(start_date, billing_period);
    const today = new Date().toISOString().split('T')[0];
    const computedStatus = status === 'cancelled' ? 'cancelled' : (end_date < today ? 'expired' : 'active');
    const userBased = is_user_based ? 1 : 0;
    const txnDate = transaction_date || start_date;

    db.run(`UPDATE subscriptions SET customer_id=?,product_id=?,price=?,num_users=?,billing_period=?,start_date=?,end_date=?,
      status=?,auto_renewal=?,payment_status=?,notes=?,is_user_based=?,transaction_date=?,voucher_no=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`,
      [customer_id, product_id, price||0, parseInt(num_users)||1, billing_period, start_date, end_date, computedStatus, auto_renewal?1:0, payment_status||'unpaid', notes||'', userBased, txnDate, voucher_no||'', req.params.id, req.user.id]);

    // Replace sub_users only if user-based
    db.run('DELETE FROM subscription_users WHERE subscription_id=?', [req.params.id]);
    if (userBased && Array.isArray(sub_users)) {
      for (const u of sub_users) {
        if (u.user_name && u.start_date && u.end_date) {
          db.run('INSERT INTO subscription_users (subscription_id,user_name,start_date,end_date,price,description) VALUES (?,?,?,?,?,?)',
            [req.params.id, u.user_name.trim(), u.start_date, u.end_date, parseFloat(u.price)||0, u.description||'']);
        }
      }
    }

    const sub = db.get(`
      SELECT s.*, c.name as customer_name, p.name as product_name
      FROM subscriptions s JOIN customers c ON s.customer_id=c.id JOIN products p ON s.product_id=p.id
      WHERE s.id=?`, [req.params.id]);
    sub.sub_users = db.all('SELECT * FROM subscription_users WHERE subscription_id=?', [req.params.id]);

    res.json({ message: 'Updated!', subscription: sub });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error.' }); }
});

app.delete('/api/subscriptions/:id', auth, (req, res) => {
  const exists = db.get('SELECT id FROM subscriptions WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!exists) return res.status(404).json({ message: 'Not found.' });
  db.run('DELETE FROM subscriptions WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  res.json({ message: 'Deleted.' });
});

// Renew a subscription
app.post('/api/subscriptions/:id/renew', auth, (req, res) => {
  const sub = db.get('SELECT * FROM subscriptions WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
  if (!sub) return res.status(404).json({ message: 'Not found.' });
  const newEnd = calcEndDate(sub.end_date, sub.billing_period);
  db.run(`UPDATE subscriptions SET end_date=?,status='active',payment_status='unpaid',updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [newEnd, sub.id]);
  res.json({ message: 'Renewed!', end_date: newEnd });
});

// Import Subscriptions from Excel (2-sheet format)
app.post('/api/import/subscriptions', auth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });

    // Sheet 1: Subscriptions
    const ws1 = wb.Sheets['Subscriptions'] || wb.Sheets[wb.SheetNames[0]];
    const subRows = XLSX.utils.sheet_to_json(ws1, { defval: '' });

    // Sheet 2: Subscription_Users (optional)
    const ws2 = wb.Sheets['Subscription_Users'] || wb.Sheets[wb.SheetNames[1]];
    const userRows = ws2 ? XLSX.utils.sheet_to_json(ws2, { defval: '' }) : [];

    if (subRows.length === 0) return res.status(400).json({ message: 'Subscriptions sheet is empty.' });

    let inserted = 0, skipped = 0, errors = [];

    for (const row of subRows) {
      try {
        const ref            = String(row['ref'] || row['Ref'] || '').trim();
        const customerName   = String(row['customer_name'] || row['Customer'] || '').trim();
        const productName    = String(row['product_name']  || row['Product']  || '').trim();
        const billingPeriod  = String(row['billing_period'] || 'monthly').trim().toLowerCase();
        const price          = parseFloat(row['price'] || 0) || 0;
        const paymentStatus  = String(row['payment_status'] || 'unpaid').trim().toLowerCase();
        const autoRenewal    = ['yes','true','1'].includes(String(row['auto_renewal']).toLowerCase()) ? 1 : 0;
        const isUserBased    = ['yes','true','1'].includes(String(row['is_user_based']).toLowerCase()) ? 1 : 0;
        const startDate      = String(row['start_date'] || '').trim();
        const txnDate        = String(row['transaction_date'] || row['txn_date'] || startDate).trim();
        const voucherNo      = String(row['voucher_no'] || row['voucher'] || '').trim();
        const notes          = String(row['notes'] || '').trim();

        if (!customerName) { skipped++; errors.push(`Row ${ref||'?'}: customer_name missing`); continue; }
        if (!productName)  { skipped++; errors.push(`Row ${ref||'?'}: product_name missing`); continue; }
        if (!startDate)    { skipped++; errors.push(`Row ${ref||'?'}: start_date missing`); continue; }

        // Find customer
        const customer = db.get(
          `SELECT id FROM customers WHERE user_id=? AND name LIKE ?`,
          [req.user.id, `%${customerName}%`]
        );
        if (!customer) { skipped++; errors.push(`"${customerName}": customer not found — add customer first`); continue; }

        // Find product
        const product = db.get(
          `SELECT id,price FROM products WHERE user_id=? AND name LIKE ?`,
          [req.user.id, `%${productName}%`]
        );
        if (!product) { skipped++; errors.push(`"${productName}": product not found — add product first`); continue; }

        // Validate billing period
        const validPeriods = ['daily','monthly','quarterly','half_yearly','yearly'];
        const bp = validPeriods.includes(billingPeriod) ? billingPeriod : 'monthly';

        // Calculate end date
        const endDate = calcEndDate(startDate, bp);
        const todayStr = new Date().toISOString().split('T')[0];
        const status = endDate < todayStr ? 'expired' : 'active';
        const finalPrice = price || product.price || 0;

        // Get users for this ref
        const subUsers = ref ? userRows.filter(u =>
          String(u['subscription_ref'] || u['ref'] || '').trim() === ref
        ) : [];

        const numUsers = isUserBased ? (subUsers.length || 1) : 0;

        // Insert subscription
        db.run(`INSERT INTO subscriptions
          (user_id,customer_id,product_id,price,num_users,billing_period,start_date,end_date,status,auto_renewal,payment_status,notes,is_user_based,transaction_date,voucher_no)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [req.user.id, customer.id, product.id, finalPrice, numUsers, bp, startDate, endDate, status, autoRenewal, paymentStatus, notes, isUserBased, txnDate, voucherNo]);

        const newSub = db.get('SELECT id FROM subscriptions WHERE rowid=last_insert_rowid()');
        const subId = newSub.id;

        // Insert sub_users
        if (isUserBased && subUsers.length > 0) {
          for (const u of subUsers) {
            const uName  = String(u['user_name'] || u['name'] || '').trim();
            const uStart = String(u['start_date'] || startDate).trim();
            const uEnd   = String(u['end_date']   || endDate).trim();
            const uPrice = parseFloat(u['price'] || 0) || 0;
            const uDesc  = String(u['description'] || '').trim();
            if (uName) {
              db.run('INSERT INTO subscription_users (subscription_id,user_name,start_date,end_date,price,description) VALUES (?,?,?,?,?,?)',
                [subId, uName, uStart, uEnd, uPrice, uDesc]);
            }
          }
        }

        inserted++;
      } catch(e) {
        skipped++;
        errors.push(`Row error: ${e.message}`);
      }
    }

    res.json({ message: `Import done! ${inserted} subscriptions added, ${skipped} skipped.`, inserted, skipped, errors });
  } catch(e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to parse Excel file.' });
  }
});

// Download subscription import template
app.get('/api/import/template/subscriptions', auth, (req, res) => {
  const wb = XLSX.utils.book_new();

  const subHeaders = ['ref','customer_name','product_name','billing_period','price','payment_status','auto_renewal','is_user_based','start_date','notes'];
  const subSample  = [
    ['S001','Customer Name Here','Product Name Here','yearly','5000','paid','yes','no','2026-04-01','AMC contract'],
    ['S002','Customer Name Here','Tally Prime Single User','yearly','13500','unpaid','yes','yes','2026-04-01','Single user'],
    ['S003','Customer Name Here','Tally Prime Multi User (5)','yearly','38000','paid','yes','yes','2026-04-01','5 users'],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet([subHeaders, ...subSample]);
  ws1['!cols'] = subHeaders.map((_,i) => ({ wch: [6,28,28,14,8,14,12,12,12,30][i] }));
  XLSX.utils.book_append_sheet(wb, ws1, 'Subscriptions');

  const userHeaders = ['subscription_ref','user_name','start_date','end_date','price','description'];
  const userSample  = [
    ['S002','Rahul Sharma','2026-04-01','2027-03-31','13500','Main user'],
    ['S003','Priya Desai','2026-04-01','2027-03-31','8000','Admin'],
    ['S003','Amit Kulkarni','2026-05-01','2027-04-30','7500','Accounts'],
    ['S003','Sneha More','2026-06-01','2027-05-31','7500','HR'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet([userHeaders, ...userSample]);
  ws2['!cols'] = [{wch:16},{wch:22},{wch:12},{wch:12},{wch:8},{wch:40}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Subscription_Users');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="subscriptions_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────

// Customer Renewal History — year-wise per customer+product
app.get('/api/reports/renewal-history', auth, (req, res) => {
  syncStatus();
  const uid = req.user.id;
  const { customer_id, product_id } = req.query;

  let q = `
    SELECT s.id, s.customer_id, s.product_id, s.start_date, s.end_date,
           s.price, s.status, s.payment_status, s.transaction_date,
           c.name as customer_name, c.phone as customer_phone,
           p.name as product_name
    FROM subscriptions s
    JOIN customers c ON s.customer_id = c.id
    JOIN products  p ON s.product_id  = p.id
    WHERE s.user_id = ?
  `;
  const params = [uid];
  if (customer_id) { q += ' AND s.customer_id=?'; params.push(customer_id); }
  if (product_id)  { q += ' AND s.product_id=?';  params.push(product_id); }
  q += ' ORDER BY s.customer_id, s.product_id, s.start_date ASC';

  const rows = db.all(q, params);

  const grouped = {};
  for (const row of rows) {
    const key = `${row.customer_id}_${row.product_id}`;
    if (!grouped[key]) {
      grouped[key] = {
        customer_id: row.customer_id, customer_name: row.customer_name,
        customer_phone: row.customer_phone, product_id: row.product_id,
        product_name: row.product_name, subscriptions: [],
      };
    }
    grouped[key].subscriptions.push({
      id: row.id, start_date: row.start_date, end_date: row.end_date,
      year: new Date(row.start_date).getFullYear(),
      price: row.price, status: row.status,
      payment_status: row.payment_status, transaction_date: row.transaction_date,
    });
  }

  const result = Object.values(grouped).map(g => {
    const subs = g.subscriptions;
    const years = subs.map(s => s.year);
    const minYear = Math.min(...years);
    const maxYear = new Date().getFullYear();
    const allYears = [];
    for (let y = minYear; y <= maxYear; y++) allYears.push(y);

    const yearMap = {};
    for (const y of allYears) {
      const sub = subs.find(s => s.year === y);
      yearMap[y] = sub ? { ...sub, found: true } : { year: y, found: false, status: 'missed' };
    }

    const activeYears  = subs.filter(s => s.status !== 'cancelled').length;
    const missedYears  = allYears.filter(y => !yearMap[y].found).length;
    const totalRevenue = subs.reduce((sum, s) => sum + (s.price || 0), 0);
    const lastSub      = subs[subs.length - 1];
    const isActive     = lastSub?.status === 'active';

    let streak = 0;
    for (let y = maxYear; y >= minYear; y--) {
      if (yearMap[y].found && yearMap[y].status !== 'cancelled') streak++;
      else break;
    }

    return {
      ...g, year_map: yearMap, all_years: allYears,
      active_years: activeYears, missed_years: missedYears,
      total_revenue: totalRevenue, first_year: minYear,
      streak, is_active: isActive, loyalty_years: maxYear - minYear + 1,
    };
  });

  res.json({ report: result });
});

// At-Risk customers — active last year, not renewed this year
app.get('/api/reports/at-risk', auth, (req, res) => {
  syncStatus();
  const uid = req.user.id;
  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;

  const lastYearSubs = db.all(`
    SELECT DISTINCT customer_id, product_id FROM subscriptions
    WHERE user_id=? AND strftime('%Y', start_date)=? AND status != 'cancelled'
  `, [uid, String(lastYear)]);

  const atRisk = [];
  for (const s of lastYearSubs) {
    const thisYearSub = db.get(`
      SELECT id FROM subscriptions WHERE user_id=? AND customer_id=? AND product_id=?
      AND strftime('%Y', start_date)=?
    `, [uid, s.customer_id, s.product_id, String(thisYear)]);

    if (!thisYearSub) {
      const c = db.get('SELECT name, phone FROM customers WHERE id=?', [s.customer_id]);
      const p = db.get('SELECT name FROM products WHERE id=?', [s.product_id]);
      const lastSub = db.get(`
        SELECT price, end_date FROM subscriptions
        WHERE user_id=? AND customer_id=? AND product_id=? ORDER BY start_date DESC LIMIT 1
      `, [uid, s.customer_id, s.product_id]);
      atRisk.push({
        customer_id: s.customer_id, customer_name: c?.name, customer_phone: c?.phone,
        product_id: s.product_id, product_name: p?.name,
        last_price: lastSub?.price, last_end_date: lastSub?.end_date,
      });
    }
  }
  res.json({ at_risk: atRisk });
});

// Financial Year Expiry Report — grouped by end_date
app.get('/api/reports/fy-expiry', auth, (req, res) => {
  syncStatus();
  const uid = req.user.id;

  const rows = db.all(`
    SELECT s.id, s.customer_id, s.product_id, s.start_date, s.end_date,
           s.price, s.status, s.payment_status, s.transaction_date,
           s.billing_period, s.is_user_based, s.voucher_no,
           c.name as customer_name, c.phone as customer_phone,
           p.name as product_name
    FROM subscriptions s
    JOIN customers c ON s.customer_id = c.id
    JOIN products  p ON s.product_id  = p.id
    WHERE s.user_id = ? AND s.status != 'cancelled'
    ORDER BY s.end_date ASC
  `, [uid]);

  if (rows.length === 0) return res.json({ fy_data: [] });

  const fyMap = {};
  for (const row of rows) {
    const dateStr = row.end_date;
    const d = new Date(dateStr);
    const m = d.getMonth();
    const y = d.getFullYear();
    const fyStart = m >= 3 ? y : y - 1;
    const fyKey = `${fyStart}`;

    if (!fyMap[fyKey]) {
      fyMap[fyKey] = {
        fy_start: fyStart,
        fy_label: `FY ${fyStart}-${String(fyStart+1).slice(2)}`,
        fy_from:  `${fyStart}-04-01`,
        fy_to:    `${fyStart+1}-03-31`,
        total_subs: 0,
        total_revenue: 0,
        paid_revenue: 0,
        unpaid_revenue: 0,
        active_count: 0,
        expired_count: 0,
        customer_ids: new Set(),
        months: {}
      };
      for (let mi = 0; mi < 12; mi++) {
        const mIdx = (mi + 3) % 12;
        const mYear = mi < 9 ? fyStart : fyStart + 1;
        const mKey = `${mYear}-${String(mIdx+1).padStart(2,'0')}`;
        fyMap[fyKey].months[mKey] = {
          month_key: mKey,
          month_label: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][mIdx],
          month_year: mYear,
          subs: [], count: 0, revenue: 0, paid: 0, unpaid: 0,
          active_count: 0, expired_count: 0,
        };
      }
    }

    const fy = fyMap[fyKey];
    const mKey = dateStr.slice(0,7);

    fy.total_subs++;
    fy.total_revenue += row.price || 0;
    fy.customer_ids.add(row.customer_id);
    if (row.payment_status === 'paid') fy.paid_revenue += row.price || 0;
    else fy.unpaid_revenue += row.price || 0;
    if (row.status === 'active') fy.active_count++;
    else fy.expired_count++;

    if (fy.months[mKey]) {
      fy.months[mKey].subs.push({
        id: row.id,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        product_name: row.product_name,
        price: row.price,
        status: row.status,
        payment_status: row.payment_status,
        start_date: row.start_date,
        end_date: row.end_date,
        transaction_date: row.transaction_date,
        billing_period: row.billing_period,
        voucher_no: row.voucher_no,
      });
      fy.months[mKey].count++;
      fy.months[mKey].revenue += row.price || 0;
      if (row.payment_status === 'paid') fy.months[mKey].paid += row.price || 0;
      else fy.months[mKey].unpaid += row.price || 0;
      if (row.status === 'active') fy.months[mKey].active_count++;
      else fy.months[mKey].expired_count++;
    }
  }

  const result = Object.values(fyMap)
    .sort((a, b) => a.fy_start - b.fy_start)
    .map(fy => ({
      ...fy,
      customer_count: fy.customer_ids.size,
      customer_ids: undefined,
      months: Object.values(fy.months),
    }));

  res.json({ fy_data: result });
});

// Financial Year Report
app.get('/api/reports/fy', auth, (req, res) => {
  syncStatus();
  const uid = req.user.id;

  // Get all subscriptions with transaction_date
  const rows = db.all(`
    SELECT s.id, s.customer_id, s.product_id, s.start_date, s.end_date,
           s.price, s.status, s.payment_status, s.transaction_date,
           s.billing_period, s.is_user_based, s.voucher_no,
           c.name as customer_name, c.phone as customer_phone,
           p.name as product_name
    FROM subscriptions s
    JOIN customers c ON s.customer_id = c.id
    JOIN products  p ON s.product_id  = p.id
    WHERE s.user_id = ?
    ORDER BY s.transaction_date ASC, s.start_date ASC
  `, [uid]);

  if (rows.length === 0) return res.json({ fy_data: [] });

  // Group by Financial Year (Apr-Mar)
  const fyMap = {};
  for (const row of rows) {
    const dateStr = row.transaction_date || row.start_date;
    const d = new Date(dateStr);
    const m = d.getMonth(); // 0=Jan
    const y = d.getFullYear();
    const fyStart = m >= 3 ? y : y - 1; // April=3
    const fyKey = `${fyStart}`;

    if (!fyMap[fyKey]) {
      fyMap[fyKey] = {
        fy_start: fyStart,
        fy_label: `FY ${fyStart}-${String(fyStart+1).slice(2)}`,
        fy_from:  `${fyStart}-04-01`,
        fy_to:    `${fyStart+1}-03-31`,
        total_subs: 0,
        total_revenue: 0,
        paid_revenue: 0,
        unpaid_revenue: 0,
        active_count: 0,
        expired_count: 0,
        customer_ids: new Set(),
        months: {}
      };
      // Init 12 months Apr-Mar
      for (let mi = 0; mi < 12; mi++) {
        const mIdx = (mi + 3) % 12; // 3=Apr,4=May,...,11=Dec,0=Jan,1=Feb,2=Mar
        const mYear = mi < 9 ? fyStart : fyStart + 1;
        const mKey = `${mYear}-${String(mIdx+1).padStart(2,'0')}`;
        fyMap[fyKey].months[mKey] = {
          month_key: mKey,
          month_label: ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][mIdx],
          month_year: mYear,
          subs: [],
          count: 0,
          revenue: 0,
          paid: 0,
          unpaid: 0,
        };
      }
    }

    const fy = fyMap[fyKey];
    const mKey = dateStr.slice(0,7); // "2024-04"

    fy.total_subs++;
    fy.total_revenue += row.price || 0;
    fy.customer_ids.add(row.customer_id);
    if (row.payment_status === 'paid') fy.paid_revenue += row.price || 0;
    else fy.unpaid_revenue += row.price || 0;
    if (row.status === 'active') fy.active_count++;
    else if (row.status === 'expired') fy.expired_count++;

    if (fy.months[mKey]) {
      fy.months[mKey].subs.push({
        id: row.id,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        product_name: row.product_name,
        price: row.price,
        status: row.status,
        payment_status: row.payment_status,
        start_date: row.start_date,
        end_date: row.end_date,
        transaction_date: row.transaction_date,
        billing_period: row.billing_period,
        voucher_no: row.voucher_no,
      });
      fy.months[mKey].count++;
      fy.months[mKey].revenue += row.price || 0;
      if (row.payment_status === 'paid') fy.months[mKey].paid += row.price || 0;
      else fy.months[mKey].unpaid += row.price || 0;
    }
  }

  // Convert to array, sort by FY
  const result = Object.values(fyMap)
    .sort((a, b) => a.fy_start - b.fy_start)
    .map(fy => ({
      ...fy,
      customer_count: fy.customer_ids.size,
      customer_ids: undefined, // remove Set
      months: Object.values(fy.months), // array of 12 months
    }));

  res.json({ fy_data: result });
});

// Download sample templates
app.get('/api/import/template/:type', auth, (req, res) => {
  const { type } = req.params;
  let headers = [];
  let sample = [];

  if (type === 'customers') {
    headers = ['name', 'email', 'phone', 'notes'];
    sample  = [['Vrushali Infotech', 'info@vrushali.com', '9876543210', 'Premium client'],
               ['Ganesh Traders', 'ganesh@traders.com', '9123456789', '']];
  } else if (type === 'products') {
    headers = ['name', 'price', 'quantity', 'description'];
    sample  = [['Tally Prime', '13500', '10', 'Accounting software'],
               ['AMC Contract', '5000', '0', 'Annual maintenance']];
  } else {
    return res.status(400).json({ message: 'Invalid type. Use customers or products.' });
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  // Column widths
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, type);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="${type}_template.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// Import Customers from Excel
app.post('/api/import/customers', auth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ message: 'Excel file is empty.' });

    let inserted = 0, skipped = 0, errors = [];

    for (const row of rows) {
      const name  = String(row['name'] || row['Name'] || '').trim();
      const email = String(row['email'] || row['Email'] || '').trim().toLowerCase();
      const phone = String(row['phone'] || row['Phone'] || '').trim();
      const notes = String(row['notes'] || row['Notes'] || '').trim();

      if (!name) { skipped++; errors.push(`Row skipped: name is empty`); continue; }

      // Duplicate check
      const dup = db.get(`SELECT id FROM customers WHERE user_id=? AND LOWER(name)=LOWER(?)`, [req.user.id, name]);
      if (dup) { skipped++; errors.push(`"${name}" skipped: already exists`); continue; }

      try {
        db.run('INSERT INTO customers (user_id,name,email,phone,notes) VALUES (?,?,?,?,?)',
          [req.user.id, name, email, phone, notes]);
        inserted++;
      } catch(e) {
        skipped++;
        errors.push(`"${name}" skipped: ${e.message}`);
      }
    }

    res.json({ message: `Import done! ${inserted} added, ${skipped} skipped.`, inserted, skipped, errors });
  } catch(e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to parse Excel file. Make sure it is a valid .xlsx file.' });
  }
});

// Import Products from Excel
app.post('/api/import/products', auth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ message: 'Excel file is empty.' });

    let inserted = 0, skipped = 0, errors = [];

    for (const row of rows) {
      const name        = String(row['name'] || row['Name'] || '').trim();
      const price       = parseFloat(row['price'] || row['Price'] || 0) || 0;
      const quantity    = parseInt(row['quantity'] || row['Quantity'] || 0) || 0;
      const description = String(row['description'] || row['Description'] || '').trim();

      if (!name) { skipped++; errors.push(`Row skipped: name is empty`); continue; }

      try {
        db.run('INSERT INTO products (user_id,name,price,quantity,description) VALUES (?,?,?,?,?)',
          [req.user.id, name, price, quantity, description]);
        inserted++;
      } catch(e) {
        skipped++;
        errors.push(`"${name}" skipped: ${e.message}`);
      }
    }

    res.json({ message: `Import done! ${inserted} added, ${skipped} skipped.`, inserted, skipped, errors });
  } catch(e) {
    console.error(e);
    res.status(500).json({ message: 'Failed to parse Excel file.' });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running: http://localhost:${PORT}`));
