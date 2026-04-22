export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, type } = req.body;

  if (!email || !type) {
    return res.status(400).json({ error: 'Email and type are required' });
  }

  // Generate a secure token (in production, use a proper JWT or similar)
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

  // Store token temporarily (in production, use Redis or database)
  // For now, we'll just return a mock link
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

  let link = '';
  if (type === 'confirm') {
    link = `${baseUrl}/auth-callback.html?token=${token}&type=confirm&email=${encodeURIComponent(email)}`;
  } else if (type === 'reset') {
    link = `${baseUrl}/auth-callback.html?token=${token}&type=reset&email=${encodeURIComponent(email)}`;
  } else {
    return res.status(400).json({ error: 'Invalid type' });
  }

  res.status(200).json({ link, token });
}