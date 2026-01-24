const express = require("express");
const bcrypt = require("bcrypt");
const AuthService = require("./auth");

function createAuthRoutes(db) {
  const router = express.Router();
  const auth = new AuthService(db);

  // Register with invite code
  router.post("/register", async (req, res) => {
    try {
      const { username, email, password, firstName, lastName, inviteCode } = req.body;

      if (!username || !email || !password || !inviteCode) {
        return res.status(400).json({
          error: "Username, email, password, and invite code are required"
        });
      }

      // Validate invite code
      const codeResult = await db.pool.query(
        `SELECT * FROM invite_codes 
         WHERE code = $1 
         AND is_active = true 
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR uses_count < max_uses)`,
        [inviteCode]
      );

      if (codeResult.rows.length === 0) {
        return res.status(400).json({ error: "Invalid or expired invite code" });
      }

      const invite = codeResult.rows[0];

      // Check if email matches (if invite has specific email)
      if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({ error: "This invite code is for a different email" });
      }

      // Check if username or email already exists
      const existingUser = await db.pool.query(
        "SELECT id FROM users WHERE username = $1 OR email = $2",
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: "Username or email already exists" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const userResult = await db.pool.query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id, username, email, first_name, last_name, role`,
        [username, email, passwordHash, firstName || null, lastName || null, "user"]
      );

      const newUser = userResult.rows[0];

      // Update invite code usage
      await db.pool.query(
        `UPDATE invite_codes 
         SET uses_count = uses_count + 1, used_by = $1, used_at = NOW()
         WHERE id = $2`,
        [newUser.id, invite.id]
      );

      res.status(201).json({
        success: true,
        message: "Registration successful",
        user: newUser
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Login
  router.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          error: "Username and password are required"
        });
      }

      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      const result = await auth.login(username, password, ipAddress, userAgent);

      res.json(result);
    } catch (error) {
      console.error("Login error:", error);
      res.status(401).json({ error: error.message });
    }
  });

  // Refresh token
  router.post("/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
      }

      const ipAddress = req.ip;
      const userAgent = req.headers["user-agent"];

      const result = await auth.refreshAccessToken(refreshToken, ipAddress, userAgent);

      res.json(result);
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(401).json({ error: error.message });
    }
  });

  // Logout
  router.post("/logout", async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
      }

      const result = await auth.logout(refreshToken);

      res.json(result);
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get current user info
  router.get("/me", auth.authenticate(), async (req, res) => {
    try {
      const result = await db.pool.query(
        "SELECT id, username, email, first_name, last_name, role, created_at, last_login FROM users WHERE id = $1",
        [req.user.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  router.auth = auth;

  return router;
}

module.exports = createAuthRoutes;
