import nodemailer from 'nodemailer';
import { getUrls } from '../config/constants.js';

// Create transporter
const createTransporter = () => nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'mail.elankodse.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // Use TLS
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false // For self-signed certificates
  }
});

export const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const urls = getUrls();
    
    // In development or if SMTP is not properly configured, just log the reset token
    if (process.env.NODE_ENV === 'development' || !process.env.SMTP_USER || process.env.SMTP_HOST === 'mail.elankodse.com') {
      console.log('=== PASSWORD RESET EMAIL (Development/Local Mode) ===');
      console.log('To:', email);
      console.log('Reset Token:', resetToken);
      console.log('Reset URL:', `${urls.frontend}/reset-password?token=${resetToken}`);
      console.log('======================================================');
      return { success: true, messageId: 'dev-mode' };
    }

    const transporter = createTransporter();
    
    const resetUrl = `${urls.frontend}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'dev@elankodse.com',
      to: email,
      subject: 'Password Reset - Elanko DSE',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You have requested to reset your password for your Elanko DSE account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This link will expire in 1 hour. If you didn't request this password reset, 
            please ignore this email.
          </p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

export const sendPasswordChangeConfirmation = async (email) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'dev@elankodse.com',
      to: email,
      subject: 'Password Changed Successfully - Elanko DSE',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Changed Successfully</h2>
          <p>Your password for your Elanko DSE account has been successfully changed.</p>
          <p>If you didn't make this change, please contact us immediately.</p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Password change confirmation email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending password change confirmation email:', error);
    return { success: false, error: error.message };
  }
};
