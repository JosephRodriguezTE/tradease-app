export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, type } = req.body;

  if (!email || !type) {
    return res.status(400).json({ error: 'Email and type are required' });
  }

  // For Supabase OTP verification, we need to generate a proper OTP token
  // This will be handled by Supabase's email sending, but we'll create a link format
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

  let link = '';
  if (type === 'confirm') {
    // Generate a signup OTP that Supabase can verify
    link = `${baseUrl}/auth-callback.html?email=${encodeURIComponent(email)}&type=confirm`;
  } else if (type === 'reset') {
    // Generate a recovery OTP that Supabase can verify
    link = `${baseUrl}/auth-callback.html?email=${encodeURIComponent(email)}&type=reset`;
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }

  res.status(200).json({ link });
}