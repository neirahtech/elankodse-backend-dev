import express from 'express';
import { getPostById } from '../controllers/postController.js';
import Post from '../models/Post.js';
import Book from '../models/Book.js';
import { generatePostHTML, generateBookHTML } from '../utils/htmlTemplate.js';
import { getUrls } from '../config/constants.js';

const router = express.Router();

// Get meta data for a specific post (for social media sharing)
router.get('/post/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to find by postId first, then by id
    let post = await Post.findOne({ 
      where: { 
        postId: id,
        status: 'published',
        hidden: false
      },
      attributes: ['id', 'postId', 'title', 'subtitle', 'content', 'coverImage', 'author', 'date', 'category', 'excerpt', 'publishedAt']
    });
    
    if (!post) {
      // If not found by postId, try by numeric id
      const numericId = parseInt(id);
      if (!isNaN(numericId)) {
        post = await Post.findOne({
          where: { 
            id: numericId,
            status: 'published',
            hidden: false
          },
          attributes: ['id', 'postId', 'title', 'subtitle', 'content', 'coverImage', 'author', 'date', 'category', 'excerpt', 'publishedAt']
        });
      }
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postData = post.toJSON();
    
    // Extract first image from content if no cover image
    let metaImage = postData.coverImage;
    if (!metaImage && postData.content) {
      const imgRegex = /<img[^>]+src="([^">]+)"/i;
      const imgMatch = postData.content.match(imgRegex);
      if (imgMatch) {
        metaImage = imgMatch[1];
      }
    }
    
    // Clean HTML from content for description
    const cleanContent = postData.content ? postData.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : '';
    const metaDescription = postData.excerpt || cleanContent.slice(0, 160) + (cleanContent.length > 160 ? '...' : '');
    
    // Prepare meta data
    const urls = getUrls();
    const metaData = {
      title: postData.title || 'Elanko | தமிழ் இலக்கியம்',
      description: metaDescription,
      image: metaImage || '/src/assets/images/BlackAndBeigeFeminineHowToWebsiteBlogBanner.jpg',
      url: urls.getPostUrl(postData.postId),
      type: 'article',
      author: postData.author || 'Elanko',
      publishedTime: postData.publishedAt || postData.date,
      category: postData.category || 'தமிழ் இலக்கியம்',
      siteName: 'Elanko'
    };

    res.json(metaData);
  } catch (error) {
    console.error('Error fetching post meta data:', error);
    res.status(500).json({ error: 'Failed to fetch post meta data' });
  }
});

// Serve HTML page with proper meta tags for social media crawlers
router.get('/post/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to find by postId first, then by id
    let post = await Post.findOne({ 
      where: { 
        postId: id,
        status: 'published',
        hidden: false
      },
      attributes: ['id', 'postId', 'title', 'subtitle', 'content', 'coverImage', 'author', 'date', 'category', 'excerpt', 'publishedAt']
    });
    
    if (!post) {
      // If not found by postId, try by numeric id
      const numericId = parseInt(id);
      if (!isNaN(numericId)) {
        post = await Post.findOne({
          where: { 
            id: numericId,
            status: 'published',
            hidden: false
          },
          attributes: ['id', 'postId', 'title', 'subtitle', 'content', 'coverImage', 'author', 'date', 'category', 'excerpt', 'publishedAt']
        });
      }
    }

    if (!post) {
      return res.status(404).send('<h1>Post not found</h1>');
    }

    const postData = post.toJSON();
    
    // Extract first image from content if no cover image
    let metaImage = postData.coverImage;
    if (!metaImage && postData.content) {
      const imgRegex = /<img[^>]+src="([^">]+)"/i;
      const imgMatch = postData.content.match(imgRegex);
      if (imgMatch) {
        metaImage = imgMatch[1];
      }
    }
    
    // Clean HTML from content for description
    const cleanContent = postData.content ? postData.content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : '';
    const metaDescription = postData.excerpt || cleanContent.slice(0, 160) + (cleanContent.length > 160 ? '...' : '');
    
    // Prepare meta data
    const urls = getUrls();
    const metaData = {
      title: postData.title || 'Elanko | தமிழ் இலக்கியம்',
      description: metaDescription,
      image: metaImage || urls.getAssetUrl('/src/assets/images/BlackAndBeigeFeminineHowToWebsiteBlogBanner.jpg'),
      url: urls.getPostUrl(postData.postId),
      type: 'article',
      author: postData.author || 'Elanko',
      publishedTime: postData.publishedAt || postData.date,
      category: postData.category || 'தமிழ் இலக்கியம்',
      siteName: 'Elanko'
    };

    // Generate and serve the HTML with meta tags
    const html = generatePostHTML(metaData);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    console.error('Error serving post preview:', error);
    res.status(500).send('<h1>Server Error</h1>');
  }
});

