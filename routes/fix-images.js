import express from 'express';
import { Sequelize, Op } from 'sequelize';
import Image from '../models/Image.js';

const router = express.Router();

// Fix missing image references
router.post('/fix-missing-images', async (req, res) => {
  try {
    console.log('Checking for missing image references...');
    
    // Find records with the missing image using Sequelize
    const missingImages = await Image.findAll({
      where: {
        url: {
          [Op.like]: '%banner_1754119867135%'
        }
      }
    });

    if (missingImages.length > 0) {
      console.log('Found records with missing image:', missingImages);
      
      // Use an existing banner image as replacement
      const replacementUrl = 'https://elankodse-backend.onrender.com/uploads/images/banner_1753710841801.webp';
      
      console.log(`Updating to use: ${replacementUrl}`);
      
      // Update the records
      const updateResult = await Image.update(
        { url: replacementUrl },
        {
          where: {
            url: {
              [Op.like]: '%banner_1754119867135%'
            }
          }
        }
      );

      console.log(`Updated ${updateResult[0]} record(s)`);
      
      res.json({
        success: true,
        message: `Fixed ${updateResult[0]} missing image reference(s)`,
        updatedRecords: updateResult[0],
        replacementUrl: replacementUrl
      });
      
    } else {
      res.json({
        success: true,
        message: 'No missing image references found',
        updatedRecords: 0
      });
    }

  } catch (error) {
    console.error('Error fixing missing images:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Check for any missing image references
router.get('/check-missing-images', async (req, res) => {
  try {
    console.log('Checking for missing image references...');
    
    const missingImagePattern = 'banner_1754119867135';
    const results = {};
    
    // Check images table using Sequelize
    const imageRows = await Image.findAll({
      where: {
        url: {
          [Op.like]: `%${missingImagePattern}%`
        }
      }
    });
    
    if (imageRows.length > 0) {
      results.images = imageRows;
    }
    
    // Check available banner images
    const bannerImages = await Image.findAll({
      where: {
        url: {
          [Op.like]: '%banner_%'
        }
      },
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      missingImageReferences: results,
      availableBannerImages: bannerImages
    });

  } catch (error) {
    console.error('Error checking missing images:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
