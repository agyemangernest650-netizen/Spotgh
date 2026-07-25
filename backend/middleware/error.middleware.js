// backend/middleware/error.middleware.js
const env = require('../config/env');

const notFound = (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
  }
  res.status(404).sendFile('404.html', { root: 'frontend/pages' });
};

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.status || 500} — ${err.message}`);
  if (env.IS_DEV) console.error(err.stack);

  const status = err.status || 500;

  if (req.path.startsWith('/api/')) {
    return res.status(status).json({
      error: env.IS_PROD ? 'An unexpected error occurred' : err.message,
      ...(env.IS_DEV && { stack: err.stack }),
    });
  }

  res.status(status).sendFile('error.html', { root: 'frontend/pages' });
};

module.exports = { notFound, errorHandler };
