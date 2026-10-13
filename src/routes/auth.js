const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findByEmail } = require('../models/users');
const config = require('../config');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = await findByEmail(email);
    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      config.jwtSecret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    return res.json({ token });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
