const Team = require('../models/Team');
const Expense = require('../models/Expenses');
const mongoose = require('mongoose');

class TeamService {
    
    // Get teams with filtering and pagination
    async getTeams({ page = 1, limit = 10, status, search }) {
        const skip = (page - 1) * limit;
        let query = { isActive: true };
        
        // Add search functionality
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { 'members.name': { $regex: search, $options: 'i' } }
            ];
        }
        
        // Get teams with basic info
        let teams = await Team.find(query)
            .select('-__v')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });
        
        // Filter by budget status if specified
        if (status) {
            teams = teams.filter(team => team.budgetStatus === status);
        }
        
        const totalItems = await Team.countDocuments(query);
        const totalPages = Math.ceil(totalItems / limit);
        
        return {
            teams,
            totalItems,
            totalPages
        };
    }
    
    // Get team by ID with detailed info
    async getTeamById(teamId) {
        const team = await Team.findOne({ _id: teamId, isActive: true })
            .select('-__v');
        
        if (!team) {
            return null;
        }
        
        // Get recent expenses for this team
        const recentExpenses = await Expense.find({
            team: teamId,
            isActive: true
        })
        .select('amount description category date status')
        .sort({ createdAt: -1 })
        .limit(10);
        
        return {
            ...team.toObject(),
            recentExpenses
        };
    }
    
    // Create new team
    async createTeam(teamData) {
        const team = new Team(teamData);
        await team.save();
        return team;
    }
    
    // Update team
    async updateTeam(teamId, updateData) {
        // Remove fields that shouldn't be updated directly
        const { totalSpent, alertsSent, ...safeUpdateData } = updateData;
        
        const team = await Team.findOneAndUpdate(
            { _id: teamId, isActive: true },
            safeUpdateData,
            { new: true, runValidators: true }
        );
        
        // If budget was updated, recalculate alerts
        if (updateData.budget && team) {
            team.alertsSent = {
                warning: false,
                critical: false
            };
            await team.save();
        }
        
        return team;
    }
    
    // Soft delete team
    async deleteTeam(teamId) {
        const team = await Team.findOneAndUpdate(
            { _id: teamId, isActive: true },
            { isActive: false },
            { new: true }
        );
        
        // Also soft delete associated expenses
        if (team) {
            await Expense.updateMany(
                { team: teamId },
                { isActive: false }
            );
        }
        
        return team;
    }
    
    // Add member to team
    async addTeamMember(teamId, memberData) {
        const team = await Team.findOne({ _id: teamId, isActive: true });
        
        if (!team) {
            return null;
        }
        
        await team.addMember(memberData);
        return team;
    }
    
    // Remove member from team
    async removeTeamMember(teamId, memberId) {
        const team = await Team.findOne({ _id: teamId, isActive: true });
        
        if (!team) {
            return null;
        }
        
        await team.removeMember(memberId);
        return team;
    }
    
    // Get team expenses with filtering
    async getTeamExpenses(teamId, filters = {}, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        
        const expenses = await Expense.getTeamExpenses(teamId, filters)
            .skip(skip)
            .limit(limit);
        
        const totalItems = await Expense.countDocuments({
            team: teamId,
            isActive: true,
            ...(filters.status && { status: filters.status }),
            ...(filters.category && { category: filters.category }),
            ...(filters.dateFrom || filters.dateTo) && {
                date: {
                    ...(filters.dateFrom && { $gte: new Date(filters.dateFrom) }),
                    ...(filters.dateTo && { $lte: new Date(filters.dateTo) })
                }
            }
        });
        
        const totalPages = Math.ceil(totalItems / limit);
        
        return {
            expenses,
            totalItems,
            totalPages
        };
    }
    
    // Get team analytics
    async getTeamAnalytics(teamId, period = 'month') {
        const team = await Team.findOne({ _id: teamId, isActive: true });
        
        if (!team) {
            throw new Error('Team not found');
        }
        
        // Get expense analytics
        const categoryAnalytics = await Expense.getExpenseAnalytics(teamId, period);
        
        // Get spending trend (daily totals for the period)
        const now = new Date();
        let startDate;
        
        switch (period) {
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                startDate = new Date(now.getFullYear(), quarter * 3, 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            default:
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        
        const dailySpending = await Expense.aggregate([
            {
                $match: {
                    team: mongoose.Types.ObjectId(teamId),
                    date: { $gte: startDate },
                    status: 'approved',
                    isActive: true
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$date' },
                        month: { $month: '$date' },
                        day: { $dayOfMonth: '$date' }
                    },
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);
        
        // Calculate budget projection
        const daysInPeriod = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
        const avgDailySpending = team.totalSpent / Math.max(daysInPeriod, 1);
        
        let projectionDays;
        switch (period) {
            case 'week':
                projectionDays = 7;
                break;
            case 'month':
                projectionDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                break;
            case 'quarter':
                projectionDays = 90;
                break;
            case 'year':
                projectionDays = 365;
                break;
            default:
                projectionDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        }
        
        const projectedSpending = avgDailySpending * projectionDays;
        
        return {
            team: {
                name: team.name,
                budget: team.budget,
                totalSpent: team.totalSpent,
                budgetUtilization: team.budgetUtilization,
                remainingBudget: team.remainingBudget,
                budgetStatus: team.budgetStatus
            },
            period,
            categoryAnalytics,
            dailySpending,
            projections: {
                projectedSpending,
                projectedUtilization: Math.round((projectedSpending / team.budget) * 100),
                isOverBudgetRisk: projectedSpending > team.budget
            },
            insights: {
                avgDailySpending,
                topCategory: categoryAnalytics.length > 0 ? categoryAnalytics[0]._id : null,
                totalTransactions: categoryAnalytics.reduce((sum, cat) => sum + cat.count, 0)
            }
        };
    }
    
    // Get teams exceeding budget thresholds
    async getTeamsExceedingThreshold(threshold = 80) {
        return await Team.find({
            isActive: true,
            $expr: {
                $gte: [
                    { $multiply: [{ $divide: ['$totalSpent', '$budget'] }, 100] },
                    threshold
                ]
            }
        });
    }
    
    // Update team's total spent (used after expense changes)
    async updateTeamTotalSpent(teamId) {
        const team = await Team.findById(teamId);
        if (team) {
            await team.updateTotalSpent();
        }
        return team;
    }
}

module.exports = new TeamService();