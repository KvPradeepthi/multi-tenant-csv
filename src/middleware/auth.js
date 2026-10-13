const jwt = require('jsonwebtoken');
const config = require('../config');

function requireAuth(req, res, next) {
  const header = req.get('authorization');
  if (!header || !/^Bearer\s+\S+$/i.test(header)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = header.replace(/^Bearer\s+/i, '');
  try {
    const claims = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    if (!claims.userId || !claims.tenantId || !['admin', 'agent'].includes(claims.role)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = {
      userId: Number(claims.userId),
      tenantId: Number(claims.tenantId),
      role: claims.role
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { requireAuth };
