const express = require('express');
const AuthService = require('./auth');

function createAuthRoutes(db) {
  const router = express.Router();
  const auth = new AuthService(db);

  // Login
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          error: 'Username and password are required'
        });
      }

      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      const result = await auth.login(username, password, ipAddress, userAgent);

      res.json(result);
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({ error: error.message });
    }
  });

  // Refresh token
  router.post('/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      const result = await auth.refreshAccessToken(refreshToken, ipAddress, userAgent);

      res.json(result);
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({ error: error.message });
    }
  });

  // Logout
  router.post('/logout', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const result = await auth.logout(refreshToken);

      res.json(result);
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get current user info
  router.get('/me', auth.authenticate(), async (req, res) => {
    try {
      const result = await db.pool.query(
        'SELECT id, username, email, first_name, last_name, role, created_at, last_login FROM users WHERE id = $1',
        [req.user.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.auth = auth;

  return router;
}

module.exports = createAuthRoutes;
