'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const env = require('./src/config/env');
const sanitizeMiddleware = require('./src/shared/middleware/sanitize.middleware');
const { globalLimiter } = require('./src/shared/middleware/rateLimiter.middleware');
const errorMiddleware = require('./src/shared/middleware/error.middleware');
const apiRoutes = require('./src/routes/index');
const ApiError = require('./src/shared/utils/ApiError');

const app = express();

// Middleware order fixed per TAD §5 — do not reorder without re-reading that section.
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true, // required for the httpOnly refresh-token cookie (Frontend TAD §5/§14) to be sent/received cross-origin
  })
);
app.use(globalLimiter);
app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
app.use(cookieParser()); // populates req.cookies — needed for refresh-token cookie fallback in auth.controller.js
app.use(sanitizeMiddleware);
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

app.use(`/api/${env.API_VERSION}`, apiRoutes);

// Unmatched routes -> 404 through the same error envelope, not Express's default HTML page
app.use((req, res, next) => {
  next(ApiError.notFound(`Route ${req.originalUrl} not found`));
});

app.use(errorMiddleware);

module.exports = app;
