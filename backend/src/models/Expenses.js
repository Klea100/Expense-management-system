const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    team: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Team',
        required: [true, 'Team is required'],
        index: true
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0.01, 'Amount must be greater than 0']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: [500, 'Description cannot be more than 500 characters']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: {
            values: ['travel', 'food', 'supplies', 'software', 'hardware', 'training', 'entertainment', 'other'],
            message: '{VALUE} is not a valid category'
        },
        index: true
    },
    subcategory: {
        type: String,
        trim: true,
        maxlength: [100, 'Subcategory cannot be more than 100 characters']
    },
    date: {
        type: Date,
        required: [true, 'Expense date is required'],
        default: Date.now,
        index: true
    },
    submittedBy: {
        name: {
            type: String,
            required: [true, 'Submitter name is required'],
            trim: true
        },
        email: {
            type: String,
            required: [true, 'Submitter email is required'],
            lowercase: true,
            trim: true
        }
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    approvedBy: {
        name: String,
        email: String,
        date: Date
    },
    rejectionReason: {
        type: String,
        trim: true,
        maxlength: [300, 'Rejection reason cannot be more than 300 characters']
    },
    receipt: {
        filename: String,
        originalName: String,
        mimetype: String,
        size: Number,
        path: String
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    aiInsights: {
        suggestedCategory: String,
        confidence: Number,
        duplicateCheck: {
            isDuplicate: {
                type: Boolean,
                default: false
            },
            similarExpenses: [{
                expenseId: mongoose.Schema.Types.ObjectId,
                similarity: Number
            }]
        },
        analysisDate: Date
    },
    currency: {
        type: String,
        default: 'USD',
        enum: ['USD', 'EUR', 'GBP', 'CAD']
    },
    exchangeRate: {
        type: Number,
        default: 1
    },
    originalAmount: Number,
    originalCurrency: String,
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurringSchedule: {
        frequency: {
            type: String,
            enum: ['monthly', 'quarterly', 'yearly']
        },
        nextDate: Date,
        endDate: Date
    },
    isActive: {
        type: Boolean,
        default: true
    },
    notes: [{
        text: {
            type: String,
            required: true,
            trim: true
        },
        author: {
            name: String,
            email: String
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for formatted amount
expenseSchema.virtual('formattedAmount').get(function() {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: this.currency || 'USD'
    }).format(this.amount);
});

// Virtual for days since submission
expenseSchema.virtual('daysSinceSubmission').get(function() {
    const now = new Date();
    const diffTime = Math.abs(now - this.createdAt);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for expense age category
expenseSchema.virtual('ageCategory').get(function() {
    const days = this.daysSinceSubmission;
    if (days <= 7) return 'recent';
    if (days <= 30) return 'moderate';
    return 'old';
});

// Compound indexes for efficient queries
expenseSchema.index({ team: 1, status: 1 });
expenseSchema.index({ team: 1, date: -1 });
expenseSchema.index({ team: 1, category: 1 });
expenseSchema.index({ 'submittedBy.email': 1, date: -1 });
expenseSchema.index({ status: 1, createdAt: -1 });
expenseSchema.index({ date: -1, amount: -1 });

// Text search index for descriptions and categories
expenseSchema.index({
    description: 'text',
    category: 'text',
    'submittedBy.name': 'text'
});

// Pre-save middleware
expenseSchema.pre('save', function(next) {
    // Set original amount and currency if not set
    if (!this.originalAmount) {
        this.originalAmount = this.amount;
        this.originalCurrency = this.currency;
    }
    
    // Ensure tags are unique and lowercase
    if (this.tags && this.tags.length > 0) {
        this.tags = [...new Set(this.tags.map(tag => tag.toLowerCase()))];
    }
    
    next();
});

// Post-save middleware to update team's total spent
expenseSchema.post('save', async function(doc) {
    if (doc.status === 'approved' && doc.isActive) {
        const Team = mongoose.model('Team');
        const team = await Team.findById(doc.team);
        if (team) {
            await team.updateTotalSpent();
        }
    }
});

// Post-remove middleware to update team's total spent
expenseSchema.post('remove', async function(doc) {
    const Team = mongoose.model('Team');
    const team = await Team.findById(doc.team);
    if (team) {
        await team.updateTotalSpent();
    }
});

// Instance methods
expenseSchema.methods.approve = function(approver) {
    this.status = 'approved';
    this.approvedBy = {
        name: approver.name,
        email: approver.email,
        date: new Date()
    };
    return this.save();
};

expenseSchema.methods.reject = function(rejector, reason) {
    this.status = 'rejected';
    this.rejectionReason = reason;
    this.approvedBy = {
        name: rejector.name,
        email: rejector.email,
        date: new Date()
    };
    return this.save();
};

expenseSchema.methods.addNote = function(noteText, author) {
    this.notes.push({
        text: noteText,
        author: author
    });
    return this.save();
};

// Static methods
expenseSchema.statics.getTeamExpenses = function(teamId, filters = {}) {
    const query = { team: teamId, isActive: true };
    
    if (filters.status) query.status = filters.status;
    if (filters.category) query.category = filters.category;
    if (filters.dateFrom || filters.dateTo) {
        query.date = {};
        if (filters.dateFrom) query.date.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.date.$lte = new Date(filters.dateTo);
    }
    if (filters.amountMin || filters.amountMax) {
        query.amount = {};
        if (filters.amountMin) query.amount.$gte = filters.amountMin;
        if (filters.amountMax) query.amount.$lte = filters.amountMax;
    }
    
    return this.find(query)
        .populate('team', 'name budget')
        .sort({ date: -1, createdAt: -1 });
};

expenseSchema.statics.getExpensesByDateRange = function(teamId, startDate, endDate) {
    return this.find({
        team: teamId,
        date: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        },
        status: 'approved',
        isActive: true
    }).sort({ date: -1 });
};

expenseSchema.statics.getExpenseAnalytics = async function(teamId, period = 'month') {
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
    
    return this.aggregate([
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
                _id: '$category',
                totalAmount: { $sum: '$amount' },
                count: { $sum: 1 },
                avgAmount: { $avg: '$amount' }
            }
        },
        {
            $sort: { totalAmount: -1 }
        }
    ]);
};

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;
