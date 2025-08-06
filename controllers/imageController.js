import Image from '../models/Image.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import config from '../config/environment.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads/images');
try {
  await fs.mkdir(uploadsDir, { recursive: true });
} catch (error) {
  console.error('Error creating uploads directory:', error);
}

export const uploadImage = async (req, res) => {
  let tempFilePath = null;
  let finalFilePath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { name, type, description } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }

    // Validate image type - allow any type that starts with valid prefixes
    const validTypePrefixes = ['banner', 'profile', 'book_cover', 'author', 'footer', 'author_bg', 'blog_banner', 'ad_popup'];
    const isValidType = validTypePrefixes.some(prefix => type.startsWith(prefix));
    if (!isValidType) {
      return res.status(400).json({ error: 'Invalid image type' });
    }

    // Store temp file path for cleanup
    tempFilePath = req.file.path;

    // Generate unique filename
    const timestamp = Date.now();
    const extension = path.extname(req.file.originalname);
    const filename = `${type}_${timestamp}${extension}`;
    const newPath = path.join(uploadsDir, filename);
    finalFilePath = newPath;
    
    // Verify temp file exists before processing
    if (!await fs.access(tempFilePath).then(() => true).catch(() => false)) {
      throw new Error('Temporary upload file not found');
    }

    // Move file to final location
    await fs.rename(tempFilePath, newPath);
    console.log(`File moved from ${tempFilePath} to ${newPath}`);
    
    // Verify final file exists
    if (!await fs.access(newPath).then(() => true).catch(() => false)) {
      throw new Error('File move operation failed');
    }
    
    // Create relative path and URL
    const relativePath = `uploads/images/${filename}`;
    const baseUrl = config.getServerUrl();
    const url = `${baseUrl}/${relativePath}`;

    // Try to get image dimensions using sharp (optional)
    let width = null;
    let height = null;
    try {
      const imageInfo = await sharp(newPath).metadata();
      width = imageInfo.width;
      height = imageInfo.height;
      console.log(`Image dimensions: ${width}x${height}`);
    } catch (sharpError) {
      console.warn('Could not get image dimensions:', sharpError.message);
      // Continue without dimensions
    }

    // Save to database with transaction
    const image = await Image.create({
      name,
      type,
      filename,
      originalName: req.file.originalname,
      path: relativePath,
      url,
      size: req.file.size,
      mimeType: req.file.mimetype,
      width: width,
      height: height,
      description: description || null
    });

    console.log(`Image saved to database with ID: ${image.id}`);

    // Verify database entry was created and file still exists
    const verifyImage = await Image.findByPk(image.id);
    const fileStillExists = await fs.access(newPath).then(() => true).catch(() => false);
    
    if (!verifyImage || !fileStillExists) {
      throw new Error('Image upload verification failed');
    }

    res.status(201).json({
      message: 'Image uploaded successfully',
      image: {
        id: image.id,
        name: image.name,
        type: image.type,
        filename: image.filename,
        url: image.url,
        size: image.size,
        width: image.width,
        height: image.height,
        createdAt: image.createdAt
      }
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      file: req.file ? {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      } : 'No file',
      body: req.body,
      tempFilePath,
      finalFilePath
    });

    // Cleanup files on error
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
        console.log('Cleaned up temp file:', tempFilePath);
      } catch (cleanupError) {
        console.warn('Could not cleanup temp file:', cleanupError.message);
      }
    }
    
    if (finalFilePath) {
      try {
        await fs.unlink(finalFilePath);
        console.log('Cleaned up final file:', finalFilePath);
      } catch (cleanupError) {
        console.warn('Could not cleanup final file:', cleanupError.message);
      }
    }

    res.status(500).json({ 
      error: 'Failed to upload image', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

export const getAllImages = async (req, res) => {
  try {
    const { type } = req.query;
    
    let whereClause = {};
    if (type) {
      whereClause.type = type;
    }

    const images = await Image.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    res.json(images);
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
};

export const getImageById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const image = await Image.findByPk(id);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json(image);
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).json({ error: 'Failed to fetch image' });
  }
};

export const getActiveImageByType = async (req, res) => {
  try {
    const { type } = req.params;
    
    const image = await Image.findOne({
      where: {
        type,
        isActive: true
      },
      order: [['updatedAt', 'DESC']]
    });

    if (!image) {
      return res.status(404).json({ error: 'No active image found for this type' });
    }

    res.json(image);
  } catch (error) {
    console.error('Error fetching active image:', error);
    res.status(500).json({ error: 'Failed to fetch active image' });
  }
};

export const updateImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    
    const image = await Image.findByPk(id);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Update fields
    if (name !== undefined) image.name = name;
    if (description !== undefined) image.description = description;
    if (isActive !== undefined) image.isActive = isActive;

    await image.save();

    res.json({
      message: 'Image updated successfully',
      image
    });
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ error: 'Failed to update image' });
  }
};

export const deleteImage = async (req, res) => {
  try {
    const { id } = req.params;
    
    const image = await Image.findByPk(id);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete file from disk
    try {
      const fullPath = path.join(__dirname, '..', image.path);
      await fs.unlink(fullPath);
    } catch (fileError) {
      console.warn('Could not delete file from disk:', fileError.message);
    }

    // Delete from database
    await image.destroy();

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
};

export const setActiveImage = async (req, res) => {
  try {
    const { id } = req.params;
    
    const image = await Image.findByPk(id);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Deactivate all other images of the same type
    await Image.update(
      { isActive: false },
      { 
        where: { 
          type: image.type,
          id: { [Image.sequelize.Op.ne]: id }
        }
      }
    );

    // Activate this image
    image.isActive = true;
    await image.save();

    res.json({
      message: 'Image set as active successfully',
      image
    });
  } catch (error) {
    console.error('Error setting active image:', error);
    res.status(500).json({ error: 'Failed to set active image' });
  }
}; 