'use strict';

const Application = require('../applications/application.model');
const Invoice = require('../invoices/invoice.model');
const Inquiry = require('../inquiries/inquiry.model');
const AuditLog = require('../auditLogs/auditLog.model');
const User = require('../users/user.model');
const Course = require('../courses/course.model');
const Intake = require('../courses/intake.model');
const { APPLICATION_STATUS, COURSE_GRADE, INVOICE_TYPE } = require('../../shared/constants/enums');

// ─── Period helpers ──────────────────────────────────────────────────────────

function getPeriodConfig(period) {
  const now = new Date();
  switch (period) {
    case 'daily':
      return {
        startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        dateFormat: '%Y-%m-%d',
      };
    case 'weekly':
      return {
        startDate: new Date(now.getTime() - 26 * 7 * 24 * 60 * 60 * 1000),
        dateFormat: '%G-W%V', // ISO year + ISO week number
      };
    case 'monthly':
    default:
      return {
        startDate: new Date(now.getFullYear() - 2, now.getMonth(), 1),
        dateFormat: '%Y-%m',
      };
  }
}

// ─── Line graphs ─────────────────────────────────────────────────────────────

async function getApplicationsOverTime(period) {
  const { startDate, dateFormat } = getPeriodConfig(period);
  return Application.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', count: 1 } },
  ]);
}

async function getRevenueOverTime(period) {
  const { startDate, dateFormat } = getPeriodConfig(period);
  const rows = await Invoice.aggregate([
    { $match: { issuedAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: dateFormat, date: '$issuedAt' } },
          type: '$type',
        },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.date': 1 } },
  ]);

  // Pivot into { date, proforma, official }
  const map = {};
  for (const { _id, total } of rows) {
    if (!map[_id.date]) map[_id.date] = { date: _id.date, proforma: 0, official: 0 };
    map[_id.date][_id.type] = total;
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

async function getEnrollmentsOverTime(period) {
  const { startDate, dateFormat } = getPeriodConfig(period);
  return Application.aggregate([
    { $unwind: '$statusHistory' },
    {
      $match: {
        'statusHistory.status': APPLICATION_STATUS.ENROLLED,
        'statusHistory.date': { $gte: startDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$statusHistory.date' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', count: 1 } },
  ]);
}

async function getInquiryResponseTimeTrend(period) {
  const { startDate, dateFormat } = getPeriodConfig(period);
  return Inquiry.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        'replies.0': { $exists: true },
      },
    },
    {
      $addFields: {
        responseMs: {
          $subtract: [{ $arrayElemAt: ['$replies.date', 0] }, '$createdAt'],
        },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
        avgHours: { $avg: { $divide: ['$responseMs', 3600000] } },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        date: '$_id',
        avgHours: { $round: ['$avgHours', 1] },
      },
    },
  ]);
}

async function getFailedLoginsOverTime(period) {
  const { startDate, dateFormat } = getPeriodConfig(period);
  return AuditLog.aggregate([
    {
      $match: {
        action: 'auth.login_failed',
        timestamp: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: '$timestamp' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', count: 1 } },
  ]);
}

// ─── Pie / donut charts ───────────────────────────────────────────────────────

async function getApplicationsByStatus() {
  return Application.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { _id: 0, status: '$_id', count: 1 } },
  ]);
}

async function getApplicationsByGrade() {
  // Unwind courses, group unique (application, grade) pairs, then count per grade
  return Application.aggregate([
    {
      $lookup: {
        from: 'courses',
        localField: 'coursesSelected',
        foreignField: '_id',
        as: 'courses',
      },
    },
    { $unwind: { path: '$courses', preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: { appId: '$_id', grade: '$courses.grade' },
      },
    },
    { $group: { _id: '$_id.grade', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, grade: '$_id', count: 1 } },
  ]);
}

async function getApplicationsByProvince() {
  return Application.aggregate([
    { $match: { 'address.province': { $nin: [null, ''] } } },
    { $group: { _id: '$address.province', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { _id: 0, province: '$_id', count: 1 } },
  ]);
}

async function getInquiriesByStatus() {
  return Inquiry.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { _id: 0, status: '$_id', count: 1 } },
  ]);
}

