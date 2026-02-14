const jwt = require('jsonwebtoken'); require('dotenv').config(); const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Debug middleware for API requests
app.use('/api', (req, res, next) => {
  console.log('API Request:', req.method, req.originalUrl, 'Authorization:', !!req.headers.authorization, 'Query.token:', !!req.query.token);
  next();
});

// Authentication middleware using JWT
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || req.query.token || req.headers['x-access-token'];
  if (!authHeader) return res.status(401).send('Unauthorized');
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    console.error('Token verify error:', err && err.message);
    return res.status(401).send('Invalid token');
  }
}

// Protected admin page route (will run before static middleware below)
app.get('/admin_dashboard.html', authenticate, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Frontend', 'admin_dashboard.html'));
});

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'rentprox' 
  
});

db.connect(err => {
  if (err) {
    console.error('MySQL connection error:', err.message || err);
  } else {
    console.log('MySQL Connected');
  }
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'Frontend')));

// Serve top-level assets (images, css) that live at project root /assets
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// Ensure root serves the admin login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'Frontend', 'admin_login.html'));
});

// Login route using MD5(password) in query
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', { email });
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

  // Verify email and password only
  const query = 'SELECT * FROM users WHERE email = ? AND password_hash = MD5(?)';
  db.query(query, [email, password], (err, results) => {
    if (err) {
      console.error('Login query error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (results && results.length > 0) {
      const u = results[0];
      const token = jwt.sign(
        { id: u.id, email: u.email, role: u.role },
        JWT_SECRET,
        { expiresIn: '2h' }
      );
      return res.status(200).json({ success: true, token, message: 'Login successful' });
    }
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  });
});

// Protected API to list admins
app.get('/api/admins', authenticate, (req, res) => {
  const q = `SELECT id, name, email, role, created_at FROM users WHERE role = 'admin'`;
  db.query(q, (err, results) => {
    if (err) {
      console.error('Admins query error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    return res.json({ success: true, admins: results });
  });
});

// Protected API to create a new admin
app.post('/api/admins', authenticate, (req, res) => {
  let { name, email, password } = req.body;
  name = (name || '').trim();
  email = (email || '').trim().toLowerCase();
  password = password || '';

  if (!name || !email || !password) return res.status(400).json({ success: false, message: 'name,email,password required' });

  const q = `INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, MD5(?), 'admin', NOW())`;
  db.query(q, [name, email, password], (err, result) => {
    if (err) {
      console.error('Create admin error:', err);
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Email already exists' });
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    return res.json({ success: true, id: result.insertId });
  });
});



// Delete admin - protected
app.delete('/api/admins/:id', authenticate, (req, res) => {
  const id = Number(req.params.id) || 0;
  if (!id) return res.status(400).json({ success: false, message: 'Invalid id' });
  const q = 'DELETE FROM users WHERE id = ? AND role = "admin"';
  db.query(q, [id], (err, result) => {
    if (err) {
      console.error('Delete admin error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Admin not found' });
    return res.json({ success: true });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
