import express from 'express';
import Post from '../models/Post.js';
import { getUrls } from '../config/constants.js';

const router = express.Router();

// Helper function to clean HTML tags from text
function cleanHtmlTags(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// Helper function to extract first two lines of text content
function getFirstTwoLines(text) {
  if (!text) return '';
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length >= 2) return lines.slice(0, 2).join(' ');
  return lines[0] || '';
}

// Helper function to extract first image from content
function extractFirstImageFromContent(content) {
  if (!content) return null;
  const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
  return imgMatch ? imgMatch[1] : null;
}

// Generate social media meta data for a post
router.get('/meta/:postId', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const urls = getUrls();
    
    const metaData = {
      title: post.title,
      description: getFirstTwoLines(cleanHtmlTags(post.content)),
      image: post.coverImage || extractFirstImageFromContent(post.content) || urls.getAssetUrl('/src/assets/images/BlackAndBeigeFeminineHowToWebsiteBlogBanner.jpg'),
      url: urls.getPostUrl(post.id),
      type: 'article',
      siteName: 'Elanko',
      publishedTime: post.publishedDate || post.createdAt,
      author: 'Elanko',
      tags: post.tags || [],
      category: post.category || 'Blog',
      locale: 'ta_IN'
    };

    res.json(metaData);
  } catch (error) {
    console.error('Error generating meta data:', error);
    res.status(500).json({ error: 'Failed to generate meta data' });
  }
});

// Generate Open Graph image URL for a post
router.get('/og-image/:postId', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const urls = getUrls();
    
    // For now, return the existing image or default
    // In the future, you could generate dynamic OG images here
    const imageUrl = post.coverImage || 
                    extractFirstImageFromContent(post.content) || 
                    urls.getAssetUrl('/src/assets/images/BlackAndBeigeFeminineHowToWebsiteBlogBanner.jpg');
    
    res.json({ imageUrl });
  } catch (error) {
    console.error('Error generating OG image:', error);
    res.status(500).json({ error: 'Failed to generate OG image' });
  }
});

// Generate sharing URLs for different platforms
router.get('/share-urls/:postId', async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const urls = getUrls();
    const postUrl = urls.getPostUrl(post.id);
    const title = encodeURIComponent(post.title);
    const description = encodeURIComponent(getFirstTwoLines(cleanHtmlTags(post.content)));
    
    const shareUrls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(postUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${title}&url=${encodeURIComponent(postUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`,
      whatsapp: `https://wa.me/?text=${title}%20${encodeURIComponent(postUrl)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(postUrl)}&text=${title}`,
      email: `mailto:?subject=${title}&body=${description}%0A%0A${encodeURIComponent(postUrl)}`,
      reddit: `https://reddit.com/submit?url=${encodeURIComponent(postUrl)}&title=${title}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(postUrl)}&description=${title}`,
      tumblr: `https://www.tumblr.com/share/link?url=${encodeURIComponent(postUrl)}&name=${title}&description=${description}`
    };

    res.json({ postUrl, shareUrls });
  } catch (error) {
    console.error('Error generating share URLs:', error);
    res.status(500).json({ error: 'Failed to generate share URLs' });
  }
});

export default router;
