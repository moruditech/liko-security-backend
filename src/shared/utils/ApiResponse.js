'use strict';

/**
 * Standard success envelope: { success: true, data, message }.
 * Every controller sends responses through this, never res.json({...}) ad hoc,
 * so the shape can never drift between modules.
 */
class ApiResponse {
  constructor(data = null, message = 'Success') {
    this.success = true;
    this.data = data;
    this.message = message;
  }

  send(res, statusCode = 200) {
    return res.status(statusCode).json(this);
  }
}

module.exports = ApiResponse;
