import { getCorsOrigins } from './constants.js';

// Centralized CORS configuration
export const createCorsOptions = () => {
  const allowedOrigins = getCorsOrigins();
  
  return {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      console.log('🌐 CORS check for origin:', origin);
      console.log('🔐 Allowed origins:', allowedOrigins);
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        console.log('✅ Origin allowed:', origin);
        callback(null, true);
      } else {
        // In production, be more permissive for elankodse.com domains
        const isElankodseOrigin = origin && (
          origin.includes('elankodse.com') || 
          origin.includes('elankodse-') ||
          origin.includes('localhost') ||
          origin.includes('127.0.0.1')
        );
        
        if (process.env.NODE_ENV === 'production' && isElankodseOrigin) {
          console.log('✅ Production: Allowing elankodse domain:', origin);
          callback(null, true);
        } else {
          console.log('❌ Origin rejected:', origin);
          console.log('📋 Available origins:', allowedOrigins.join(', '));
          callback(new Error(`Not allowed by CORS: ${origin}`));
        }
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With', 
      'Accept', 
      'Origin', 
      'x-dashboard-access',
      'Cache-Control',
      'Pragma'
    ],
    exposedHeaders: ['X-Response-Time', 'X-Total-Count'],
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
