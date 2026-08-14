'use strict';

/**
 * Comprehensive end-to-end seed script for local development and demos.
 * Idempotent per domain — re-running skips any collection that already has
 * data, so it's safe to run repeatedly without duplicating records.
 *
 * Covers: system roles, Super Admin + two demo staff accounts (Registrar,
 * Finance) — all three always created with fixed demo credentials unless
 * overridden by env vars — plus settings, courses, intakes, applications
 * (spanning every status), invoices, gallery items, testimonials, FAQs,
 * announcements, inquiries, and a small set of illustrative audit log entries.
 *
 * Does NOT call Cloudinary, Mailjet, or Puppeteer — those require real
 * credentials/network access this script can't assume are present. Anywhere
 * a real upload or PDF would normally happen (ID documents, gallery media,
 * invoice PDFs), a clearly-marked placeholder reference is stored instead,
 * inserted directly via the models rather than through the service layer
 * (which would attempt those real external calls).
 *
 * Usage: node scripts/seed.js
 * Optional env vars: SEED_SUPER_ADMIN_EMAIL / SEED_SUPER_ADMIN_PASSWORD /
 * SEED_SUPER_ADMIN_NAME — override the Super Admin's fixed demo credentials
 * if set; Super Admin is created either way.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');

const Role = require('../src/modules/roles/role.model');
const User = require('../src/modules/users/user.model');
const Course = require('../src/modules/courses/course.model');
const Intake = require('../src/modules/courses/intake.model');
const Application = require('../src/modules/applications/application.model');
const Invoice = require('../src/modules/invoices/invoice.model');
const GalleryItem = require('../src/modules/gallery/gallery.model');
const Testimonial = require('../src/modules/testimonials/testimonial.model');
const FAQ = require('../src/modules/faqs/faq.model');
const Announcement = require('../src/modules/announcements/announcement.model');
const Inquiry = require('../src/modules/inquiries/inquiry.model');
const Settings = require('../src/modules/settings/settings.model');
const AuditLog = require('../src/modules/auditLogs/auditLog.model');

const encryption = require('../src/shared/security/encryption');
const blindIndex = require('../src/shared/security/blindIndex');
const { hashPassword } = require('../src/modules/auth/auth.utils');
const { generateReferenceCode } = require('../src/shared/utils/generateReference');
const {
  SYSTEM_ROLES,
  SYSTEM_ROLE_PERMISSIONS,
  COURSE_GRADE,
  ID_TYPE,
  APPLICATION_STATUS,
  INVOICE_TYPE,
  INQUIRY_STATUS,
  GALLERY_CATEGORIES,
} = require('../src/shared/constants/enums');

const log = (...args) => console.log('[seed]', ...args); // eslint-disable-line no-console

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
async function seedRoles() {
  const results = {};
  for (const roleName of Object.values(SYSTEM_ROLES)) {
    let role = await Role.findOne({ name: roleName });
    if (!role) {
      role = await Role.create({
        name: roleName,
        permissions: SYSTEM_ROLE_PERMISSIONS[roleName],
        isSystemRole: true,
      });
      log(`Created role: ${roleName}`);
    } else {
      role.permissions = SYSTEM_ROLE_PERMISSIONS[roleName];
      role.isSystemRole = true;
      await role.save();
      log(`Role already exists, synced permissions: ${roleName}`);
    }
    results[roleName] = role;
  }
  return results;
}

// ---------------------------------------------------------------------------
// Users — Super Admin (env-gated) + two demo staff accounts
// ---------------------------------------------------------------------------
async function createUserIfMissing({ name, email, password, roleId }) {
  const emailBidx = await blindIndex.computeBlindIndex(email);
  const existing = await User.findOne({ email_bidx: emailBidx });
  if (existing) {
    log(`User already exists, skipping: ${email}`);
    return existing;
  }

  const user = await User.create({
    name,
    email_enc: await encryption.encrypt(email),
    email_bidx: emailBidx,
    role: roleId,
    passwordHash: await hashPassword(password),
    isActive: true,
  });
  log(`Created user: ${email} (password: ${password})`);
  return user;
}

/**
 * Always creates a Super Admin, same as the Registrar/Finance demo accounts —
 * not gated behind whether env vars are set. SEED_SUPER_ADMIN_EMAIL /
 * SEED_SUPER_ADMIN_PASSWORD / SEED_SUPER_ADMIN_NAME, if set, override the
 * fixed demo credentials below (useful for a real environment where you want
 * a specific Super Admin identity); if unset, the fixed demo credentials are
 * used, exactly like Registrar/Finance already do.
 */
