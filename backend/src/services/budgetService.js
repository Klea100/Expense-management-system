const Team = require('../models/Team');
const Expense = require('../models/Expenses');
const emailService = require('./emailService');

class BudgetService {
    
    constructor() {
        this.WARNING_THRESHOLD = parseInt(process.env.BUDGET_WARNING_THRESHOLD) || 80;
        this.CRITICAL_THRESHOLD = parseInt(process.env.BUDGET_CRITICAL_THRESHOLD) || 100;
    }
    
    // Check budget alerts for a specific team
    async checkBudgetAlerts(teamId) {
        try {
            const team = await Team.findById(teamId);
            if (!team || !team.isActive) {
                return { success: false, message: 'Team not found' };
            }
            
            // Update total spent first
            await team.updateTotalSpent();
            
            const budgetUtilization = team.budgetUtilization;
            const alerts = [];
            
            // Check for critical threshold (100%)
            if (budgetUtilization >= this.CRITICAL_THRESHOLD && !team.alertsSent.critical) {
                try {
                    await emailService.sendBudgetAlert(team, 'critical', budgetUtilization);
                    team.alertsSent.critical = true;
                    alerts.push({
                        type: 'critical',
                        threshold: this.CRITICAL_THRESHOLD,
                        utilization: budgetUtilization
                    });
                } catch (error) {
                    console.error('Failed to send critical budget alert:', error);
                }
            }
            
            // Check for warning threshold (80%)
            else if (budgetUtilization >= this.WARNING_THRESHOLD && !team.alertsSent.warning) {
                try {
                    await emailService.sendBudgetAlert(team, 'warning', budgetUtilization);
                    team.alertsSent.warning = true;
                    alerts.push({
                        type: 'warning',
                        threshold: this.WARNING_THRESHOLD,
                        utilization: budgetUtilization
                    });
                } catch (error) {
                    console.error('Failed to send warning budget alert:', error);
                }
            }
            
            // Reset alerts if utilization drops below warning threshold
            if (budgetUtilization < this.WARNING_THRESHOLD) {
                team.alertsSent.warning = false;
                team.alertsSent.critical = false;
            }
            
            await team.save();
            
            return {
                success: true,
                team: {
                    id: team._id,
                    name: team.name,
                    budget: team.budget,
                    totalSpent: team.totalSpent,
                    budgetUtilization: budgetUtilization,
                    budgetStatus: team.budgetStatus
                },
                alertsSent: alerts
            };
            
        } catch (error) {
            console.error('Error checking budget alerts:', error);
            return { success: false, message: error.message };
        }
    }
    
    // Check budget alerts for all teams
    async checkAllTeamsBudgetAlerts() {
        try {
            const teams = await Team.find({ isActive: true });
            const results = [];
            
            for (const team of teams) {
                const result = await this.checkBudgetAlerts(team._id);
                results.push(result);
            }
            
            const totalAlerts = results.reduce((sum, result) => 
                sum + (result.alertsSent ? result.alertsSent.length : 0), 0
            );
            
            return {
                success: true,
                teamsChecked: teams.length,
                totalAlerts: totalAlerts,
                results: results
            };
            
        } catch (error) {
            console.error('Error checking all teams budget alerts:', error);
            return { success: false, message: error.message };
        }
    }
    
    // Get teams by budget status
    async getTeamsByBudgetStatus(status = 'all') {
        try {
            const teams = await Team.find({ isActive: true });
            
            let filteredTeams = teams;
            
            switch (status) {
                case 'good':
                    filteredTeams = teams.filter(team => team.budgetUtilization < this.WARNING_THRESHOLD);
                    break;
                case 'warning':
                    filteredTeams = teams.filter(team => 
                        team.budgetUtilization >= this.WARNING_THRESHOLD && 
                        team.budgetUtilization < this.CRITICAL_THRESHOLD
                    );
                    break;
                case 'critical':
                    filteredTeams = teams.filter(team => team.budgetUtilization >= this.CRITICAL_THRESHOLD);
                    break;
                case 'over-budget':
                    filteredTeams = teams.filter(team => team.budgetUtilization >= 100);
                    break;
                default:
                    // Return all teams
                    break;
            }
            
            return {
                success: true,
                status: status,
                count: filteredTeams.length,
                teams: filteredTeams.map(team => ({
                    id: team._id,
                    name: team.name,
                    budget: team.budget,
                    totalSpent: team.totalSpent,
                    budgetUtilization: team.budgetUtilization,
                    remainingBudget: team.remainingBudget,
                    budgetStatus: team.budgetStatus,
                    alertsSent: team.alertsSent
                }))
            };
            
        } catch (error) {
            console.error('Error getting teams by budget status:', error);
            return { success: false, message: error.message };
        }
    }
    
