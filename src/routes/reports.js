const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { findForExport } = require('../models/sales');
const { salesToCsv } = require('../csv');

const router = express.Router();

router.get('/sales', requireAuth, async (req, res, next) => {
  try {
    const rows = await findForExport(req.user);
    res.type('text/csv');
    res.set('Content-Disposition', 'attachment; filename="sales_report.csv"');
    return res.send(salesToCsv(rows));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
