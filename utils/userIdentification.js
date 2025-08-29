/**
 * Shared utility for consistent user identification across the application
 * This ensures that like functionality works correctly by using the same
 * user identifier format for both storing likes and checking liked status
 */

/**
 * Generate a consistent user identifier for both authenticated and anonymous users
 * @param {Object} req - Express request object
 * @returns {string} - Consistent user identifier
 */
export const getUserIdentifier = (req) => {
  if (req.user) {
    // For authenticated users, use their user ID
    return req.user.id.toString();
  } else {
    // For anonymous users, create a consistent identifier
    // Priority order for IP detection (production-ready)
    let clientIP = 'unknown';
    
    // First try Cloudflare headers (most common in production)
    if (req.headers['cf-connecting-ip']) {
      clientIP = req.headers['cf-connecting-ip'];
    }
    // Then try standard forwarded headers
    else if (req.headers['x-forwarded-for']) {
      clientIP = req.headers['x-forwarded-for'].split(',')[0].trim();
    }
    else if (req.headers['x-real-ip']) {
      clientIP = req.headers['x-real-ip'];
    }
    // Fallback to Express req.ip (which should handle most proxy configurations)
    else if (req.ip) {
      clientIP = req.ip;
    }
    // Last resort: direct connection info
    else {
      clientIP = req.connection?.remoteAddress || 
                req.socket?.remoteAddress ||
                (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
                'unknown';
    }
    
    // Clean up IPv6-mapped IPv4 addresses and normalize
    clientIP = clientIP.replace(/^::ffff:/, '').substring(0, 45);
    
    const userAgent = req.get('User-Agent')?.slice(0, 100) || 'unknown';
    const acceptLanguage = req.get('Accept-Language')?.slice(0, 20) || '';
    
    // Create a more stable identifier for anonymous users
    // Use a consistent hash to avoid base64 variations
    const fingerprint = `${userAgent}|${acceptLanguage}`.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const hash = Buffer.from(fingerprint).toString('base64').slice(0, 16);
    
    // Format: anon_[IP]_[hash]
    return `anon_${clientIP}_${hash}`;
  }
};

/**
 * Check if a user has liked a post based on the likedBy array
 * @param {Array} likedByArray - Array of user IDs who have liked the post
 * @param {Object} req - Express request object
 * @returns {boolean} - True if the user has liked the post
 */
export const hasUserLiked = (likedByArray, req) => {
  if (!Array.isArray(likedByArray) || likedByArray.length === 0) {
    return false;
  }
  
  const userId = getUserIdentifier(req);
  return likedByArray.some(id => id.toString() === userId.toString());
};

/**
 * Get debug information about user identification
 * @param {Object} req - Express request object
 * @returns {Object} - Debug information
 */
export const getUserIdentificationDebug = (req) => {
  const isAuthenticated = !!req.user;
  const userId = getUserIdentifier(req);
  
  if (isAuthenticated) {
    return {
      isAuthenticated: true,
      userId: userId,
      userType: 'authenticated'
    };
  } else {
    // Detailed IP detection for debugging
    const ipSources = {
      cfConnectingIp: req.headers['cf-connecting-ip'],
      xForwardedFor: req.headers['x-forwarded-for'],
      xRealIp: req.headers['x-real-ip'],
      reqIp: req.ip,
      connectionRemoteAddress: req.connection?.remoteAddress,
      socketRemoteAddress: req.socket?.remoteAddress
    };
    
    const userAgent = req.get('User-Agent')?.slice(0, 50) || 'unknown';
    const acceptLanguage = req.get('Accept-Language')?.slice(0, 20) || '';
    
    return {
      isAuthenticated: false,
      userId: userId,
      userType: 'anonymous',
      ipSources,
      userAgent: userAgent,
      acceptLanguage: acceptLanguage,
      fingerprint: `${userAgent}|${acceptLanguage}`.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 30)
    };
  }
};