    // Calculate budget forecast for a team
    async calculateBudgetForecast(teamId, forecastPeriodDays = 30) {
        try {
            const team = await Team.findById(teamId);
            if (!team || !team.isActive) {
                return { success: false, message: 'Team not found' };
            }
            
            // Get expenses from the last 30 days to calculate trend
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentExpenses = await Expense.find({
                team: teamId,
                status: 'approved',
                date: { $gte: thirtyDaysAgo },
                isActive: true
            }).sort({ date: 1 });
            
            if (recentExpenses.length === 0) {
                return {
                    success: true,
                    forecast: {
                        team: {
                            id: team._id,
                            name: team.name,
                            budget: team.budget,
                            totalSpent: team.totalSpent
                        },
                        forecastPeriodDays,
                        projectedSpending: 0,
                        projectedTotal: team.totalSpent,
                        projectedUtilization: team.budgetUtilization,
                        isOverBudgetRisk: false,
                        confidence: 'low',
                        trend: 'no_data'
                    }
                };
            }
            
            // Calculate daily average spending
            const totalRecentSpending = recentExpenses.reduce((sum, expense) => sum + expense.amount, 0);
            const daysWithData = Math.max(1, recentExpenses.length / 2); // Rough estimate
            const avgDailySpending = totalRecentSpending / daysWithData;
            
            // Calculate trend (simple linear regression on daily totals)
            const dailyTotals = this.groupExpensesByDay(recentExpenses);
            const trend = this.calculateSpendingTrend(dailyTotals);
            
            // Project spending for the forecast period
            const projectedSpending = avgDailySpending * forecastPeriodDays;
            const projectedTotal = team.totalSpent + projectedSpending;
            const projectedUtilization = Math.round((projectedTotal / team.budget) * 100);
            
            // Determine confidence level
            let confidence = 'medium';
            if (recentExpenses.length < 5) confidence = 'low';
            else if (recentExpenses.length > 20) confidence = 'high';
            
            // Risk assessment
            const isOverBudgetRisk = projectedUtilization > 100;
            const willExceedWarning = projectedUtilization >= this.WARNING_THRESHOLD;
            
            return {
                success: true,
                forecast: {
                    team: {
                        id: team._id,
                        name: team.name,
                        budget: team.budget,
                        totalSpent: team.totalSpent,
                        currentUtilization: team.budgetUtilization
                    },
                    forecastPeriodDays,
                    avgDailySpending,
                    projectedSpending,
                    projectedTotal,
                    projectedUtilization,
                    isOverBudgetRisk,
                    willExceedWarning,
                    confidence,
                    trend: trend.direction,
                    trendStrength: trend.strength,
                    recommendations: this.generateRecommendations(
                        projectedUtilization, 
                        trend, 
                        team.budgetUtilization
                    )
                }
            };
            
        } catch (error) {
            console.error('Error calculating budget forecast:', error);
            return { success: false, message: error.message };
        }
    }
    
    // Group expenses by day
    groupExpensesByDay(expenses) {
        const dailyTotals = {};
        
        expenses.forEach(expense => {
            const dateKey = expense.date.toISOString().split('T')[0];
            if (!dailyTotals[dateKey]) {
                dailyTotals[dateKey] = 0;
            }
            dailyTotals[dateKey] += expense.amount;
        });
        
        return Object.entries(dailyTotals)
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }
    
