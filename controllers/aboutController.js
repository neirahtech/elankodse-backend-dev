import About from '../models/About.js';

export const getAboutContent = async (req, res) => {
  try {
    // Get the most recent about content entry (there should only be one)
    const aboutContent = await About.findOne({
      order: [['updatedAt', 'DESC']]
    });

    if (!aboutContent) {
      return res.status(404).json({ 
        error: 'About content not found',
        message: 'No about content has been created yet'
      });
    }

    res.json(aboutContent);
  } catch (err) {
    console.error('Error fetching about content:', err);
    res.status(500).json({ 
      error: 'Failed to fetch about content',
      message: err.message 
    });
  }
};

export const updateAboutContent = async (req, res) => {
  try {
    const {
      introduction,
      biography,
      interests,
      books,
      awards,
      authorName,
      authorTitle,
      email,
      contactLabel
    } = req.body;

    // Validate required fields
    if (!authorName || !email) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Author name and email are required'
      });
    }

    // Check if about content already exists
    let aboutContent = await About.findOne({
      order: [['updatedAt', 'DESC']]
    });

    if (aboutContent) {
      // Update existing content
      aboutContent = await aboutContent.update({
        introduction,
        biography,
        interests,
        books,
        awards,
        authorName,
        authorTitle,
        email,
        contactLabel,
        updatedAt: new Date()
      });
    } else {
      // Create new content
      aboutContent = await About.create({
        introduction,
        biography,
        interests,
        books,
        awards,
        authorName,
        authorTitle,
        email,
        contactLabel
      });
    }

    res.json({
      message: 'About content updated successfully',
      data: aboutContent
    });
  } catch (err) {
    console.error('Error updating about content:', err);
    res.status(500).json({ 
      error: 'Failed to update about content',
      message: err.message 
    });
  }
};

export const createAboutContent = async (req, res) => {
  try {
    const {
      introduction,
      biography,
      interests,
      books,
      awards,
      authorName,
      authorTitle,
      email,
      contactLabel
    } = req.body;

    // Validate required fields
    if (!authorName || !email) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'Author name and email are required'
      });
    }

    // Check if about content already exists
    const existingContent = await About.findOne();
    if (existingContent) {
      return res.status(409).json({
        error: 'About content already exists',
        message: 'Use PUT /api/about to update existing content'
      });
    }

    const aboutContent = await About.create({
      introduction,
      biography,
      interests,
      books,
      awards,
      authorName,
      authorTitle,
      email,
      contactLabel
    });

    res.status(201).json({
      message: 'About content created successfully',
      data: aboutContent
    });
  } catch (err) {
    console.error('Error creating about content:', err);
    res.status(500).json({ 
      error: 'Failed to create about content',
      message: err.message 
    });
  }
};
