const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { generateToken } = require('../middleware/auth');

// POST /api/auth/register - Register with phone and password
router.post('/register', async (req, res) => {
  try {
    const { phone_number, password, display_name } = req.body;

    if (!phone_number || !password || !display_name) {
      return res.status(400).json({ error: 'Missing required fields (phone_number, password, display_name)' });
    }

    // Check if user exists
    const existingUser = await query('SELECT id FROM users WHERE phone_number = $1', [phone_number]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Insert user
    const newUser = await query(
      `INSERT INTO users (phone_number, password_hash, display_name, created_at, last_login) 
       VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id, phone_number, display_name, avatar_url, notification_enabled, language, theme`,
      [phone_number, password_hash, display_name]
    );

    const user = newUser.rows[0];
    const token = generateToken(user);

    res.status(201).json({ user, token, message: 'Registration successful' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login - Login with phone and password
router.post('/login', async (req, res) => {
  try {
    const { phone_number, password } = req.body;

    if (!phone_number || !password) {
      return res.status(400).json({ error: 'Missing phone_number or password' });
    }

    const result = await query('SELECT * FROM users WHERE phone_number = $1', [phone_number]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    // Update last login
    const updatedUserRes = await query(
      'UPDATE users SET last_login = NOW() WHERE id = $1 RETURNING id, phone_number, display_name, avatar_url, notification_enabled, language, theme',
      [user.id]
    );

    const updatedUser = updatedUserRes.rows[0];
    const token = generateToken(updatedUser);

    res.json({ user: updatedUser, token, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/user/:id - Get user by ID
router.get('/user/:id', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, phone_number, display_name, avatar_url, notification_enabled, language, theme, created_at FROM users WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