    // Calculate spending trend
    calculateSpendingTrend(dailyTotals) {
        if (dailyTotals.length < 3) {
            return { direction: 'insufficient_data', strength: 0 };
        }
        
        // Simple trend calculation
        const firstHalf = dailyTotals.slice(0, Math.floor(dailyTotals.length / 2));
        const secondHalf = dailyTotals.slice(Math.floor(dailyTotals.length / 2));
        
        const firstHalfAvg = firstHalf.reduce((sum, day) => sum + day.amount, 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, day) => sum + day.amount, 0) / secondHalf.length;
        
        const difference = secondHalfAvg - firstHalfAvg;
        const percentageChange = Math.abs(difference) / Math.max(firstHalfAvg, 1) * 100;
        
        let direction = 'stable';
        let strength = 'low';
        
        if (Math.abs(difference) > firstHalfAvg * 0.1) { // 10% threshold
            direction = difference > 0 ? 'increasing' : 'decreasing';
            
            if (percentageChange > 50) strength = 'high';
            else if (percentageChange > 20) strength = 'medium';
            else strength = 'low';
        }
        
        return { direction, strength, percentageChange };
    }
    
    // Generate recommendations based on forecast
    generateRecommendations(projectedUtilization, trend, currentUtilization) {
        const recommendations = [];
        
        if (projectedUtilization > 100) {
            recommendations.push({
                type: 'critical',
                message: 'Projected to exceed budget. Immediate action required.',
                action: 'Review and defer non-essential expenses'
            });
        } else if (projectedUtilization >= this.WARNING_THRESHOLD) {
            recommendations.push({
                type: 'warning',
                message: 'Approaching budget limit. Monitor spending closely.',
                action: 'Consider expense approval reviews'
            });
        }
        
        if (trend.direction === 'increasing' && trend.strength !== 'low') {
            recommendations.push({
                type: 'info',
                message: 'Spending trend is increasing.',
                action: 'Analyze recent expense patterns'
            });
        }
        
        if (currentUtilization < 50 && projectedUtilization < 70) {
            recommendations.push({
                type: 'positive',
                message: 'Budget utilization is healthy.',
                action: 'Continue current spending patterns'
            });
        }
        
        return recommendations;
    }
    
    // Get budget summary for dashboard
    async getBudgetSummary() {
        try {
            const teams = await Team.find({ isActive: true });
            
            const summary = {
                totalTeams: teams.length,
                totalBudget: 0,
                totalSpent: 0,
                avgUtilization: 0,
                statusCounts: {
                    good: 0,
                    warning: 0,
                    critical: 0,
                    over_budget: 0
                },
                topSpendingTeams: []
            };
            
            teams.forEach(team => {
                summary.totalBudget += team.budget;
                summary.totalSpent += team.totalSpent;
                
                const utilization = team.budgetUtilization;
                if (utilization >= 100) {
                    summary.statusCounts.over_budget++;
                } else if (utilization >= this.CRITICAL_THRESHOLD) {
                    summary.statusCounts.critical++;
                } else if (utilization >= this.WARNING_THRESHOLD) {
                    summary.statusCounts.warning++;
                } else {
                    summary.statusCounts.good++;
                }
            });
            
            summary.avgUtilization = summary.totalBudget > 0 ? 
                Math.round((summary.totalSpent / summary.totalBudget) * 100) : 0;
            
            // Get top spending teams
            summary.topSpendingTeams = teams
                .sort((a, b) => b.totalSpent - a.totalSpent)
                .slice(0, 5)
                .map(team => ({
                    id: team._id,
                    name: team.name,
                    budget: team.budget,
                    totalSpent: team.totalSpent,
                    budgetUtilization: team.budgetUtilization,
                    budgetStatus: team.budgetStatus
                }));
            
            return {
                success: true,
                summary
            };
            
        } catch (error) {
            console.error('Error getting budget summary:', error);
            return { success: false, message: error.message };
        }
    }
}

module.exports = new BudgetService();