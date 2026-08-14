'use strict';

const asyncHandler = require('../../shared/utils/asyncHandler');
const ApiResponse = require('../../shared/utils/ApiResponse');
const invoiceService = require('./invoice.service');

const listForApplication = asyncHandler(async (req, res) => {
  const invoices = await invoiceService.listInvoicesForApplication(req.params.applicationId);
  new ApiResponse(invoices, 'Invoices retrieved').send(res, 200);
});

const resend = asyncHandler(async (req, res) => {
  await invoiceService.resendInvoice(req.params.id, req.user.id);
  res.status(202).json({ success: true, data: null, message: 'Invoice re-sent' });
});

module.exports = { listForApplication, resend };
