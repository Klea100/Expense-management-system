// Manual Budget Alert Check Script
// This script will help debug why emails aren't being sent

const mongoose = require('mongoose');
const Team = require('./src/models/Team');
const budgetService = require('./src/services/budgetService');
const emailService = require('./src/services/emailService');
require('dotenv').config();

async function debugBudgetAlerts() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/team_expense_management');

        console.log('Connected to MongoDB');

        // Get all teams
        const teams = await Team.find({ isActive: true });
        
        console.log('\n=== TEAM BUDGET STATUS ===');
        
        for (const team of teams) {
            // Update total spent
            await team.updateTotalSpent();
            
            console.log(`\nTeam: ${team.name}`);
            console.log(`Budget: $${team.budget}`);
            console.log(`Total Spent: $${team.totalSpent}`);
            console.log(`Budget Utilization: ${team.budgetUtilization}%`);
            console.log(`Alerts Sent:`, team.alertsSent);
            
            // Check if email service is configured
            const isEmailConfigured = process.env.BREVO_API_KEY || process.env.SENDER_EMAIL;
            console.log(`Email Service Configured: ${!!isEmailConfigured}`);
            
            // Manual trigger budget alert check
            if (team.budgetUtilization >= 80) {
                console.log(`⚠️  Team "${team.name}" should trigger alert (${team.budgetUtilization}%)`);
                
                // Reset alerts for testing (uncomment if needed)
                // team.alertsSent.warning = false;
                // team.alertsSent.critical = false;
                // await team.save();
                
                try {
                    const result = await budgetService.checkBudgetAlerts(team._id);
                    console.log(`Alert check result:`, result);
                } catch (error) {
                    console.error(`Error checking alerts for ${team.name}:`, error.message);
                }
            }
        }
        
        console.log('\n=== EMAIL SERVICE TEST ===');
        
        // Test email service directly
        try {
            if (process.env.BREVO_API_KEY || process.env.SENDER_EMAIL) {
                console.log('Testing email service...');
                // Replace with your email for testing
                const testEmail = process.env.TEST_EMAIL_RECIPIENT || 'you@example.com';
                const result = await emailService.sendTestEmail(testEmail);
                console.log('Test email result:', result);
            } else {
                console.log('❌ Email service not configured. Check BREVO_API_KEY and SENDER_EMAIL environment variables.');
            }
        } catch (error) {
            console.error('Email service test failed:', error.message);
        }
        
    } catch (error) {
        console.error('Script error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
        process.exit(0);
    }
}

// Run the debug script
debugBudgetAlerts();