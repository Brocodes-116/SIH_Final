const express = require('express');
const { getAllTourists, createTourist, updateLocation } = require('../controllers/touristController');

const router = express.Router();

// GET /api/tourists
router.get('/', getAllTourists);

// POST /api/tourists
router.post('/', createTourist);

// PUT /api/tourists/:touristId/location
router.put('/:touristId/location', updateLocation);

module.exports = router;
