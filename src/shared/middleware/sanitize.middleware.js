'use strict';

const mongoSanitize = require('express-mongo-sanitize');

/**
 * Strips '$' and '.' operators from req.body/query/params to prevent NoSQL
 * injection (e.g. { "email": { "$gt": "" } } bypassing auth checks).
 * Mounted globally in app.js, early in the chain (TAD §5, row 5).
 */
module.exports = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ key }) => {
    // eslint-disable-next-line no-console
    console.warn(`[sanitize] Stripped potentially malicious key: ${key}`);
  },
});
