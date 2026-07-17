const userRepository = require('../repositories/userRepository');
const auditLogRepository = require('../repositories/auditLogRepository');

/**
 * Get all pending registration requests
 * @route GET /api/admin/approvals
 */
const getPendingApprovals = async (req, res) => {
  try {
    const pendingUsers = await userRepository.findPendingUsers();
    return res.status(200).json({
      success: true,
      users: pendingUsers
    });
  } catch (error) {
    console.error('getPendingApprovals controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving pending registration requests.'
    });
  }
};

/**
 * Approve a registration request
 * @route PUT /api/admin/approvals/:id/approve
 */
const approveRegistration = async (req, res) => {
  const { id } = req.params;

  try {
    const approvedUser = await userRepository.approveUser(id);

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'REGISTRATION_APPROVED',
      `Approved student registration for ${approvedUser.name} (${approvedUser.register_number})`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: `Account for student ${approvedUser.name} (${approvedUser.register_number}) has been approved and provisioned successfully.`,
      user: approvedUser
    });
  } catch (error) {
    console.error('approveRegistration controller error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error approving registration request.'
    });
  }
};

/**
 * Reject a registration request
 * @route DELETE /api/admin/approvals/:id/reject
 */
const rejectRegistration = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await userRepository.rejectUser(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Pending registration request not found'
      });
    }

    // Log action
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await auditLogRepository.logAction(
      req.user.id,
      'REGISTRATION_REJECTED',
      `Rejected and deleted pending registration request with ID ${id}`,
      ip
    );

    return res.status(200).json({
      success: true,
      message: 'Registration request rejected and deleted successfully.'
    });
  } catch (error) {
    console.error('rejectRegistration controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error rejecting registration request.'
    });
  }
};

module.exports = {
  getPendingApprovals,
  approveRegistration,
  rejectRegistration
};
