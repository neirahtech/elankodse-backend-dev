import express from 'express';
import { body } from 'express-validator';
import { register, login, forgotPassword, resetPassword } from '../controllers/authController.js';

const router = express.Router();

// Register route
router.post('/register', [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], register);

// Login route
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], login);

// Forgot password route
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email is required')
], forgotPassword);

// Reset password route
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], resetPassword);

export default router; 