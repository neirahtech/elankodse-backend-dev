import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const addResetPasswordColumns = async () => {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT
  });

  try {
    // Check if columns exist first
    const [existingColumns] = await connection.execute(
      `SHOW COLUMNS FROM Users LIKE 'resetPasswordToken'`
    );

    if (existingColumns.length === 0) {
      // Add the resetPasswordToken column
      await connection.execute(
        `ALTER TABLE Users ADD COLUMN resetPasswordToken VARCHAR(255) NULL AFTER isAuthor`
      );
      console.log('Added resetPasswordToken column');

      // Add the resetPasswordExpires column
      await connection.execute(
        `ALTER TABLE Users ADD COLUMN resetPasswordExpires DATETIME NULL AFTER resetPasswordToken`
      );
      console.log('Added resetPasswordExpires column');
    } else {
      console.log('Reset password columns already exist');
    }

  } catch (error) {
    console.error('Error adding columns:', error);
  } finally {
    await connection.end();
  }
};

addResetPasswordColumns();
