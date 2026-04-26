import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase admin client for generating secure email links
const sbAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, type, name } = req.body;

  if (!email || !type) {
    return res.status(400).json({ error: 'Email and type are required' });
  }

  let subject = '';
  let html = '';
  let link = '';

  try {
    // Generate secure email link using Supabase admin API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tradease.tech';
    
    if (type === 'confirm') {
      const { data, error } = await sbAdmin.auth.admin.generateLink({
        type: 'signup',
        email,
        options: {
          redirectTo: `${baseUrl}/auth-callback.html`
        }
      });
      
      if (error || !data) {
        return res.status(500).json({ error: 'Failed to generate confirmation link' });
      }
      
      link = data.properties.action_link;
      subject = 'Welcome to Tradease - Confirm Your Account';
      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Confirm Your Tradease Account</title>
        </head>
        <body style="font-family: 'Barlow', Arial, sans-serif; margin: 0; padding: 0; background-color: #0F0F0F; color: #FFFFFF;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #FF6B2B; font-family: 'Barlow Condensed', sans-serif; font-size: 32px; margin: 0;">
                Tradease
              </h1>
              <p style="color: #A8A8A8; margin: 10px 0 0 0;">New York's Fastest Contractor Marketplace</p>
            </div>

            <div style="background: #161616; border: 1px solid #2E2E2E; border-radius: 12px; padding: 40px; text-align: center;">
              <h2 style="color: #FFFFFF; font-family: 'Barlow Condensed', sans-serif; font-size: 24px; margin: 0 0 20px 0;">
                Welcome${name ? `, ${name}` : ''}!
              </h2>

              <p style="color: #A8A8A8; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                Thanks for joining Tradease. To get started, please confirm your email address by clicking the button below.
              </p>

              <a href="${link}" style="display: inline-block; background: #FF6B2B; color: #FFFFFF; text-decoration: none; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 16px; padding: 15px 30px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                Confirm My Account →
              </a>

              <p style="color: #606060; font-size: 14px; margin: 30px 0 0 0;">
                This link will expire in 24 hours for security reasons.
              </p>

              <p style="color: #606060; font-size: 14px; margin: 10px 0 0 0;">
                If you didn't create an account, you can safely ignore this email.
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #2E2E2E;">
              <p style="color: #606060; font-size: 12px; margin: 0;">
                © 2025 Tradease, Inc. · New York, NY
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (type === 'reset') {
      const { data, error } = await sbAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${baseUrl}/auth-callback.html`
        }
      });
      
      if (error || !data) {
        return res.status(500).json({ error: 'Failed to generate password reset link' });
      }
      
      link = data.properties.action_link;
      subject = 'Reset Your Tradease Password';
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: 'Barlow', Arial, sans-serif; margin: 0; padding: 0; background-color: #0F0F0F; color: #FFFFFF;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #FF6B2B; font-family: 'Barlow Condensed', sans-serif; font-size: 32px; margin: 0;">
                Tradease
              </h1>
            </div>

            <div style="background: #161616; border: 1px solid #2E2E2E; border-radius: 12px; padding: 40px; text-align: center;">
              <h2 style="color: #FFFFFF; font-family: 'Barlow Condensed', sans-serif; font-size: 24px; margin: 0 0 20px 0;">
                Reset Your Password
              </h2>

              <p style="color: #A8A8A8; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                We received a request to reset your password. Click the button below to create a new password.
              </p>

              <a href="${link}" style="display: inline-block; background: #FF6B2B; color: #FFFFFF; text-decoration: none; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 16px; padding: 15px 30px; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                Reset Password →
              </a>

              <p style="color: #606060; font-size: 14px; margin: 30px 0 0 0;">
                This link will expire in 1 hour for security reasons.
              </p>

              <p style="color: #606060; font-size: 14px; margin: 10px 0 0 0;">
                If you didn't request a password reset, you can safely ignore this email.
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #2E2E2E;">
              <p style="color: #606060; font-size: 12px; margin: 0;">
                © 2025 Tradease, Inc. · New York, NY
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      return res.status(400).json({ error: 'Invalid email type' });
    }

    const result = await resend.emails.send({
      from: 'Tradease <noreply@tradease.tech>',
      to: email,
      subject,
      html
    });

    res.status(200).json({ success: true, id: result.data?.id });
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ error: err.message || 'Failed to send email' });
  }
}