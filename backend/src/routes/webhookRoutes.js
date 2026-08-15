const express = require('express');
const router = express.Router();
const { handleResendInboundWebhook } = require('../controllers/webhookController');

// POST /api/webhooks/resend-inbound (Public webhook endpoint for Resend)
router.post('/resend-inbound', handleResendInboundWebhook);

module.exports = router;
