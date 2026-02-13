const jwt = require('jsonwebtoken'); require('dotenv').config(); const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

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

  const query = 'SELECT * FROM users WHERE email = ? AND password_hash = MD5(?)';
  db.query(query, [email, password], (err, results) => {
    if (err) {
      console.error('Login query error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    console.log('Login query results length:', results && results.length);

    if (results && results.length > 0) {
      const user = results[0];
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '2h' }
      );
      return res.status(200).json({ success: true, token, message: 'Login successful' });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  });
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
