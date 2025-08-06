import express from 'express';
import auth from '../middleware/auth.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// Get all notifications for user
router.get('/', auth, async (req, res) => {
  const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json(notifications);
});

// Create a notification for user
router.post('/', auth, async (req, res) => {
  const { message } = req.body;
  const notification = await Notification.create({ user: req.user.id, message });
  res.status(201).json(notification);
});

// Mark notification as read
router.put('/:id/read', auth, async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id },
    { read: true },
    { new: true }
  );
  if (!notification) return res.status(404).json({ error: 'Notification not found' });
  res.json(notification);
});

export default router; 