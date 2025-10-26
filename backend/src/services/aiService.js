const OpenAI = require('openai');
const Expense = require('../models/Expenses');

class AIService {
    
    constructor() {
        this.isConfigured = false;
        this.initializeOpenAI();
        this.categories = [
            'travel', 'food', 'supplies', 'software', 
            'hardware', 'training', 'entertainment', 'other'
        ];
    }
    
    // Initialize OpenAI client
    initializeOpenAI() {
        try {
            if (process.env.OPENAI_API_KEY) {
                this.openai = new OpenAI({
                    apiKey: process.env.OPENAI_API_KEY,
                });
                this.isConfigured = true;
                console.log('OpenAI service initialized');
            } else {
                console.warn('OPENAI_API_KEY not configured - AI features will use fallback methods');
                this.openai = null;
            }
        } catch (error) {
            console.error('Failed to initialize OpenAI service:', error);
            this.openai = null;
        }
    }
    
    // Suggest expense category based on description
    async suggestCategory(description) {
        if (!this.openai) {
            return this.fallbackCategorySuggestion(description);
        }
        
        try {
            const prompt = `
Analyze the following expense description and suggest the most appropriate category from this list:
Categories: ${this.categories.join(', ')}

Expense description: "${description}"

Please respond in JSON format with:
{
    "category": "suggested_category",
    "confidence": confidence_score_0_to_1,
    "reasoning": "brief explanation"
}

Guidelines:
- "travel" for transportation, hotels, flights, car rentals
- "food" for meals, catering, team lunches, coffee
- "supplies" for office supplies, stationery, materials
- "software" for SaaS subscriptions, licenses, development tools
- "hardware" for computers, devices, equipment
- "training" for courses, conferences, professional development
- "entertainment" for team events, client entertainment
- "other" for anything that doesn't fit above categories
`;
            
            const completion = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are an AI assistant specialized in categorizing business expenses. Always respond with valid JSON."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 200,
                temperature: 0.3,
                response_format: { type: "json_object" }
            });
            
            const response = completion.choices?.[0]?.message?.content || "{}";
            let result;
            try {
                result = JSON.parse(response);
            } catch (e) {
                // Fallback: best-effort parse
                result = this.fallbackCategorySuggestion(description);
                result.reasoning = (result.reasoning || "") + " (AI returned non-JSON)";
                return result;
            }
            
            // Validate the category
            if (!this.categories.includes(result.category)) {
                result.category = 'other';
                result.confidence = Math.max(0.1, result.confidence - 0.3);
                result.reasoning += ' (Category corrected to "other")';
            }
            
            // Ensure confidence is within bounds
            result.confidence = Math.max(0, Math.min(1, result.confidence));
            
