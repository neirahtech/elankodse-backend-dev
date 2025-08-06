import express from 'express';
import { body, validationResult } from 'express-validator';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// File path for footer content storage
const footerContentPath = path.join(__dirname, '../data/footerContent.json');

// Default footer content
const defaultFooterContent = {
  authorName: 'இளங்கோ',
  authorTitle: 'Writer',
  contactEmail: 'elanko@rogers.com',
  contactTitle: 'தொடர்புக்கு',
  contactLabel: 'எழுத்தாளர் தொடர்பு:',
  socialLinks: {
    facebook: { url: '#', visible: true },
    twitter: { url: '#', visible: true },
    instagram: { url: '#', visible: true },
    youtube: { url: '#', visible: true },
    linkedin: { url: '#', visible: true },
    telegram: { url: '#', visible: true },
    whatsapp: { url: '#', visible: true },
    github: { url: '#', visible: true },
    email: { url: '#', visible: true },
    rss: { url: '#', visible: true },
    website: { url: '#', visible: true },
    tiktok: { url: '#', visible: true }
  },
  newsletterTitle: 'பதிவுகளை உடனடியாக பெற'
};

// Load footer content from file
const loadFooterContent = async () => {
  try {
    const data = await fs.readFile(footerContentPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist, return default content
    return defaultFooterContent;
  }
};

// Save footer content to file
const saveFooterContent = async (content) => {
  try {
    // Ensure data directory exists
    const dataDir = path.join(__dirname, '../data');
    await fs.mkdir(dataDir, { recursive: true });
    
    await fs.writeFile(footerContentPath, JSON.stringify(content, null, 2));
  } catch (error) {
    console.error('Error saving footer content:', error);
    throw error;
  }
};

// Get footer content
router.get('/', async (req, res) => {
  try {
    const content = await loadFooterContent();
    
    res.json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Error loading footer content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load footer content'
    });
  }
});

// Update footer content (protected route - would need auth middleware in production)
router.put('/', [
  body('authorName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Author name is required and must be less than 100 characters'),
  body('authorTitle')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Author title is required and must be less than 50 characters'),
  body('contactEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid contact email is required'),
  body('contactTitle')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Contact title is required and must be less than 50 characters'),
  body('contactLabel')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Contact label is required and must be less than 100 characters'),
  body('newsletterTitle')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Newsletter title is required and must be less than 100 characters'),
  body('socialLinks')
    .isObject()
    .withMessage('Social links must be an object')
], async (req, res) => {
  try {
    // In production, add authentication middleware here
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { authorName, authorTitle, contactEmail, contactTitle, contactLabel, socialLinks, newsletterTitle } = req.body;

    // Ensure social links have the correct structure
    const formattedSocialLinks = {};
    Object.keys(defaultFooterContent.socialLinks).forEach(platform => {
      const linkData = socialLinks[platform];
      if (linkData && typeof linkData === 'object') {
        formattedSocialLinks[platform] = {
          url: linkData.url || '#',
          visible: linkData.visible !== undefined ? linkData.visible : true
        };
      } else {
        // Handle old format or missing data
        formattedSocialLinks[platform] = {
          url: typeof linkData === 'string' ? linkData : '#',
          visible: true
        };
      }
    });

    const updatedContent = {
      authorName,
      authorTitle,
      contactEmail,
      contactTitle,
      contactLabel,
      socialLinks: formattedSocialLinks,
      newsletterTitle,
      updatedAt: new Date().toISOString()
    };

    await saveFooterContent(updatedContent);

    console.log('Footer content updated:', updatedContent);

    res.json({
      success: true,
      message: 'Footer content updated successfully',
      data: updatedContent
    });

  } catch (error) {
    console.error('Error updating footer content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update footer content'
    });
  }
});

// Reset footer content to default
router.post('/reset', async (req, res) => {
  try {
    // In production, add authentication middleware here
    
    await saveFooterContent(defaultFooterContent);

    res.json({
      success: true,
      message: 'Footer content reset to default',
      data: defaultFooterContent
    });

  } catch (error) {
    console.error('Error resetting footer content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset footer content'
    });
  }
});

export default router;
