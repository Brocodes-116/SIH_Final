const express = require('express');
const { createSOS, getAllSOS, respondToSOS, deleteSOS } = require('../controllers/sosController');
const { sosRateLimit } = require('../middleware/security');

const router = express.Router();

// POST /api/sos (rate limited)
router.post('/', sosRateLimit, createSOS);

// GET /api/sos (no rate limit; used by dashboards)
router.get('/', getAllSOS);

// PUT /api/sos/:sosId/respond
router.put('/:sosId/respond', respondToSOS);

// DELETE /api/sos/:sosId
router.delete('/:sosId', deleteSOS);

module.exports = router;
