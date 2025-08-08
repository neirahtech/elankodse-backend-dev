// Blogger API Configuration
export const BLOGGER_CONFIG = {
  // Your API Key
  API_KEY: 'AIzaSyD44Q_YctTPOndoPWrXZsBDJ1jNcOs4B1w',
  
  // You need to set your Blog ID
  BLOG_ID: process.env.BLOGGER_BLOG_ID || '9143217',
  
  // API Base URL
  API_BASE_URL: 'https://www.googleapis.com/blogger/v3',
  
  // OAuth 2.0 Configuration (optional)
  ACCESS_TOKEN: process.env.BLOGGER_ACCESS_TOKEN,
  CLIENT_ID: process.env.BLOGGER_CLIENT_ID,
  CLIENT_SECRET: process.env.BLOGGER_CLIENT_SECRET,
  REDIRECT_URI: process.env.BLOGGER_REDIRECT_URI || 'http://localhost:8084/auth/blogger/callback',
  
  // API Limits
  MAX_RESULTS: 50,
  TIMEOUT: 30000,
  RETRY_DELAY: 2000,
  MAX_RETRIES: 3
};

// Helper function to get API headers
export function getBloggerApiHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; BloggerMigration/1.0)'
  };
  
  // Add OAuth token if available
  if (BLOGGER_CONFIG.ACCESS_TOKEN) {
    headers['Authorization'] = `Bearer ${BLOGGER_CONFIG.ACCESS_TOKEN}`;
  }
  
  return headers;
}

// Helper function to validate configuration
export function validateBloggerConfig() {
  const errors = [];
  
  if (!BLOGGER_CONFIG.API_KEY || BLOGGER_CONFIG.API_KEY === 'YOUR_API_KEY') {
    errors.push('BLOGGER_API_KEY is not set');
  }
  
  if (!BLOGGER_CONFIG.BLOG_ID || BLOGGER_CONFIG.BLOG_ID === 'YOUR_BLOG_ID') {
    errors.push('BLOGGER_BLOG_ID is not set');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export default BLOGGER_CONFIG; 