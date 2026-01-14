/**
 * API Key Authentication Middleware
 * Validates the x-api-key header against the configured API_KEY
 */

const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;

  // Check if API key is configured
  if (!validApiKey) {
    console.error('API_KEY environment variable not set!');
    return res.status(500).json({ 
      error: 'Server configuration error',
      message: 'API key not configured on server'
    });
  }

  // Check if API key is provided
  if (!apiKey) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'API key required. Include x-api-key header.'
    });
  }

  // Validate API key
  if (apiKey !== validApiKey) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  // API key is valid, proceed
  next();
};

module.exports = apiKeyAuth;
