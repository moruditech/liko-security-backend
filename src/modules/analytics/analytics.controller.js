'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const { getDashboard, getCapacityAlerts } = require('./analytics.service');

const VALID_PERIODS = ['daily', 'weekly', 'monthly'];

const dashboard = asyncHandler(async (req, res) => {
  const period = VALID_PERIODS.includes(req.query.period) ? req.query.period : 'monthly';
  const data = await getDashboard(period);
  new ApiResponse(data, 'Analytics retrieved').send(res, 200);
});

const capacityAlerts = asyncHandler(async (req, res) => {
  const data = await getCapacityAlerts();
  new ApiResponse(data, 'Capacity alerts retrieved').send(res, 200);
});

module.exports = { dashboard, capacityAlerts };
