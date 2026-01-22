const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

class AuthService {
  constructor(database) {
    this.db = database;

    if (!process.env.JWT_SECRET) {
      console.warn('No JWT_SECRET in environment, using random secret');
    }
  }

  generateTokens(userId, username, role) {
    const payload = { userId, username, role };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN
    });

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    return { accessToken, refreshToken };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  async hashPassword(password) {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  async login(username, password, ipAddress = null, userAgent = null) {
    try {
      const userResult = await this.db.pool.query(
        `SELECT id, username, email, password_hash, role, is_active
         FROM users
         WHERE username = $1 OR email = $1`,
        [username]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Invalid username or password');
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        throw new Error('Account is disabled');
      }

      const validPassword = await this.verifyPassword(password, user.password_hash);
      if (!validPassword) {
        throw new Error('Invalid username or password');
      }

      await this.db.pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      const tokens = this.generateTokens(user.id, user.username, user.role);

      await this.createSession(user.id, tokens.refreshToken, ipAddress, userAgent);

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        ...tokens
      };
    } catch (error) {
      throw error;
    }
  }

  async createSession(userId, refreshToken, ipAddress, userAgent) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.db.pool.query(
      `INSERT INTO user_sessions (user_id, refresh_token, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, refreshToken, ipAddress, userAgent, expiresAt]
    );
  }

  async refreshAccessToken(refreshToken, ipAddress = null, userAgent = null) {
    try {
      const decoded = this.verifyToken(refreshToken);
      if (!decoded || decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      const sessionResult = await this.db.pool.query(
        `SELECT s.*, u.username, u.role, u.is_active
         FROM user_sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.refresh_token = $1
         AND s.is_active = true
         AND s.expires_at > NOW()`,
        [refreshToken]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Session not found or expired');
      }

      const session = sessionResult.rows[0];

      if (!session.is_active) {
        throw new Error('Account is disabled');
      }

      const accessToken = jwt.sign(
        {
          userId: session.user_id,
          username: session.username,
          role: session.role
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      await this.db.pool.query(
        'UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = $1',
        [session.id]
      );

      return {
        success: true,
        accessToken,
        user: {
          id: session.user_id,
          username: session.username,
          role: session.role
        }
      };
    } catch (error) {
      throw error;
    }
  }

  async logout(refreshToken) {
    try {
      await this.db.pool.query(
        'UPDATE user_sessions SET is_active = false WHERE refresh_token = $1',
        [refreshToken]
      );

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  authenticate() {
    return async (req, res, next) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = this.verifyToken(token);
        if (!decoded) {
          return res.status(401).json({ error: 'Invalid token' });
        }

        req.user = decoded;
        next();
      } catch (error) {
        res.status(401).json({ error: 'Authentication failed' });
      }
    };
  }
}

module.exports = AuthService;