// Get meta data for a specific book (for social media sharing)
router.get('/book/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const book = await Book.findByPk(id, {
      attributes: ['id', 'title', 'originalTitle', 'description', 'coverImage', 'category', 'genre', 'publishedYear', 'linkType', 'linkValue']
    });

    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const bookData = book.toJSON();
    
    // Generate description from book details
    let metaDescription = bookData.description || '';
    if (!metaDescription) {
      metaDescription = `${bookData.title} - எழுத்தாளர் இளங்கோவின் ${bookData.genre || 'புத்தகம்'}`;
      if (bookData.publishedYear) {
        metaDescription += ` (${bookData.publishedYear})`;
      }
    }
    
    // Prepare meta data
    const urls = getUrls();
    const metaData = {
      title: `${bookData.title} | எழுத்தாளர் இளங்கோ புத்தகங்கள்`,
      description: metaDescription,
      image: bookData.coverImage || null, // Don't force a default image
      url: urls.getBookUrl(bookData.id),
      type: 'book',
      author: 'எழுத்தாளர் இளங்கோ',
      publishedTime: bookData.publishedYear ? `${bookData.publishedYear}-01-01` : null,
      category: bookData.genre || 'தமிழ் இலக்கியம்',
      siteName: 'Elanko'
    };

    res.json(metaData);
  } catch (error) {
    console.error('Error fetching book meta data:', error);
    res.status(500).json({ error: 'Failed to fetch book meta data' });
  }
});

// Serve HTML page with proper meta tags for social media crawlers (books)
router.get('/book/:id/preview', async (req, res) => {
  try {
    const { id } = req.params;
    
    const book = await Book.findByPk(id, {
      attributes: ['id', 'title', 'originalTitle', 'description', 'coverImage', 'category', 'genre', 'publishedYear', 'linkType', 'linkValue']
    });

    if (!book) {
      return res.status(404).send('<h1>Book Not Found</h1>');
    }

    const bookData = book.toJSON();
    
    // Generate description from book details
    let metaDescription = bookData.description || '';
    if (!metaDescription) {
      metaDescription = `${bookData.title} - எழுத்தாளர் இளங்கோவின் ${bookData.genre || 'புத்தகம்'}`;
      if (bookData.publishedYear) {
        metaDescription += ` (${bookData.publishedYear})`;
      }
    }
    
    const urls = getUrls();
    const metaData = {
      title: `${bookData.title} | எழுத்தாளர் இளங்கோ புத்தகங்கள்`,
      description: metaDescription,
      image: bookData.coverImage || null, // Don't force a default image
      url: urls.getBookUrl(bookData.id),
      type: 'book',
      author: 'எழுத்தாளர் இளங்கோ',
      publishedTime: bookData.publishedYear ? `${bookData.publishedYear}-01-01` : null,
      category: bookData.genre || 'தமிழ் இலக்கியம்',
      siteName: 'Elanko'
    };

    // Generate and serve the HTML with meta tags
    const html = generateBookHTML(metaData);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    console.error('Error serving book preview:', error);
    res.status(500).send('<h1>Server Error</h1>');
  }
});

export default router;
