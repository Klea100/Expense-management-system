/*
 Seed demo data for Insights and Analytics pages.
 Creates a demo team and a set of expenses across categories in the last 90 days.

 Usage (PowerShell):
   $env:MONGODB_URI = "mongodb://localhost:27017/team_expense_management"; node scripts/seed-demo.js
 Or via npm script:
   npm run seed:demo
*/

const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const Team = require('../src/models/Team');
const Expense = require('../src/models/Expenses');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/team_expense_management';

function randBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function sample(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  await mongoose.connect(MONGODB_URI, { dbName: undefined });
  console.log('[seed] Connected to MongoDB');

  const teamName = 'Insights Demo Team';
  let team = await Team.findOne({ name: teamName });
  if (!team) {
    team = await Team.create({
      name: teamName,
      description: 'Demo team for AI insights and analytics',
      budget: 50000,
      currency: 'USD',
      members: [
        { name: 'Ava Johnson', email: 'ava@example.com', role: 'manager' },
        { name: 'Kai Chen', email: 'kai@example.com', role: 'member' },
        { name: 'Mila Park', email: 'mila@example.com', role: 'member' },
      ],
      createdBy: 'seed-script',
    });
    console.log(`[seed] Created team: ${team.name}`);
  } else {
    console.log(`[seed] Using existing team: ${team.name}`);
  }

  // Generate expenses over the last ~90 days
  const categories = ['travel', 'food', 'supplies', 'software', 'hardware', 'training', 'entertainment', 'other'];

  // Optional: remove previous demo expenses for this team to keep dataset tidy
  const removed = await Expense.deleteMany({ team: team._id, 'submittedBy.email': /@example.com$/ });
  if (removed.deletedCount) console.log(`[seed] Removed ${removed.deletedCount} prior demo expenses`);

  const docs = [];
  const today = new Date();
  const total = 120; // number of expenses to create
  for (let i = 0; i < total; i++) {
    const daysAgo = randBetween(0, 90);
    const d = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const category = sample(categories);
    const amount = Math.max(15, Math.round((Math.random() ** 1.2) * 1200));
    const status = Math.random() < 0.7 ? 'approved' : Math.random() < 0.5 ? 'pending' : 'rejected';

    const descByCategory = {
      travel: ['Flight to client', 'Hotel booking', 'Taxi/Uber', 'Train ticket'],
      food: ['Team lunch', 'Client dinner', 'Coffee run', 'Snacks for meeting'],
      supplies: ['Office supplies', 'Printer ink', 'Notebooks', 'Stationery'],
      software: ['SaaS subscription', 'License renewal', 'Pro plan'],
      hardware: ['Monitor purchase', 'Keyboard & mouse', 'Laptop upgrade'],
      training: ['Online course', 'Certification exam', 'Workshop fee'],
      entertainment: ['Team event', 'Celebration', 'Game night snacks'],
      other: ['Miscellaneous', 'Expense adjustment', 'Freight'],
    };

    const description = sample(descByCategory[category]);

    const doc = new Expense({
      team: team._id,
      amount,
      description,
      category,
      date: d,
      status,
      submittedBy: sample([
        { name: 'Ava Johnson', email: 'ava@example.com' },
        { name: 'Kai Chen', email: 'kai@example.com' },
        { name: 'Mila Park', email: 'mila@example.com' },
      ]),
      currency: 'USD',
      tags: Math.random() < 0.3 ? ['demo'] : [],
      aiInsights: Math.random() < 0.5 ? { suggestedCategory: category, confidence: 0.6 + Math.random() * 0.35 } : undefined,
      isActive: true,
    });

    if (status === 'approved') {
      doc.approvedBy = { name: 'Manager', email: 'manager@example.com', date: new Date(d.getTime() + 3600 * 1000) };
    } else if (status === 'rejected') {
      doc.rejectionReason = sample(['Policy violation', 'Duplicate receipt', 'Missing details', 'Over budget']);
    }

    docs.push(doc);
  }

  await Expense.insertMany(docs);
  console.log(`[seed] Inserted ${docs.length} expenses`);

  // Refresh team's totalSpent based on approved expenses
  await team.updateTotalSpent();
  const fresh = await Team.findById(team._id);
  console.log(`[seed] Team totalSpent updated to ${fresh?.totalSpent}`);

  console.log('[seed] Done. You can now query analytics and AI insights.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[seed] Error:', err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
