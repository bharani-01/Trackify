const departmentRepository = require('../repositories/departmentRepository');

/**
 * Get all departments
 */
const getDepartments = async (req, res) => {
  try {
    const departments = await departmentRepository.getDepartments();
    return res.status(200).json({
      success: true,
      departments
    });
  } catch (error) {
    console.error('getDepartments controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve departments'
    });
  }
};

/**
 * Create a new department (Admin only)
 */
const createDepartment = async (req, res) => {
  const { code, name } = req.body;

  if (!code || !name) {
    return res.status(400).json({
      success: false,
      message: 'Department code and name are required'
    });
  }

  try {
    const department = await departmentRepository.createDepartment(code, name);
    return res.status(201).json({
      success: true,
      message: 'Department created successfully',
      department
    });
  } catch (error) {
    console.error('createDepartment controller error:', error);
    if (error.code === '23505') { // Unique constraint violation in PG
      return res.status(400).json({
        success: false,
        message: 'A department with this code already exists'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to create department'
    });
  }
};

/**
 * Delete an existing department (Admin only)
 */
const deleteDepartment = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await departmentRepository.deleteDepartment(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }
    return res.status(200).json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    console.error('deleteDepartment controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete department'
    });
  }
};

module.exports = {
  getDepartments,
  createDepartment,
  deleteDepartment
};
