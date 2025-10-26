const express = require("express");
const { query, body, validationResult } = require('express-validator');
const budgetService = require('../services/budgetService');
const expenseService = require('../services/expenseService');
const aiService = require('../services/aiService');
const emailService = require('../services/emailService');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation errors',
            errors: errors.array()
        });
    }
    next();
};

// GET /api/v1/dashboard - Get main dashboard overview
router.get("/", async (req, res) => {
    try {
        // Get budget summary
        const budgetSummary = await budgetService.getBudgetSummary();
        
        // Get expense analytics (include pending expenses so dashboard metrics reflect pending items)
        const expenseAnalytics = await expenseService.getExpenseAnalytics({
            period: 'month',
            includePending: true
        });
        
        // Get pending expenses requiring attention
        const pendingExpenses = await expenseService.getPendingExpenses(null, 7); // 7+ days old
        
        // Get teams by budget status
        const teamsByStatus = await budgetService.getTeamsByBudgetStatus('all');
        
        const dashboardData = {
            summary: {
                totalTeams: budgetSummary.success ? budgetSummary.summary.totalTeams : 0,
                totalBudget: budgetSummary.success ? budgetSummary.summary.totalBudget : 0,
                totalSpent: budgetSummary.success ? budgetSummary.summary.totalSpent : 0,
                avgUtilization: budgetSummary.success ? budgetSummary.summary.avgUtilization : 0,
                totalExpenses: expenseAnalytics.overall.totalCount,
                avgExpenseAmount: expenseAnalytics.overall.avgAmount || 0
            },
            budgetStatus: budgetSummary.success ? budgetSummary.summary.statusCounts : {
                good: 0,
                warning: 0,
                critical: 0,
                over_budget: 0
            },
            topSpendingTeams: budgetSummary.success ? budgetSummary.summary.topSpendingTeams : [],
            recentExpenses: expenseAnalytics.categoryBreakdown.slice(0, 5),
            pendingExpensesCount: pendingExpenses.length,
            oldestPendingExpense: pendingExpenses.length > 0 ? pendingExpenses[0] : null,
            alerts: {
                teamsOverBudget: teamsByStatus.success ? 
                    teamsByStatus.teams.filter(team => team.budgetUtilization >= 100).length : 0,
                teamsAtWarning: teamsByStatus.success ? 
                    teamsByStatus.teams.filter(team => 
                        team.budgetUtilization >= 80 && team.budgetUtilization < 100
                    ).length : 0
            }
        };

        res.status(200).json({
            success: true,
            message: "Dashboard data retrieved successfully",
            data: dashboardData
        });

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({
            success: false,
            message: "Error fetching dashboard data",
            error: error.message
        });
    }
});

// GET /api/v1/dashboard/budget-summary - Get budget status summary
router.get("/budget-summary", async (req, res) => {
    try {
        const result = await budgetService.getBudgetSummary();
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: "Budget summary retrieved successfully",
                data: result.summary
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.message
            });
        }
    } catch (error) {
        console.error('Error fetching budget summary:', error);
        res.status(500).json({
            success: false,
            message: "Error fetching budget summary",
            error: error.message
        });
    }
});

// GET /api/v1/dashboard/alerts - Get all active alerts
router.get("/alerts", async (req, res) => {
    try {
        // Check budget alerts for all teams
        const alertCheck = await budgetService.checkAllTeamsBudgetAlerts();
        
        // Get teams by status
        const warningTeams = await budgetService.getTeamsByBudgetStatus('warning');
        const criticalTeams = await budgetService.getTeamsByBudgetStatus('critical');
        const overBudgetTeams = await budgetService.getTeamsByBudgetStatus('over-budget');
        
        // Get old pending expenses
        const oldPendingExpenses = await expenseService.getPendingExpenses(null, 7);
        
        const alerts = {
            budgetAlerts: {
                warning: warningTeams.success ? warningTeams.teams : [],
                critical: criticalTeams.success ? criticalTeams.teams : [],
                overBudget: overBudgetTeams.success ? overBudgetTeams.teams : []
            },
            pendingExpenses: {
                count: oldPendingExpenses.length,
                expenses: oldPendingExpenses.slice(0, 10) // Limit to 10 most urgent
            },
            lastChecked: new Date().toISOString(),
            alertsProcessed: alertCheck.success ? alertCheck.totalAlerts : 0
        };

        res.status(200).json({
            success: true,
            message: "Alerts retrieved successfully",
            data: alerts
        });

    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({
            success: false,
            message: "Error fetching alerts",
            error: error.message
        });
    }
});

// POST /api/v1/dashboard/budget-alerts/check - Manually trigger budget alert check
router.post("/budget-alerts/check", async (req, res) => {
    try {
        const result = await budgetService.checkAllTeamsBudgetAlerts();

        res.status(200).json({
            success: true,
            message: "Budget alerts checked successfully",
            data: result
        });

    } catch (error) {
        console.error('Error checking budget alerts:', error);
        res.status(500).json({
            success: false,
            message: "Error checking budget alerts",
            error: error.message
        });
    }
});

