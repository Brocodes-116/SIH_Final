const express = require('express');
const { createSOS, getAllSOS, respondToSOS, deleteSOS } = require('../controllers/sosController');

const router = express.Router();

// POST /api/sos
router.post('/', createSOS);

// GET /api/sos
router.get('/', getAllSOS);

// PUT /api/sos/:sosId/respond
router.put('/:sosId/respond', respondToSOS);

// DELETE /api/sos/:sosId
router.delete('/:sosId', deleteSOS);

module.exports = router;
