const Expense = require('../models/Expenses');
const Team = require('../models/Team');
const aiService = require('./aiService');
const budgetService = require('./budgetService');
const mongoose = require('mongoose');

class ExpenseService {
    
    // Get expenses with filtering and pagination
    async getExpenses(filters = {}, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        let query = { isActive: true };
        
        // Apply filters
        if (filters.status) query.status = filters.status;
        if (filters.category) query.category = filters.category;
        if (filters.team) query.team = filters.team;
        
        // Date range filter
        if (filters.dateFrom || filters.dateTo) {
            query.date = {};
            if (filters.dateFrom) query.date.$gte = new Date(filters.dateFrom);
            if (filters.dateTo) query.date.$lte = new Date(filters.dateTo);
        }
        
        // Search filter
        if (filters.search) {
            query.$text = { $search: filters.search };
        }
        
        const expenses = await Expense.find(query)
            .populate('team', 'name budget')
            .select('-__v')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        const totalItems = await Expense.countDocuments(query);
        const totalPages = Math.ceil(totalItems / limit);
        
        return {
            expenses,
            totalItems,
            totalPages
        };
    }
    
    // Get expense by ID
    async getExpenseById(expenseId) {
        const expense = await Expense.findOne({ _id: expenseId, isActive: true })
            .populate('team', 'name budget budgetUtilization')
            .select('-__v');
        
        return expense;
    }
    
    // Create new expense
    async createExpense(expenseData) {
        const expense = new Expense(expenseData);
        await expense.save();
        
        // Get AI category suggestion if description provided
        try {
            if (expense.description && expense.description.length > 5) {
                const aiSuggestion = await aiService.suggestCategory(expense.description);
                if (aiSuggestion) {
                    expense.aiInsights = {
                        suggestedCategory: aiSuggestion.category,
                        confidence: aiSuggestion.confidence,
                        analysisDate: new Date()
                    };
                    await expense.save();
                }
            }
        } catch (error) {
            console.error('Error getting AI category suggestion:', error);
            // Continue without AI suggestion if it fails
        }
        
        // Check for duplicate expenses
        try {
            const duplicateCheck = await this.checkForDuplicates(expense);
            if (duplicateCheck.isDuplicate) {
                expense.aiInsights = {
                    ...expense.aiInsights,
                    duplicateCheck: duplicateCheck
                };
                await expense.save();
            }
        } catch (error) {
            console.error('Error checking for duplicates:', error);
        }
        
        return expense.populate('team', 'name budget');
    }
    
    // Update expense
    async updateExpense(expenseId, updateData) {
        // Don't allow updating certain fields directly
        const { status, approvedBy, aiInsights, ...safeUpdateData } = updateData;
        
        const expense = await Expense.findOneAndUpdate(
            { _id: expenseId, isActive: true, status: 'pending' },
            safeUpdateData,
            { new: true, runValidators: true }
        ).populate('team', 'name budget');
        
        return expense;
    }
    
    // Soft delete expense
    async deleteExpense(expenseId) {
        const expense = await Expense.findOneAndUpdate(
            { _id: expenseId, isActive: true },
            { isActive: false },
            { new: true }
        );
        
        return expense;
    }
    
    // Approve expense
    async approveExpense(expenseId, approver) {
        const expense = await Expense.findOne({
            _id: expenseId,
            isActive: true,
            status: 'pending'
        });
        
        if (!expense) {
            return null;
        }
        
        await expense.approve(approver);
        
        // Check budget alerts after approval
        try {
            await budgetService.checkBudgetAlerts(expense.team);
        } catch (error) {
            console.error('Error checking budget alerts:', error);
        }
        
        return expense.populate('team', 'name budget');
    }
    
    // Reject expense
    async rejectExpense(expenseId, rejector, reason) {
        const expense = await Expense.findOne({
            _id: expenseId,
            isActive: true,
            status: 'pending'
        });
        
        if (!expense) {
            return null;
        }
        
        await expense.reject(rejector, reason);
        return expense.populate('team', 'name budget');
    }
    
    // Add note to expense
    async addExpenseNote(expenseId, noteText, author) {
        const expense = await Expense.findOne({
            _id: expenseId,
            isActive: true
        });
        
        if (!expense) {
            return null;
        }
        
        await expense.addNote(noteText, author);
        return expense.populate('team', 'name budget');
    }
    
    // Get AI category suggestion for expense
    async getAICategorySuggestion(expenseId) {
        const expense = await Expense.findOne({
            _id: expenseId,
            isActive: true
        });
        
        if (!expense) {
            return null;
        }
        
        try {
            const suggestion = await aiService.suggestCategory(expense.description);
            
            if (suggestion) {
                // Update expense with AI insights
                expense.aiInsights = {
                    ...expense.aiInsights,
                    suggestedCategory: suggestion.category,
                    confidence: suggestion.confidence,
                    analysisDate: new Date()
                };
                await expense.save();
            }
            
            return suggestion;
        } catch (error) {
            console.error('Error getting AI category suggestion:', error);
            throw new Error('AI service temporarily unavailable');
        }
    }
    
