const jwt = require('jsonwebtoken');

// Blocks the request unless a valid login cookie is present.
module.exports = function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Please log in first' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Session expired. Please log in again' });
  }
};