async function seedSuperAdmin(superAdminRole) {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL || 'superadmin@liko.test';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD || 'SuperAdminDemo123!';
  const name = process.env.SEED_SUPER_ADMIN_NAME || 'Liko Super Admin';

  return createUserIfMissing({ name, email, password, roleId: superAdminRole._id });
}

/**
 * Two demo staff accounts alongside Super Admin, one per commonly-exercised
 * role, using fixed non-production credentials so they're reproducible
 * across every environment this script runs in. These are demo/dev
 * credentials only — never use them as-is in production.
 */
async function seedDemoStaffUsers(roles) {
  const registrar = await createUserIfMissing({
    name: 'Nomsa Registrar',
    email: 'registrar@liko.test',
    password: 'RegistrarDemo123!',
    roleId: roles[SYSTEM_ROLES.REGISTRAR]._id,
  });

  const finance = await createUserIfMissing({
    name: 'Bongani Finance',
    email: 'finance@liko.test',
    password: 'FinanceDemo123!',
    roleId: roles[SYSTEM_ROLES.FINANCE]._id,
  });

  return { registrar, finance };
}

// ---------------------------------------------------------------------------
// Settings (singleton)
// ---------------------------------------------------------------------------
async function seedSettings() {
  const existing = await Settings.findById(Settings.SINGLETON_ID);
  if (existing) {
    log('Settings already seeded, skipping');
    return existing;
  }

  const settings = await Settings.create({
    _id: Settings.SINGLETON_ID,
    bankAccounts: [
      { bankName: 'Standard Bank', accountNumber: '10192639658', branchCode: '051001' },
      { bankName: 'Capitec Bank', accountNumber: '0730749820', branchCode: '470010' },
    ],
    psiraRegistrationFee: 500,
    whatsappNumber: '0730749820',
    contactPhone: '0392551632',
  });
  log('Seeded settings (banking details, PSIRA fee, contact info)');
  return settings;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------
async function seedCourses() {
  const existingCount = await Course.countDocuments();
  if (existingCount > 0) {
    log('Courses already seeded, skipping');
    return Course.find();
  }

  const courseData = [
    { grade: COURSE_GRADE.E, title: 'Grade E — Entry-Level Foundation Training', description: 'Foundation-level security training covering core PSIRA competencies.', duration: '1 Week', fee: 700 },
    { grade: COURSE_GRADE.D, title: 'Grade D — Access Control & Security Officer Training', description: 'Access control procedures and general security officer duties.', duration: '1 Week', fee: 800 },
    { grade: COURSE_GRADE.C, title: 'Grade C — Supervisory Level Training', description: 'Supervisory skills for security team leads.', duration: '1 Week', fee: 900 },
    { grade: COURSE_GRADE.B, title: 'Grade B — Management & Specialized Security Training', description: 'Management-level and specialized security training.', duration: '1 Week', fee: 1350 },
  ];

  const courses = await Course.insertMany(courseData.map((c) => ({ ...c, isActive: true })));
  log(`Seeded ${courses.length} courses (Grade E/D/C/B)`);
  return courses;
}

// ---------------------------------------------------------------------------
// Intakes — a mix of past (auto-flags inactive), current, and future
// ---------------------------------------------------------------------------
async function seedIntakes() {
  const existingCount = await Intake.countDocuments();
  if (existingCount > 0) {
    log('Intakes already seeded, skipping');
    return Intake.find();
  }

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const intakeData = [
    { title: 'June 2026 Intake', startDate: new Date(now - 45 * DAY), applicableGrades: [COURSE_GRADE.E, COURSE_GRADE.D], isActive: true }, // past — autoFlagPastIntakes will flip this to inactive on next read
    { title: 'August 2026 Intake', startDate: new Date(now + 14 * DAY), applicableGrades: [COURSE_GRADE.E, COURSE_GRADE.D, COURSE_GRADE.C, COURSE_GRADE.B], isActive: true },
    { title: 'September 2026 Intake', startDate: new Date(now + 45 * DAY), applicableGrades: [COURSE_GRADE.E, COURSE_GRADE.D], isActive: true },
    { title: 'October 2026 Intake', startDate: new Date(now + 75 * DAY), applicableGrades: [COURSE_GRADE.C, COURSE_GRADE.B], isActive: true },
  ];

  const intakes = await Intake.insertMany(intakeData);
  log(`Seeded ${intakes.length} intakes (past, upcoming, future)`);
  return intakes;
}

// ---------------------------------------------------------------------------
// Applications — one per status in the state machine, using real
// encryption/blind-index (no external calls involved, safe to run directly)
// ---------------------------------------------------------------------------
async function seedApplications(courses, intakes, staffUsers) {
  const existingCount = await Application.countDocuments();
  if (existingCount > 0) {
    log('Applications already seeded, skipping');
    return Application.find();
  }

  const courseByGrade = Object.fromEntries(courses.map((c) => [c.grade, c]));
  const upcomingIntake = intakes.find((i) => i.title === 'August 2026 Intake');
  const laterIntake = intakes.find((i) => i.title === 'September 2026 Intake');

  const applicantData = [
    {
      firstName: 'Nomvula', lastName: 'Khumalo', idType: ID_TYPE.SA_ID, idNumber: '8001015009087',
      phone: '0821234567', email: 'nomvula.khumalo@example.com', grades: [COURSE_GRADE.D],
      intake: upcomingIntake, status: APPLICATION_STATUS.NEW,
    },
    {
      firstName: 'Sipho', lastName: 'Dlamini', idType: ID_TYPE.SA_ID, idNumber: '9202204720085',
      phone: '0731234567', email: 'sipho.dlamini@example.com', grades: [COURSE_GRADE.E, COURSE_GRADE.D],
      intake: upcomingIntake, status: APPLICATION_STATUS.UNDER_REVIEW,
    },
    {
      firstName: 'Thandiwe', lastName: 'Mokoena', idType: ID_TYPE.SA_ID, idNumber: '8506122345083',
      phone: '0821239876', email: 'thandiwe.mokoena@example.com', grades: [COURSE_GRADE.C],
      intake: upcomingIntake, status: APPLICATION_STATUS.PAYMENT_VERIFIED,
    },
    {
      firstName: 'Mandla', lastName: 'Zulu', idType: ID_TYPE.SA_ID, idNumber: '9001015800086',
      phone: '0791234567', email: 'mandla.zulu@example.com', grades: [COURSE_GRADE.B],
      intake: laterIntake, status: APPLICATION_STATUS.ENROLLED,
    },
    {
      firstName: 'Lindiwe', lastName: 'Ndlovu', idType: ID_TYPE.PASSPORT, idNumber: 'A1234567',
      phone: '0821112233', email: 'lindiwe.ndlovu@example.com', grades: [COURSE_GRADE.E],
      intake: upcomingIntake, status: APPLICATION_STATUS.REJECTED,
    },
  ];

  const applications = [];
  for (const a of applicantData) {
    const selectedCourses = a.grades.map((g) => courseByGrade[g]);
    const totalAmount = selectedCourses.reduce((sum, c) => sum + c.fee, 0) + 500; // + PSIRA fee

    const referenceCode = await generateReferenceCode(a.lastName, (candidate) =>
      Application.exists({ referenceCode: candidate }).then(Boolean)
    );

    const statusHistory = buildStatusHistory(a.status, staffUsers);

    const application = await Application.create({
      firstName_enc: await encryption.encrypt(a.firstName),
      firstName_bidx: await blindIndex.computeBlindIndex(a.firstName),
      lastName_enc: await encryption.encrypt(a.lastName),
      lastName_bidx: await blindIndex.computeBlindIndex(a.lastName),
      idType: a.idType,
      idNumber_enc: await encryption.encrypt(a.idNumber),
      phone_enc: await encryption.encrypt(a.phone),
      phone_bidx: await blindIndex.computeBlindIndex(a.phone),
      whatsapp_enc: await encryption.encrypt(a.phone),
      email_enc: await encryption.encrypt(a.email),
      email_bidx: await blindIndex.computeBlindIndex(a.email),
      address: {
        street_enc: await encryption.encrypt('12 Main Road'),
        suburb: 'KwaMajova',
        city: 'Mount Frere',
        province: 'Eastern Cape',
        postalCode: '5090',
      },
      coursesSelected: selectedCourses.map((c) => c._id),
      preferredIntake: a.intake._id,
      // No real Cloudinary upload in a seed script — clearly-marked placeholder,
      // not a usable document. Signed-URL generation against this will fail if
      // actually clicked in the admin UI; that's expected for seed data.
      idDocumentUrl: `seed/placeholder-id-doc-${referenceCode}`,
      consentGiven: true,
      consentGivenAt: new Date(),
      referenceCode,
      status: a.status,
      totalAmount,
      statusHistory,
    });

    applications.push(application);
  }

  log(`Seeded ${applications.length} applications spanning every status (new, under_review, payment_verified, enrolled, rejected)`);
  return applications;
}

function buildStatusHistory(finalStatus, staffUsers) {
  const chain = {
    [APPLICATION_STATUS.NEW]: [APPLICATION_STATUS.NEW],
    [APPLICATION_STATUS.UNDER_REVIEW]: [APPLICATION_STATUS.NEW, APPLICATION_STATUS.UNDER_REVIEW],
    [APPLICATION_STATUS.PAYMENT_VERIFIED]: [APPLICATION_STATUS.NEW, APPLICATION_STATUS.UNDER_REVIEW, APPLICATION_STATUS.PAYMENT_VERIFIED],
    [APPLICATION_STATUS.ENROLLED]: [APPLICATION_STATUS.NEW, APPLICATION_STATUS.UNDER_REVIEW, APPLICATION_STATUS.PAYMENT_VERIFIED, APPLICATION_STATUS.ENROLLED],
    [APPLICATION_STATUS.REJECTED]: [APPLICATION_STATUS.NEW, APPLICATION_STATUS.REJECTED],
  };

  const steps = chain[finalStatus];
  const registrarId = staffUsers.registrar ? staffUsers.registrar._id : null;
  const financeId = staffUsers.finance ? staffUsers.finance._id : null;

  return steps.map((status, i) => ({
    status,
    changedBy: status === APPLICATION_STATUS.NEW ? null : (status === APPLICATION_STATUS.PAYMENT_VERIFIED ? financeId : registrarId),
    date: new Date(Date.now() - (steps.length - i) * 2 * 24 * 60 * 60 * 1000),
  }));
}

// ---------------------------------------------------------------------------
// Invoices — for applications that reached payment_verified or enrolled.
// No real Puppeteer/Cloudinary calls; placeholder pdfUrl only.
// ---------------------------------------------------------------------------
async function seedInvoices(applications) {
  const existingCount = await Invoice.countDocuments();
  if (existingCount > 0) {
    log('Invoices already seeded, skipping');
    return;
  }

  let count = 0;
  for (const application of applications) {
    // Every seeded application gets a pro-forma (mirrors real submission behavior)
    await Invoice.create({
      application: application._id,
      type: INVOICE_TYPE.PROFORMA,
      referenceCode: application.referenceCode,
      amount: application.totalAmount,
      pdfUrl: `seed/placeholder-proforma-${application.referenceCode}`,
      issuedAt: application.createdAt,
    });
    count += 1;

    if ([APPLICATION_STATUS.PAYMENT_VERIFIED, APPLICATION_STATUS.ENROLLED].includes(application.status)) {
      await Invoice.create({
        application: application._id,
        type: INVOICE_TYPE.OFFICIAL,
        referenceCode: application.referenceCode,
        amount: application.totalAmount,
        pdfUrl: `seed/placeholder-official-${application.referenceCode}`,
        issuedAt: new Date(),
      });
      count += 1;
    }
  }
  log(`Seeded ${count} invoices (pro-forma for every application, official for payment_verified/enrolled)`);
}

// ---------------------------------------------------------------------------
// Gallery — placeholder public image URLs, no real Cloudinary upload
// ---------------------------------------------------------------------------
async function seedGallery() {
  const existingCount = await GalleryItem.countDocuments();
  if (existingCount > 0) {
    log('Gallery already seeded, skipping');
    return;
  }

  const items = [
    { title: 'Baton handling drill', category: GALLERY_CATEGORIES[0], mediaType: 'image' },
    { title: 'Access control practical', category: GALLERY_CATEGORIES[0], mediaType: 'image' },
    { title: 'Grade D graduation ceremony', category: GALLERY_CATEGORIES[1], mediaType: 'image' },
    { title: 'Grade B graduation group photo', category: GALLERY_CATEGORIES[1], mediaType: 'image' },
    { title: 'Mount Frere training campus', category: GALLERY_CATEGORIES[2], mediaType: 'image' },
    { title: 'Classroom session', category: GALLERY_CATEGORIES[2], mediaType: 'image' },
  ];

  const docs = items.map((item, i) => ({
    ...item,
    mediaUrl: `https://placehold.co/800x600?text=${encodeURIComponent(item.title)}`,
    order: i,
    isActive: true,
  }));

  const created = await GalleryItem.insertMany(docs);
  log(`Seeded ${created.length} gallery items across all three categories`);
}

// ---------------------------------------------------------------------------
// Testimonials
// ---------------------------------------------------------------------------
async function seedTestimonials() {
  const existingCount = await Testimonial.countDocuments();
  if (existingCount > 0) {
    log('Testimonials already seeded, skipping');
    return;
  }

  const testimonials = [
    { studentName: 'Andile Mthembu', courseGrade: COURSE_GRADE.D, quote: 'Liko gave me the training and confidence to start my security career. The instructors were patient and practical.', isFeatured: true, order: 0 },
    { studentName: 'Zanele Khoza', courseGrade: COURSE_GRADE.E, quote: 'One week, real skills, and I was job-ready. Highly recommend Liko to anyone starting out.', isFeatured: true, order: 1 },
    { studentName: 'Sanele Radebe', courseGrade: COURSE_GRADE.B, quote: 'The Grade B management training helped me get promoted within three months of finishing.', isFeatured: false, order: 2 },
  ];

  const created = await Testimonial.insertMany(testimonials);
  log(`Seeded ${created.length} testimonials`);
}

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------
async function seedFaqs() {
  const existingCount = await FAQ.countDocuments();
  if (existingCount > 0) {
    log('FAQs already seeded, skipping');
    return;
  }

  const faqs = [
    { question: 'What documents do I need to apply?', answer: 'A valid South African ID or passport, and proof of the required age for the grade you are applying to.', order: 0 },
    { question: 'How much is the PSIRA registration fee?', answer: 'The compulsory PSIRA registration fee is R500, payable in addition to your course fee.', order: 1 },
    { question: 'How long does each course take?', answer: 'Each grade (E, D, C, and B) is a 1-week course.', order: 2 },
    { question: 'How do I pay for my course?', answer: 'Once you submit your application, you will receive a reference code and banking details by email. Use your reference code as the payment reference.', order: 3 },
    { question: 'When will I know my application has been approved?', answer: 'You will receive an email once your payment has been verified, confirming your enrollment and start date.', order: 4 },
  ];

  const created = await FAQ.insertMany(faqs.map((f) => ({ ...f, isActive: true })));
  log(`Seeded ${created.length} FAQs`);
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
async function seedAnnouncements() {
  const existingCount = await Announcement.countDocuments();
  if (existingCount > 0) {
    log('Announcements already seeded, skipping');
    return;
  }

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const announcements = [
    { title: 'August 2026 Intake Now Open', body: 'Applications are now open for our August intake, covering all grades E through B. Apply early to secure your spot.', isActive: true, publishAt: new Date(now - DAY), expiresAt: new Date(now + 30 * DAY) },
    { title: 'New Grade B Management Course Dates', body: 'We have added a new Grade B management and specialized security training session in October 2026.', isActive: true, publishAt: new Date(now - 2 * DAY), expiresAt: null },
  ];

  const created = await Announcement.insertMany(announcements);
  log(`Seeded ${created.length} announcements`);
}

// ---------------------------------------------------------------------------
// Inquiries — one open, one replied (using real encryption, no external calls)
// ---------------------------------------------------------------------------
async function seedInquiries(staffUsers) {
  const existingCount = await Inquiry.countDocuments();
  if (existingCount > 0) {
    log('Inquiries already seeded, skipping');
    return;
  }

  const openInquiry = await Inquiry.create({
    name_enc: await encryption.encrypt('Zodwa Nkosi'),
    name_bidx: await blindIndex.computeBlindIndex('Zodwa Nkosi'),
    email_enc: await encryption.encrypt('zodwa.nkosi@example.com'),
    email_bidx: await blindIndex.computeBlindIndex('zodwa.nkosi@example.com'),
    phone_enc: await encryption.encrypt('0821119988'),
    message: 'Hi, I would like to know if there is an age limit for the Grade E course. Thank you.',
    status: INQUIRY_STATUS.OPEN,
  });

  const repliedInquiry = await Inquiry.create({
    name_enc: await encryption.encrypt('Themba Cele'),
    name_bidx: await blindIndex.computeBlindIndex('Themba Cele'),
    email_enc: await encryption.encrypt('themba.cele@example.com'),
    email_bidx: await blindIndex.computeBlindIndex('themba.cele@example.com'),
    phone_enc: await encryption.encrypt('0839871234'),
    message: 'Do you offer training on weekends?',
    status: INQUIRY_STATUS.REPLIED,
    replies: [
      {
        message: 'Hi Themba, our courses currently run on weekdays only, Monday to Friday. Thank you for your interest in Liko Security Training.',
        sentBy: staffUsers.registrar ? staffUsers.registrar._id : undefined,
        date: new Date(),
      },
    ],
  });

  log(`Seeded 2 inquiries (1 open: ${openInquiry.id}, 1 replied: ${repliedInquiry.id})`);
}

// ---------------------------------------------------------------------------
// Audit log — a handful of illustrative entries so /admin/audit-logs isn't
// empty in a fresh dev environment. Real entries are written automatically
// by the app from here on; these are clearly attributable to the seed run.
// ---------------------------------------------------------------------------
async function seedAuditLogSamples(staffUsers) {
  const existingCount = await AuditLog.countDocuments();
  if (existingCount > 0) {
    log('Audit log already has entries, skipping illustrative seed entries');
    return;
  }

  const entries = [
    { actor: null, action: 'system.seeded', targetType: null, targetId: null, metadata: { note: 'Initial demo data seeded via scripts/seed.js' } },
    { actor: staffUsers.registrar ? staffUsers.registrar._id : null, action: 'auth.login_success', targetType: null, targetId: null, metadata: {} },
    { actor: staffUsers.finance ? staffUsers.finance._id : null, action: 'application.status_changed', targetType: 'Application', targetId: null, metadata: { newStatus: APPLICATION_STATUS.PAYMENT_VERIFIED, note: 'Illustrative seed entry' } },
  ];

  await AuditLog.insertMany(entries.map((e) => ({ ...e, timestamp: new Date() })));
  log(`Seeded ${entries.length} illustrative audit log entries`);
}

// ---------------------------------------------------------------------------
async function run() {
  await connectDB();

  const roles = await seedRoles();
  await seedSuperAdmin(roles[SYSTEM_ROLES.SUPER_ADMIN]);
  const staffUsers = await seedDemoStaffUsers(roles);

  await seedSettings();
  const courses = await seedCourses();
  const intakes = await seedIntakes();
  const applications = await seedApplications(courses, intakes, staffUsers);
  await seedInvoices(applications);
  await seedGallery();
  await seedTestimonials();
  await seedFaqs();
  await seedAnnouncements();
  await seedInquiries(staffUsers);
  await seedAuditLogSamples(staffUsers);

  await disconnectDB();
  await mongoose.connection.close().catch(() => {});

  log('Done. Demo login credentials (dev/demo use only):');
  log('  Super Admin — superadmin@liko.test / SuperAdminDemo123! (or your SEED_SUPER_ADMIN_* env vars, if set)');
  log('  Registrar   — registrar@liko.test / RegistrarDemo123!');
  log('  Finance     — finance@liko.test / FinanceDemo123!');
  process.exit(0);
}

run().catch((err) => {
  console.error('[seed] Failed:', err); // eslint-disable-line no-console
  process.exit(1);
});
