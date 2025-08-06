import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import { getUrls } from '../config/constants.js';

const router = express.Router();

// Update user info
router.put('/profile', auth, async (req, res) => {
  const { firstName, lastName, avatar } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { firstName, lastName, avatar },
    { new: true }
  ).select('-password');
  res.json(user);
});

// Change password
router.put('/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id);
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect' });
  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ message: 'Password updated' });
});

// Ad popup settings
router.get('/ad-popup', async (req, res) => {
  try {
    const urls = getUrls();
    
    // For now, return default settings
    // In the future, you can store this in database
    res.json({
      enabled: false, // Disable ad popup by default
      imageUrl: `${urls.backend}/uploads/images/ad_popup_1753611038506.jpg`,
      title: 'Special Offer',
      message: 'Check out our latest books!',
      showInterval: 24 * 60 * 60 * 1000 // 24 hours
    });
  } catch (error) {
    console.error('Error fetching ad popup settings:', error);
    res.status(500).json({ error: 'Failed to fetch ad popup settings' });
  }
});

export default router; 