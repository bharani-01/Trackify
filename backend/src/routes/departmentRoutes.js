const express = require('express');
const router = express.Router();
const {
  getDepartments,
  createDepartment,
  deleteDepartment
} = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Get departments (public list access for registration dropdowns)
router.get('/', getDepartments);

// Admin-only mutations
router.post('/', protect, authorize('admin'), createDepartment);
router.delete('/:id', protect, authorize('admin'), deleteDepartment);

module.exports = router;