            console.log(`AI category suggestion for "${description}": ${result.category} (${result.confidence})`);
            return result;
            
        } catch (error) {
            console.error('OpenAI category suggestion failed:', error);
            return this.fallbackCategorySuggestion(description);
        }
    }
    
    // Fallback category suggestion using keyword matching
    fallbackCategorySuggestion(description) {
        const desc = description.toLowerCase();
        
        const categoryKeywords = {
            travel: ['flight', 'hotel', 'uber', 'taxi', 'gas', 'mileage', 'rental', 'airbnb', 'trip', 'travel'],
            food: ['restaurant', 'lunch', 'dinner', 'coffee', 'meal', 'catering', 'starbucks', 'food', 'eat'],
            supplies: ['paper', 'pen', 'office', 'supplies', 'stationery', 'printer', 'ink', 'materials'],
            software: ['subscription', 'license', 'saas', 'software', 'app', 'service', 'tool', 'platform'],
            hardware: ['computer', 'laptop', 'mouse', 'keyboard', 'monitor', 'device', 'equipment', 'hardware'],
            training: ['training', 'course', 'conference', 'workshop', 'certification', 'learning', 'education'],
            entertainment: ['entertainment', 'client', 'team building', 'event', 'party', 'celebration']
        };
        
        let bestMatch = { category: 'other', confidence: 0.1, reasoning: 'No clear keywords found' };
        
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            const matches = keywords.filter(keyword => desc.includes(keyword));
            if (matches.length > 0) {
                const confidence = Math.min(0.8, 0.3 + (matches.length * 0.2));
                if (confidence > bestMatch.confidence) {
                    bestMatch = {
                        category,
                        confidence,
                        reasoning: `Matched keywords: ${matches.join(', ')}`
                    };
                }
            }
        }
        
        console.log(`Fallback category suggestion for "${description}": ${bestMatch.category}`);
        return bestMatch;
    }
    
    // Generate spending insights for a team
    async generateSpendingInsights(teamId, period = 'month') {
        if (!this.openai) {
            return this.fallbackSpendingInsights(teamId, period);
        }
        
        try {
            // Get team's expense data
            const expenseData = await this.getTeamExpenseData(teamId, period);
            
            if (!expenseData || expenseData.totalExpenses === 0) {
                return {
                    insights: ['No expenses found for the selected period.'],
                    recommendations: ['Start tracking expenses to get insights.'],
                    confidence: 0.1
                };
            }
            
            const prompt = `
Analyze the following team spending data and provide insights and recommendations:

Team Spending Summary (${period}):
- Total Expenses: $${expenseData.totalAmount}
- Number of Transactions: ${expenseData.totalExpenses}
- Average Transaction: $${expenseData.avgAmount}
- Budget Utilization: ${expenseData.budgetUtilization}%
- Team Budget: $${expenseData.budget}

Category Breakdown:
${expenseData.categoryBreakdown.map(cat => `- ${cat.category}: $${cat.amount} (${cat.count} transactions)`).join('\n')}

Spending Trend: ${expenseData.trend}

Please provide:
1. Key insights about spending patterns
2. Potential areas of concern
3. Actionable recommendations
4. Budget optimization suggestions

Respond in JSON format:
{
    "insights": ["insight1", "insight2", ...],
    "recommendations": ["recommendation1", "recommendation2", ...],
    "concerns": ["concern1", "concern2", ...],
    "confidence": confidence_score_0_to_1
}
`;
            
            const completion = await this.openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a financial analyst AI specialized in business expense analysis. Provide practical, actionable insights."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 500,
                temperature: 0.4,
                response_format: { type: "json_object" }
            });
            
            const response = completion.choices?.[0]?.message?.content || "{}";
            let result;
            try {
                result = JSON.parse(response);
            } catch (e) {
                return this.fallbackSpendingInsights(teamId, period);
            }
            
            // Add metadata
            result.generatedAt = new Date();
            result.period = period;
            result.teamId = teamId;
            result.dataSource = 'openai';
            
            console.log(`AI insights generated for team ${teamId}`);
            return result;
            
        } catch (error) {
            console.error('OpenAI insights generation failed:', error);
            return this.fallbackSpendingInsights(teamId, period);
        }
    }
    
    // Get team expense data for analysis
    async getTeamExpenseData(teamId, period) {
        try {
            const Team = require('../models/Team');
            const team = await Team.findById(teamId);
            
            if (!team) return null;
            
            // Get date range for the period
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
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
            
            // Get expenses for the period
            const expenses = await Expense.find({
                team: teamId,
                date: { $gte: startDate },
                status: 'approved',
                isActive: true
            });
            
            if (expenses.length === 0) {
                return {
                    totalExpenses: 0,
                    totalAmount: 0,
                    avgAmount: 0,
                    budget: team.budget,
                    budgetUtilization: team.budgetUtilization,
                    categoryBreakdown: [],
                    trend: 'no_data'
                };
            }
            
            // Calculate totals
            const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0);
            const avgAmount = totalAmount / expenses.length;
            
            // Category breakdown
            const categoryBreakdown = {};
            expenses.forEach(expense => {
                const cat = expense.category;
                if (!categoryBreakdown[cat]) {
                    categoryBreakdown[cat] = { amount: 0, count: 0 };
                }
                categoryBreakdown[cat].amount += expense.amount;
                categoryBreakdown[cat].count += 1;
            });
            
            const categoryArray = Object.entries(categoryBreakdown)
                .map(([category, data]) => ({
                    category,
                    amount: data.amount,
                    count: data.count
                }))
                .sort((a, b) => b.amount - a.amount);
            
            // Simple trend analysis
            const midPoint = Math.floor(expenses.length / 2);
            const firstHalf = expenses.slice(0, midPoint);
            const secondHalf = expenses.slice(midPoint);
            
            const firstHalfAvg = firstHalf.reduce((sum, exp) => sum + exp.amount, 0) / Math.max(firstHalf.length, 1);
            const secondHalfAvg = secondHalf.reduce((sum, exp) => sum + exp.amount, 0) / Math.max(secondHalf.length, 1);
            
            let trend = 'stable';
            if (secondHalfAvg > firstHalfAvg * 1.2) trend = 'increasing';
            else if (secondHalfAvg < firstHalfAvg * 0.8) trend = 'decreasing';
            
            return {
                totalExpenses: expenses.length,
                totalAmount,
                avgAmount: Math.round(avgAmount * 100) / 100,
                budget: team.budget,
                budgetUtilization: team.budgetUtilization,
                categoryBreakdown: categoryArray,
                trend
            };
            
        } catch (error) {
            console.error('Error getting team expense data:', error);
            return null;
        }
    }
    
    // Fallback spending insights using basic analysis
    fallbackSpendingInsights(teamId, period) {
        return {
            insights: [
                'AI analysis temporarily unavailable',
                'Using basic expense categorization',
                'Review top spending categories for optimization opportunities'
            ],
            recommendations: [
                'Monitor high-value expense categories',
                'Implement expense approval workflows for large amounts',
                'Regular budget vs actual reviews recommended'
            ],
            concerns: [
                'Limited AI analysis available - consider enabling OpenAI integration'
            ],
            confidence: 0.3,
            generatedAt: new Date(),
            period: period,
            teamId: teamId,
            dataSource: 'fallback'
        };
    }
    
    // Detect potentially duplicate or suspicious expenses
    async detectSuspiciousExpenses(teamId, lookbackDays = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
            
            const expenses = await Expense.find({
                team: teamId,
                date: { $gte: cutoffDate },
                isActive: true
            }).sort({ date: -1 });
            
            const suspicious = [];
            
            // Check for duplicates
            for (let i = 0; i < expenses.length; i++) {
                for (let j = i + 1; j < expenses.length; j++) {
                    const exp1 = expenses[i];
                    const exp2 = expenses[j];
                    
                    // Same amount and similar descriptions within short time frame
                    if (Math.abs(exp1.amount - exp2.amount) < 0.01) {
                        const timeDiff = Math.abs(exp1.date - exp2.date) / (1000 * 60 * 60 * 24);
                        const descSimilarity = this.calculateTextSimilarity(
                            exp1.description.toLowerCase(),
                            exp2.description.toLowerCase()
                        );
                        
                        if (timeDiff <= 7 && descSimilarity > 0.7) {
                            suspicious.push({
                                type: 'potential_duplicate',
                                expenses: [exp1._id, exp2._id],
                                reason: `Similar amount ($${exp1.amount}) and description within ${Math.round(timeDiff)} days`,
                                confidence: descSimilarity
                            });
                        }
                    }
                }
            }
            
            // Check for unusually high amounts
            if (expenses.length > 5) {
                const amounts = expenses.map(e => e.amount).sort((a, b) => a - b);
                const q3 = amounts[Math.floor(amounts.length * 0.75)];
                const q1 = amounts[Math.floor(amounts.length * 0.25)];
                const iqr = q3 - q1;
                const outlierThreshold = q3 + (1.5 * iqr);
                
                expenses.forEach(expense => {
                    if (expense.amount > outlierThreshold) {
                        suspicious.push({
                            type: 'high_amount_outlier',
                            expenses: [expense._id],
                            reason: `Amount ($${expense.amount}) is significantly higher than typical expenses`,
                            confidence: 0.7
                        });
                    }
                });
            }
            
            return {
                teamId,
                lookbackDays,
                totalExpensesChecked: expenses.length,
                suspiciousCount: suspicious.length,
                suspicious: suspicious.slice(0, 10), // Limit to top 10
                generatedAt: new Date()
            };
            
        } catch (error) {
            console.error('Error detecting suspicious expenses:', error);
            return {
                error: error.message,
                teamId,
                lookbackDays,
                suspiciousCount: 0,
                suspicious: []
            };
        }
    }
    
    // Calculate text similarity (Levenshtein distance based)
    calculateTextSimilarity(str1, str2) {
        const matrix = [];
        const n = str2.length;
        const m = str1.length;
        
        if (n === 0) return m === 0 ? 1 : 0;
        if (m === 0) return 0;
        
        for (let i = 0; i <= n; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= m; j++) {
            matrix[0][j] = j;
        }
        
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
    
    // Test AI service connectivity
    async testConnection() {
        if (!this.openai) {
            return {
                success: false,
                message: 'OpenAI client not initialized',
                fallbackAvailable: true
            };
        }
        
        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "user",
                        content: "Respond with just 'OK' if you can hear me."
                    }
                ],
                max_tokens: 10
            });
            
            return {
                success: true,
                message: 'OpenAI service is working',
                response: completion.choices[0].message.content,
                model: completion.model
            };
            
        } catch (error) {
            return {
                success: false,
                message: 'OpenAI service test failed',
                error: error.message,
                fallbackAvailable: true
            };
        }
    }
}

module.exports = new AIService();