    // Check for duplicate expenses
    async checkForDuplicates(expense) {
        const similarExpenses = await Expense.find({
            _id: { $ne: expense._id },
            team: expense.team,
            amount: {
                $gte: expense.amount * 0.95, // Within 5% of amount
                $lte: expense.amount * 1.05
            },
            date: {
                $gte: new Date(expense.date.getTime() - 7 * 24 * 60 * 60 * 1000), // Within 7 days
                $lte: new Date(expense.date.getTime() + 7 * 24 * 60 * 60 * 1000)
            },
            isActive: true
        }).limit(5);
        
        let duplicates = [];
        
        for (const similar of similarExpenses) {
            // Simple text similarity check
            const similarity = this.calculateTextSimilarity(
                expense.description.toLowerCase(),
                similar.description.toLowerCase()
            );
            
            if (similarity > 0.8) { // 80% similarity threshold
                duplicates.push({
                    expenseId: similar._id,
                    similarity: similarity
                });
            }
        }
        
        return {
            isDuplicate: duplicates.length > 0,
            similarExpenses: duplicates
        };
    }
    
    // Calculate text similarity (simple Levenshtein-based)
    calculateTextSimilarity(str1, str2) {
        const matrix = [];
        const n = str2.length;
        const m = str1.length;
        
        if (n === 0) return m === 0 ? 1 : 0;
        if (m === 0) return 0;
        
        // Initialize matrix
        for (let i = 0; i <= n; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= m; j++) {
            matrix[0][j] = j;
        }
        
        // Calculate distances
        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                const cost = str1[j - 1] === str2[i - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        
        const distance = matrix[n][m];
        const maxLength = Math.max(str1.length, str2.length);
        return 1 - (distance / maxLength);
    }
    
    // Get expense analytics
    async getExpenseAnalytics(filters = {}) {
        const { team, period, dateFrom, dateTo } = filters;
        
        // Build date range
        let startDate, endDate = new Date();
        
        if (dateFrom && dateTo) {
            startDate = new Date(dateFrom);
            endDate = new Date(dateTo);
        } else {
            const now = new Date();
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
        }
        
        // By default analytics include only approved expenses. Set filters.includePending = true to include pending as well.
        const matchStage = {
            date: { $gte: startDate, $lte: endDate },
            isActive: true
        };

        if (!filters.includePending) {
            matchStage.status = 'approved';
        }
        
        if (team) matchStage.team = mongoose.Types.ObjectId(team);
        
        // Overall statistics
        const overallStats = await Expense.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    totalCount: { $sum: 1 },
                    avgAmount: { $avg: '$amount' },
                    minAmount: { $min: '$amount' },
                    maxAmount: { $max: '$amount' }
                }
            }
        ]);
        
        // Category breakdown
        const categoryStats = await Expense.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$category',
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 },
                    avgAmount: { $avg: '$amount' }
                }
            },
            { $sort: { totalAmount: -1 } }
        ]);
        
        // Daily spending trend
        const dailyTrend = await Expense.aggregate([
            { $match: matchStage },
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
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);
        
        // Team comparison (if not filtered by specific team)
        let teamComparison = [];
        if (!team) {
            teamComparison = await Expense.aggregate([
                { $match: matchStage },
                {
                    $lookup: {
                        from: 'teams',
                        localField: 'team',
                        foreignField: '_id',
                        as: 'teamInfo'
                    }
                },
                { $unwind: '$teamInfo' },
                {
                    $group: {
                        _id: '$team',
                        teamName: { $first: '$teamInfo.name' },
                        totalAmount: { $sum: '$amount' },
                        count: { $sum: 1 },
                        budget: { $first: '$teamInfo.budget' }
                    }
                },
                {
                    $addFields: {
                        budgetUtilization: {
                            $multiply: [
                                { $divide: ['$totalAmount', '$budget'] },
                                100
                            ]
                        }
                    }
                },
                { $sort: { totalAmount: -1 } }
            ]);
        }
        
        // Status distribution
        const statusStats = await Expense.aggregate([
            {
                $match: {
                    date: { $gte: startDate, $lte: endDate },
                    isActive: true,
                    ...(team && { team: mongoose.Types.ObjectId(team) })
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);
        
        return {
            period: filters.period || 'month',
            dateRange: { startDate, endDate },
            overall: overallStats[0] || {
                totalAmount: 0,
                totalCount: 0,
                avgAmount: 0,
                minAmount: 0,
                maxAmount: 0
            },
            categoryBreakdown: categoryStats,
            dailyTrend: dailyTrend,
            teamComparison: teamComparison,
            statusDistribution: statusStats,
            insights: {
                topCategory: categoryStats.length > 0 ? categoryStats[0]._id : null,
                avgDailySpending: overallStats[0] ? 
                    overallStats[0].totalAmount / Math.max(1, dailyTrend.length) : 0,
                mostActiveDay: dailyTrend.reduce((max, day) => 
                    day.count > (max.count || 0) ? day : max, {})
            }
        };
    }
    
    // Get pending expenses requiring attention
    async getPendingExpenses(teamId = null, daysOld = null) {
        let query = {
            status: 'pending',
            isActive: true
        };
        
        if (teamId) query.team = teamId;
        
        if (daysOld) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            query.createdAt = { $lte: cutoffDate };
        }
        
        return await Expense.find(query)
            .populate('team', 'name')
            .sort({ createdAt: 1 }) // Oldest first
            .limit(50);
    }
}

module.exports = new ExpenseService();