import { Sequelize } from 'sequelize';
import config from './environment.js';

const sequelize = new Sequelize(
  config.mysqlDatabase,
  config.mysqlUser,
  config.mysqlPassword,
  {
    host: config.mysqlHost,
    port: config.mysqlPort,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 5,         // Reduced from 50 to prevent hitting connection limits
      min: 0,         // Reduced from 5 to save connections
      acquire: 60000, // Maximum time (ms) to wait for a connection
      idle: 10000,    // Reduced from 30000 to close idle connections faster
      handleDisconnects: true,
      evict: 5000     // Reduced from 10000 to evict stale connections more frequently
    },
    dialectOptions: {
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      charset: 'utf8mb4',
      multipleStatements: false,
      supportBigNumbers: true,
      bigNumberStrings: true
    },
    retry: {
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /ESOCKETTIMEDOUT/,
        /EHOSTUNREACH/,
        /EPIPE/,
        /EAI_AGAIN/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ],
      max: 3
    }
  }
);

const connectDB = async (retryCount = 0) => {
  try {
    await sequelize.authenticate();
    console.log('MySQL connected');
  } catch (error) {
    console.error('MySQL connection error:', error);
    
    // If it's a connection limit error, wait and retry
    if (error.original?.code === 'ER_USER_LIMIT_REACHED' && retryCount < 3) {
      const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
      console.log(`Connection limit reached. Retrying in ${waitTime/1000} seconds... (attempt ${retryCount + 1}/3)`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return connectDB(retryCount + 1);
    }
    
    process.exit(1);
  }
};

export { sequelize };
export default connectDB; 