// GET /api/v1/dashboard/analytics - Get comprehensive analytics
router.get("/analytics", [
    query('period').optional().isIn(['week', 'month', 'quarter', 'year'])
], handleValidationErrors, async (req, res) => {
    try {
        const period = req.query.period || 'month';
        
        // Get expense analytics
        const expenseAnalytics = await expenseService.getExpenseAnalytics({ period });
        
        // Get budget summary
        const budgetSummary = await budgetService.getBudgetSummary();
        
        const analytics = {
            period,
            expenseAnalytics,
            budgetSummary: budgetSummary.success ? budgetSummary.summary : null,
            generatedAt: new Date().toISOString()
        };

        res.status(200).json({
            success: true,
            message: "Analytics retrieved successfully",
            data: analytics
        });

    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({
            success: false,
            message: "Error fetching analytics",
            error: error.message
        });
    }
});

// GET /api/v1/dashboard/ai-insights/:teamId - Get AI insights for specific team
router.get("/ai-insights/:teamId", [
    query('period').optional().isIn(['week', 'month', 'quarter', 'year'])
], handleValidationErrors, async (req, res) => {
    try {
        const { teamId } = req.params;
        const period = req.query.period || 'month';
        
        const insights = await aiService.generateSpendingInsights(teamId, period);

        res.status(200).json({
            success: true,
            message: "AI insights generated successfully",
            data: insights
        });

    } catch (error) {
        console.error('Error generating AI insights:', error);
        res.status(500).json({
            success: false,
            message: "Error generating AI insights",
            error: error.message
        });
    }
});

// GET /api/v1/dashboard/suspicious-expenses/:teamId - Get suspicious expense analysis
router.get("/suspicious-expenses/:teamId", [
    query('lookbackDays').optional().isInt({ min: 1, max: 365 })
], handleValidationErrors, async (req, res) => {
    try {
        const { teamId } = req.params;
        const lookbackDays = parseInt(req.query.lookbackDays) || 30;
        
        const analysis = await aiService.detectSuspiciousExpenses(teamId, lookbackDays);

        res.status(200).json({
            success: true,
            message: "Suspicious expense analysis completed",
            data: analysis
        });

    } catch (error) {
        console.error('Error analyzing suspicious expenses:', error);
        res.status(500).json({
            success: false,
            message: "Error analyzing suspicious expenses",
            error: error.message
        });
    }
});

// POST /api/v1/dashboard/test-email - Send test email
router.post("/test-email", [
    query('to').isEmail().withMessage('Valid email address required')
], handleValidationErrors, async (req, res) => {
    try {
        const { to } = req.query;
        
        const result = await emailService.sendTestEmail(to);

        res.status(200).json({
            success: true,
            message: "Test email sent successfully",
            data: result
        });

    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).json({
            success: false,
            message: "Error sending test email",
            error: error.message
        });
    }
});

// GET /api/v1/dashboard/service-status - Check status of all services
router.get("/service-status", async (req, res) => {
    try {
        const aiStatus = await aiService.testConnection();
        
        const status = {
            ai: aiStatus,
            email: {
                brevoConfigured: !!process.env.BREVO_API_KEY,
                senderConfigured: !!process.env.SENDER_EMAIL
            },
            database: {
                connected: true // MongoDB connection would be checked here
            },
            timestamp: new Date().toISOString()
        };

        res.status(200).json({
            success: true,
            message: "Service status retrieved successfully",
            data: status
        });

    } catch (error) {
        console.error('Error checking service status:', error);
        res.status(500).json({
            success: false,
            message: "Error checking service status",
            error: error.message
        });
    }
});

// POST /api/v1/dashboard/reset-budget-alerts - Reset budget alert flags and force check
router.post("/reset-budget-alerts", [
    body('teamId').optional().isMongoId().withMessage('Invalid team ID')
], handleValidationErrors, async (req, res) => {
    try {
        const { teamId } = req.body;
        
        if (teamId) {
            // Reset alerts for specific team
            const Team = require('../models/Team');
            const team = await Team.findById(teamId);
            
            if (!team) {
                return res.status(404).json({
                    success: false,
                    message: 'Team not found'
                });
            }
            
            // Reset alert flags
            team.alertsSent.warning = false;
            team.alertsSent.critical = false;
            await team.save();
            
            // Force budget check
            const result = await budgetService.checkBudgetAlerts(teamId);
            
            res.status(200).json({
                success: true,
                message: `Budget alerts reset and checked for team: ${team.name}`,
                data: {
                    team: team.name,
                    budgetUtilization: team.budgetUtilization,
                    alertsReset: true,
                    checkResult: result
                }
            });
        } else {
            // Reset alerts for all teams
            const Team = require('../models/Team');
            const teams = await Team.find({ isActive: true });
            
            const results = [];
            
            for (const team of teams) {
                // Reset alert flags
                team.alertsSent.warning = false;
                team.alertsSent.critical = false;
                await team.save();
                
                // Force budget check
                const result = await budgetService.checkBudgetAlerts(team._id);
                
                results.push({
                    team: team.name,
                    budgetUtilization: team.budgetUtilization,
                    alertsReset: true,
                    checkResult: result
                });
            }
            
            res.status(200).json({
                success: true,
                message: `Budget alerts reset and checked for ${teams.length} teams`,
                data: results
            });
        }
        
    } catch (error) {
        console.error('Error resetting budget alerts:', error);
        res.status(500).json({
            success: false,
            message: "Error resetting budget alerts",
            error: error.message
        });
    }
});

module.exports = router;