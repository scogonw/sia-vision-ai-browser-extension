/**
 * Authentication middleware
 * Validates that requests are authorized
 */
export function authMiddleware(req, res, next) {
  try {
    // Check for authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'No authorization header provided'
      });
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        error: 'Invalid authorization header format'
      });
    }

    // For MVP, we'll accept any non-empty token
    // In production, you would:
    // 1. Validate Google OAuth token with Google's API
    // 2. Check user permissions in your database
    // 3. Verify organization membership

    // Mock validation
    if (token.length < 10) {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }

    // Attach user info to request (would come from token validation)
    req.user = {
      id: 'user_123',
      email: 'user@example.com',
      organizationId: 'org_456'
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Authentication failed'
    });
  }
}
