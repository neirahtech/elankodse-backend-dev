import express from 'express';
import { body, validationResult } from 'express-validator';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// In-memory storage for development (in production, use database)
let subscribers = [];

// File path for persistent storage
const subscribersFilePath = path.join(__dirname, '../data/subscribers.json');

// Initialize subscribers from file
const loadSubscribers = async () => {
  try {
    const data = await fs.readFile(subscribersFilePath, 'utf8');
    subscribers = JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is empty, start with empty array
    subscribers = [];
  }
};

// Save subscribers to file
const saveSubscribers = async () => {
  try {
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '../data');
    await fs.mkdir(dataDir, { recursive: true });
    
    await fs.writeFile(subscribersFilePath, JSON.stringify(subscribers, null, 2));
  } catch (error) {
    console.error('Error saving subscribers:', error);
  }
};

// Initialize on startup
loadSubscribers();

// Subscribe to newsletter
router.post('/subscribe', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Check if email already exists
    if (subscribers.some(sub => sub.email === email)) {
      return res.status(409).json({
        success: false,
        message: 'Email already subscribed'
      });
    }

    // Add new subscriber
    const newSubscriber = {
      email,
      subscribedAt: new Date().toISOString(),
      active: true,
      id: Date.now().toString() // Simple ID generation
    };

    subscribers.push(newSubscriber);
    await saveSubscribers();

    // Log subscription for monitoring
    console.log(`New subscriber: ${email} at ${newSubscriber.subscribedAt}`);

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter',
      data: {
        email: newSubscriber.email,
        subscribedAt: newSubscriber.subscribedAt
      }
    });

  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to subscribe. Please try again later.'
    });
  }
});

// Unsubscribe from newsletter
router.post('/unsubscribe', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address',
        errors: errors.array()
      });
    }

    const { email } = req.body;

    // Find and remove subscriber
    const subscriberIndex = subscribers.findIndex(sub => sub.email === email);
    
    if (subscriberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Email not found in subscribers list'
      });
    }

    // Mark as inactive instead of removing (for analytics)
    subscribers[subscriberIndex].active = false;
    subscribers[subscriberIndex].unsubscribedAt = new Date().toISOString();
    
    await saveSubscribers();

    console.log(`Unsubscribed: ${email}`);

    res.json({
      success: true,
      message: 'Successfully unsubscribed from newsletter'
    });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unsubscribe. Please try again later.'
    });
  }
});

// Get subscriber count (public endpoint)
router.get('/count', (req, res) => {
  const activeSubscribers = subscribers.filter(sub => sub.active).length;
  
  res.json({
    success: true,
    data: {
      totalSubscribers: activeSubscribers
    }
  });
});

// Admin: Get all subscribers (protected route - would need auth middleware in production)
router.get('/admin/subscribers', (req, res) => {
  // In production, add authentication middleware here
  const activeSubscribers = subscribers.filter(sub => sub.active);
  
  res.json({
    success: true,
    data: {
      subscribers: activeSubscribers,
      total: activeSubscribers.length,
      inactive: subscribers.filter(sub => !sub.active).length
    }
  });
});

// Admin: Export subscribers (protected route)
router.get('/admin/export', (req, res) => {
  // In production, add authentication middleware here
  const activeSubscribers = subscribers.filter(sub => sub.active);
  const csvData = activeSubscribers.map(sub => 
    `${sub.email},${sub.subscribedAt}`
  ).join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv');
  res.send(`Email,Subscribed At\n${csvData}`);
});

export default router;
