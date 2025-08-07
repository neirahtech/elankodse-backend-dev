import { getCorsOrigins } from './constants.js';

// Centralized CORS configuration
export const createCorsOptions = () => {
  const allowedOrigins = getCorsOrigins();
  
  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // In production, be more permissive for elankodse.com subdomains
        if (process.env.NODE_ENV === 'production' && origin && origin.includes('elankodse.com')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-dashboard-access'],
    optionsSuccessStatus: 200,
    preflightContinue: false,
    maxAge: 86400 // 24 hours
  };
};

// Get allowed origins for logging/debugging
export const getAllowedOrigins = () => {
  return getCorsOrigins();
};

export default {
  createCorsOptions,
  getAllowedOrigins
};
