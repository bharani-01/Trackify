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
      const { title, content, category, priority, department_id, semester, is_pinned } = req.body;
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
        is_pinned: is_pinned === true || is_pinned === 'true'
      });

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
      const { title, content, category, priority, department_id, semester, is_pinned } = req.body;

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
        is_pinned: is_pinned !== undefined ? is_pinned : existing.is_pinned
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
