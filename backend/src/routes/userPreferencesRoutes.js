const express = require('express');
const router = express.Router();
const { getPreferences, updatePreferences } = require('../controllers/userPreferencesController');
const { protect } = require('../middleware/authMiddleware');

// All preferences routes are protected
router.use(protect);

router.route('/')
  .get(getPreferences)
  .put(updatePreferences);

module.exports = router;
