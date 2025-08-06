import jwt from 'jsonwebtoken';

// Optional authentication middleware - doesn't require token but decodes if present
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // Token is invalid, but continue without user info
      console.log('Invalid token in optional auth:', err.message);
      req.user = null;
    }
  } else {
    // No token provided, continue without user info
    req.user = null;
  }
  
  next();
};

export default optionalAuth;
