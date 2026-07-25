const announcementRepo = require('../repositories/announcementRepository');
const userRepo = require('../repositories/userRepository');

class AnnouncementController {
  async getStudentAnnouncements(req, res) {
    try {
      const userId = req.user.id;
      const user = await userRepo.findById(userId);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const announcements = await announcementRepo.getByStudentContext({
        department_id: user.department_id,
        semester: user.semester
      });

      return res.json({
        success: true,
        announcements
      });
    } catch (error) {
      console.error('Error fetching student announcements:', error);
      return res.status(500).json({ success: false, message: 'Server error fetching announcements' });
    }
  }

  async getAdminAnnouncements(req, res) {
    try {
      const announcements = await announcementRepo.getAllAdmin();
      return res.json({
        success: true,
        announcements
      });
    } catch (error) {
      console.error('Error fetching admin announcements:', error);
      return res.status(500).json({ success: false, message: 'Server error fetching admin announcements' });
    }
  }

  async createAnnouncement(req, res) {
    try {
      const { title, content, category, priority, department_id, semester, is_pinned, expires_at, send_email } = req.body;
      const posted_by = req.user.id;

      if (!title || !title.trim() || !content || !content.trim()) {
        return res.status(400).json({ success: false, message: 'Title and content are required' });
      }

      const newAnn = await announcementRepo.create({
        title: title.trim(),
        content: content.trim(),
        category: category || 'General',
        priority: priority || 'normal',
        department_id: department_id || null,
        semester: semester ? parseInt(semester, 10) : null,
        posted_by,
        is_pinned: is_pinned === true || is_pinned === 'true',
        expires_at: expires_at || null
      });

      // Send email notifications to target students if requested
      if (send_email === true || send_email === 'true') {
        try {
          const students = await userRepo.findStudentsByContext({
            department_id: department_id || null,
            semester: semester || null
          });

          for (const student of students) {
            const htmlContent = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
                <h2 style="color: #2563eb; margin-bottom: 16px;">New Announcement: ${title.trim()}</h2>
                <p style="color: #475569; font-size: 16px; line-height: 24px;">Hello ${student.name},</p>
                <p style="color: #475569; font-size: 16px; line-height: 24px;">A new announcement has been posted on Trackify:</p>
                <div style="margin: 20px 0; padding: 15px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                  <h3 style="margin-top: 0; color: #0f172a;">${title.trim()}</h3>
                  <p style="color: #334155; font-size: 14px; white-space: pre-wrap;">${content.trim()}</p>
                  <div style="margin-top: 15px; font-size: 12px; color: #64748b;">
                    Category: <strong>${category || 'General'}</strong> | Priority: <strong>${priority || 'normal'}</strong>
                  </div>
                </div>
                <p style="color: #64748b; font-size: 14px;">Log in to your Trackify portal to see more details.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="color: #94a3b8; font-size: 12px;">Trackify Academic Management System</p>
              </div>
            `;
            const { queueEmail } = require('../utils/emailHelper');
            await queueEmail(student.email, student.name, `New Announcement: ${title.trim()}`, htmlContent);
          }
        } catch (emailErr) {
          console.error('[ANNOUNCEMENT EMAIL WARNING]: Failed to send announcement emails:', emailErr.message);
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Announcement published successfully',
        announcement: newAnn
      });
    } catch (error) {
      console.error('Error creating announcement:', error);
      return res.status(500).json({ success: false, message: 'Server error creating announcement' });
    }
  }

  async updateAnnouncement(req, res) {
    try {
      const { id } = req.params;
      const { title, content, category, priority, department_id, semester, is_pinned, expires_at } = req.body;

      const existing = await announcementRepo.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Announcement not found' });
      }

      const updated = await announcementRepo.update(id, {
        title: title ? title.trim() : existing.title,
        content: content ? content.trim() : existing.content,
        category: category || existing.category,
        priority: priority || existing.priority,
        department_id: department_id !== undefined ? department_id : existing.department_id,
        semester: semester !== undefined ? semester : existing.semester,
        is_pinned: is_pinned !== undefined ? is_pinned : existing.is_pinned,
        expires_at: expires_at !== undefined ? expires_at : existing.expires_at
      });

      return res.json({
        success: true,
        message: 'Announcement updated successfully',
        announcement: updated
      });
    } catch (error) {
      console.error('Error updating announcement:', error);
      return res.status(500).json({ success: false, message: 'Server error updating announcement' });
    }
  }

  async deleteAnnouncement(req, res) {
    try {
      const { id } = req.params;
      const existing = await announcementRepo.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Announcement not found' });
      }

      await announcementRepo.delete(id);

      return res.json({
        success: true,
        message: 'Announcement deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting announcement:', error);
      return res.status(500).json({ success: false, message: 'Server error deleting announcement' });
    }
  }
}

module.exports = new AnnouncementController();
