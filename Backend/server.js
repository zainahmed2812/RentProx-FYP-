const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

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
      // login success — return a simple token placeholder or success flag
      return res.status(200).json({ success: true, token: '123456', message: 'Login successful' });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  });
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
