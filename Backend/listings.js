const express = require('express');
const router = express.Router();

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