async function getAuditByCategory() {
  const CATEGORY_MAP = {
    application: 'Applications',
    invoice: 'Invoices',
    auth: 'Auth',
    user: 'Users',
    role: 'Roles',
    course: 'Courses',
    intake: 'Courses',
    gallery: 'Gallery',
    testimonial: 'Content',
    faq: 'Content',
    announcement: 'Content',
    settings: 'Settings',
    inquiry: 'Inquiries',
  };

  const rows = await AuditLog.aggregate([
    {
      $addFields: {
        module: { $arrayElemAt: [{ $split: ['$action', '.'] }, 0] },
      },
    },
    { $group: { _id: '$module', count: { $sum: 1 } } },
  ]);

  const totals = {};
  for (const { _id, count } of rows) {
    const category = CATEGORY_MAP[_id] || 'Other';
    totals[category] = (totals[category] || 0) + count;
  }

  return Object.entries(totals)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── Scalar metrics ───────────────────────────────────────────────────────────

async function getConversionRate() {
  const [result] = await Application.aggregate([
    {
      $group: {
        _id: null,
        enrolled: { $sum: { $cond: [{ $eq: ['$status', APPLICATION_STATUS.ENROLLED] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$status', APPLICATION_STATUS.REJECTED] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ]);
  if (!result) return { enrolled: 0, rejected: 0, total: 0, rate: null };
  const terminal = result.enrolled + result.rejected;
  return {
    enrolled: result.enrolled,
    rejected: result.rejected,
    total: result.total,
    rate: terminal > 0 ? Math.round((result.enrolled / terminal) * 1000) / 10 : null,
  };
}

async function getAvgTimeToEnrollment() {
  const [result] = await Application.aggregate([
    { $match: { status: APPLICATION_STATUS.ENROLLED } },
    {
      $addFields: {
        enrolledAt: {
          $reduce: {
            input: '$statusHistory',
            initialValue: null,
            in: {
              $cond: [
                { $eq: ['$$this.status', APPLICATION_STATUS.ENROLLED] },
                '$$this.date',
                '$$value',
              ],
            },
          },
        },
      },
    },
    { $match: { enrolledAt: { $ne: null } } },
    {
      $group: {
        _id: null,
        avgDays: {
          $avg: { $divide: [{ $subtract: ['$enrolledAt', '$createdAt'] }, 86400000] },
        },
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0, avgDays: { $round: ['$avgDays', 1] }, count: 1 } },
  ]);
  return result || { avgDays: null, count: 0 };
}

async function getAvgInquiryResponseTime() {
  const [result] = await Inquiry.aggregate([
    { $match: { 'replies.0': { $exists: true } } },
    {
      $addFields: {
        responseMs: {
          $subtract: [{ $arrayElemAt: ['$replies.date', 0] }, '$createdAt'],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgHours: { $avg: { $divide: ['$responseMs', 3600000] } },
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0, avgHours: { $round: ['$avgHours', 1] }, count: 1 } },
  ]);
  return result || { avgHours: null, count: 0 };
}

async function getMonthlyRevenue() {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [thisResult, lastResult] = await Promise.all([
    Invoice.aggregate([
      { $match: { issuedAt: { $gte: thisMonthStart, $lt: nextMonthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Invoice.aggregate([
      { $match: { issuedAt: { $gte: lastMonthStart, $lt: thisMonthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const thisMonth = thisResult[0]?.total ?? 0;
  const lastMonth = lastResult[0]?.total ?? 0;

  return {
    thisMonth,
    lastMonth,
    change: lastMonth > 0
      ? Math.round(((thisMonth - lastMonth) / lastMonth) * 1000) / 10
      : null,
  };
}

async function getMfaAdoption() {
  const rows = await User.aggregate([
    { $group: { _id: '$mfaEnabled', count: { $sum: 1 } } },
  ]);
  const enabled = rows.find((r) => r._id === true)?.count ?? 0;
  const disabled = rows.find((r) => r._id === false)?.count ?? 0;
  const total = enabled + disabled;
  return {
    enabled,
    disabled,
    total,
    rate: total > 0 ? Math.round((enabled / total) * 1000) / 10 : null,
  };
}

// ─── Grade × Status matrix ────────────────────────────────────────────────────

async function getGradeStatusMatrix() {
  const grades = Object.values(COURSE_GRADE);
  const statuses = Object.values(APPLICATION_STATUS);

  const rows = await Application.aggregate([
    {
      $lookup: {
        from: 'courses',
        localField: 'coursesSelected',
        foreignField: '_id',
        as: 'courses',
      },
    },
    { $unwind: { path: '$courses', preserveNullAndEmptyArrays: false } },
    // Deduplicate (application + grade) before counting
    {
      $group: {
        _id: { appId: '$_id', grade: '$courses.grade', status: '$status' },
      },
    },
    {
      $group: {
        _id: { grade: '$_id.grade', status: '$_id.status' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Initialise all cells to 0
  const matrix = {};
  for (const grade of grades) {
    matrix[grade] = {};
    for (const status of statuses) matrix[grade][status] = 0;
  }

  for (const { _id, count } of rows) {
    if (matrix[_id.grade]) matrix[_id.grade][_id.status] = count;
  }

  return matrix;
}

// ─── Main dashboard aggregator ────────────────────────────────────────────────

async function getDashboard(period = 'monthly') {
  const [
    applications,
    revenue,
    enrollments,
    inquiryResponseTimeTrend,
    failedLogins,
    applicationsByStatus,
    applicationsByGrade,
    applicationsByProvince,
    inquiriesByStatus,
    auditByCategory,
    conversionRate,
    avgTimeToEnrollment,
    avgInquiryResponseTime,
    monthlyRevenue,
    mfaAdoption,
    gradeStatusMatrix,
  ] = await Promise.all([
    getApplicationsOverTime(period),
    getRevenueOverTime(period),
    getEnrollmentsOverTime(period),
    getInquiryResponseTimeTrend(period),
    getFailedLoginsOverTime(period),
    getApplicationsByStatus(),
    getApplicationsByGrade(),
    getApplicationsByProvince(),
    getInquiriesByStatus(),
    getAuditByCategory(),
    getConversionRate(),
    getAvgTimeToEnrollment(),
    getAvgInquiryResponseTime(),
    getMonthlyRevenue(),
    getMfaAdoption(),
    getGradeStatusMatrix(),
  ]);

  return {
    period,
    lines: {
      applications,
      revenue,
      enrollments,
      inquiryResponseTimeTrend,
      failedLogins,
    },
    pies: {
      applicationsByStatus,
      applicationsByGrade,
      applicationsByProvince,
      inquiriesByStatus,
      auditByCategory,
    },
    metrics: {
      conversionRate,
      avgTimeToEnrollment,
      avgInquiryResponseTime,
      monthlyRevenue,
      mfaAdoption,
    },
    gradeStatusMatrix,
  };
}

// ─── Capacity alerts ──────────────────────────────────────────────────────────

const CAPACITY_THRESHOLDS = Object.freeze({
  APPROACHING: 0.8,  // >= 80% full
  LOW_FILL: 0.3,     // < 30% full AND start date within 14 days
  LOW_DAYS: 14,
});

async function getCapacityAlerts() {
  const now = new Date();
  const twoWeeks = new Date(now.getTime() + CAPACITY_THRESHOLDS.LOW_DAYS * 24 * 60 * 60 * 1000);

  const intakes = await Intake.find({ isActive: true, startDate: { $gte: now } }).lean();

  // Fetch all courses once (for defaultCapacity lookup)
  const courses = await Course.find({ isActive: true }).lean();
  const coursesByGrade = {};
  for (const c of courses) {
    if (!coursesByGrade[c.grade]) coursesByGrade[c.grade] = [];
    coursesByGrade[c.grade].push(c);
  }

  const alerts = await Promise.all(
    intakes.map(async (intake) => {
      const [enrolled, totalApplications] = await Promise.all([
        Application.countDocuments({ preferredIntake: intake._id, status: APPLICATION_STATUS.ENROLLED }),
        Application.countDocuments({ preferredIntake: intake._id }),
      ]);

      // Intake-level capacity overrides course default; fall back to sum of
      // course capacities across all applicable grades for this intake.
      let capacity = intake.capacity ?? null;
      if (capacity === null) {
        let sum = 0;
        let allDefined = true;
        for (const grade of intake.applicableGrades) {
          const coursesForGrade = coursesByGrade[grade] ?? [];
          const gradeCapacity = coursesForGrade.reduce((acc, c) => acc + (c.capacity ?? 0), 0);
          if (gradeCapacity === 0 && coursesForGrade.every((c) => c.capacity == null)) {
            allDefined = false;
            break;
          }
          sum += gradeCapacity;
        }
        capacity = allDefined ? sum : null;
      }

      const daysUntilStart = Math.ceil((intake.startDate - now) / 86400000);
      const fillRate = capacity ? Math.round((enrolled / capacity) * 100) : null;

      let alertLevel = null;
      if (capacity !== null) {
        if (enrolled >= capacity) alertLevel = 'full';
        else if (enrolled >= Math.floor(capacity * CAPACITY_THRESHOLDS.APPROACHING)) alertLevel = 'approaching';
        else if (intake.startDate <= twoWeeks && enrolled < Math.floor(capacity * CAPACITY_THRESHOLDS.LOW_FILL)) alertLevel = 'low';
      }

      return {
        id: intake._id.toString(),
        title: intake.title,
        startDate: intake.startDate,
        applicableGrades: intake.applicableGrades,
        capacity,
        enrolled,
        totalApplications,
        fillRate,
        alertLevel,
        daysUntilStart,
      };
    })
  );

  // Sort: full first, then approaching, then low, then no alert; then by date
  const ORDER = { full: 0, approaching: 1, low: 2, null: 3 };
  return alerts.sort(
    (a, b) =>
      (ORDER[a.alertLevel] ?? 3) - (ORDER[b.alertLevel] ?? 3) ||
      a.startDate - b.startDate
  );
}

module.exports = { getDashboard, getCapacityAlerts };
