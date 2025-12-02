const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');

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

// Login route using MD5(password) in query
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

  const query = 'SELECT * FROM employee WHERE email = ? AND password = MD5(?)';
  db.query(query, [email, password], (err, results) => {
    if (err) {
      console.error('Login query error:', err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (results && results.length > 0) {
      // login success — return a simple token placeholder or success flag
      return res.status(200).json({ success: true, token: '123456', message: 'Login successful' });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  });
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
