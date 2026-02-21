const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mysql = require('mysql2');
require('dotenv').config();

// Use the same DB config as server.js
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'rentprox'
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Public user signup
router.post('/signup', (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password || !phone) {
    return res.status(400).json({ success: false, message: 'All fields required' });
  }
  // Default role for public users is 'tenant' (or change as needed)
  const role = 'tenant';
  const q = `INSERT INTO public_users (name, email, password_hash, phone, role, created_at) VALUES (?, ?, MD5(?), ?, ?, NOW())`;
  db.query(q, [name, email, password, phone, role], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Email already exists' });
      return res.status(500).json({ success: false, message: 'Server error' });
    }
    return res.json({ success: true, id: result.insertId });
  });
});

// Public user login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
  const q = 'SELECT * FROM public_users WHERE email = ? AND password_hash = MD5(?)';
  db.query(q, [email, password], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: 'Server error' });
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


// Example: Get all listings
router.get('/', (req, res) => {
  // TODO: Fetch all listings from DB
  res.json({ success: true, listings: [] });
});

// Example: Get a single listing by ID
router.get('/:id', (req, res) => {
  // TODO: Fetch listing by ID from DB
  res.json({ success: true, listing: null });
});

// Example: Create a new listing
router.post('/', (req, res) => {
  // TODO: Insert new listing into DB
  res.json({ success: true, id: 1 });
});

// Example: Update a listing by ID
router.put('/:id', (req, res) => {
  // TODO: Update listing in DB
  res.json({ success: true });
});

// Example: Delete a listing by ID
router.delete('/:id', (req, res) => {
  // TODO: Delete listing from DB
  res.json({ success: true });
});

module.exports = router;


