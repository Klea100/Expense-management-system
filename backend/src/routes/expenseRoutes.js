const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const Expense = require('../models/Expenses');
const expenseService = require('../services/expenseService');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only JPEG, JPG, PNG, and PDF files are allowed'));
        }
    }
});

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

// GET /api/v1/expenses - Get all expenses with filtering
router.get('/', [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
    query('category').optional().isString(),
    query('team').optional().isMongoId(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
    query('search').optional().isString().trim()
], handleValidationErrors, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        const filters = {
            status: req.query.status,
            category: req.query.category,
            team: req.query.team,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
            search: req.query.search
        };

        const result = await expenseService.getExpenses(filters, page, limit);

        res.status(200).json({
            success: true,
            message: 'Expenses retrieved successfully',
            data: result.expenses,
            pagination: {
                currentPage: page,
                totalPages: result.totalPages,
                totalItems: result.totalItems,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching expenses',
            error: error.message
        });
    }
});

// GET /api/v1/expenses/:id - Get specific expense
router.get('/:id', [
    param('id').isMongoId().withMessage('Invalid expense ID')
], handleValidationErrors, async (req, res) => {
    try {
        const expense = await expenseService.getExpenseById(req.params.id);
        
        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Expense retrieved successfully',
            data: expense
        });
    } catch (error) {
        console.error('Error fetching expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching expense',
            error: error.message
        });
    }
});

// Middleware to parse JSON strings in form data
const parseFormJSON = (req, res, next) => {
    if (req.body.submittedBy && typeof req.body.submittedBy === 'string') {
        try {
            req.body.submittedBy = JSON.parse(req.body.submittedBy);
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Invalid JSON format for submittedBy field'
            });
        }
    }
    next();
};

// POST /api/v1/expenses - Create new expense
router.post('/', upload.single('receipt'), parseFormJSON, [
    body('team')
        .isMongoId()
        .withMessage('Valid team ID is required'),
    body('amount')
        .isNumeric()
        .withMessage('Amount must be a number')
        .custom((value) => {
            if (value <= 0) {
                throw new Error('Amount must be greater than 0');
            }
            return true;
        }),
    body('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters')
        .trim(),
    body('category')
        .isIn(['travel', 'food', 'supplies', 'software', 'hardware', 'training', 'entertainment', 'other'])
        .withMessage('Invalid category'),
    body('date')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format'),
    body('submittedBy.name')
        .notEmpty()
        .withMessage('Submitter name is required')
        .trim(),
    body('submittedBy.email')
        .isEmail()
        .withMessage('Valid submitter email is required')
        .normalizeEmail(),
    body('currency')
        .optional()
        .isIn(['USD', 'EUR', 'GBP', 'CAD'])
        .withMessage('Invalid currency'),
    body('tags')
        .optional()
        .isArray()
        .withMessage('Tags must be an array')
], handleValidationErrors, async (req, res) => {
    try {
        const expenseData = req.body;
        
        // Add receipt file info if uploaded
        if (req.file) {
            expenseData.receipt = {
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                path: req.file.path
            };
        }

        const expense = await expenseService.createExpense(expenseData);

        res.status(201).json({
            success: true,
            message: 'Expense created successfully',
            data: expense
        });
    } catch (error) {
        console.error('Error creating expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating expense',
            error: error.message
        });
    }
});

// PUT /api/v1/expenses/:id - Update expense
router.put('/:id', upload.single('receipt'), [
    param('id').isMongoId().withMessage('Invalid expense ID'),
    body('amount')
        .optional()
        .isNumeric()
        .withMessage('Amount must be a number')
        .custom((value) => {
            if (value <= 0) {
                throw new Error('Amount must be greater than 0');
            }
            return true;
        }),
    body('description')
        .optional()
        .notEmpty()
        .withMessage('Description cannot be empty')
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters')
        .trim(),
    body('category')
        .optional()
        .isIn(['travel', 'food', 'supplies', 'software', 'hardware', 'training', 'entertainment', 'other'])
        .withMessage('Invalid category'),
    body('date')
        .optional()
        .isISO8601()
        .withMessage('Invalid date format'),
    body('currency')
        .optional()
        .isIn(['USD', 'EUR', 'GBP', 'CAD'])
        .withMessage('Invalid currency')
], handleValidationErrors, async (req, res) => {
    try {
        const updateData = req.body;
        
        // Add receipt file info if uploaded
        if (req.file) {
            updateData.receipt = {
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                path: req.file.path
            };
        }

        const expense = await expenseService.updateExpense(req.params.id, updateData);

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Expense updated successfully',
            data: expense
        });
    } catch (error) {
        console.error('Error updating expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating expense',
            error: error.message
        });
    }
});

// DELETE /api/v1/expenses/:id - Soft delete expense
router.delete('/:id', [
    param('id').isMongoId().withMessage('Invalid expense ID')
], handleValidationErrors, async (req, res) => {
    try {
        const expense = await expenseService.deleteExpense(req.params.id);

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Expense deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting expense',
            error: error.message
        });
    }
});

// PUT /api/v1/expenses/:id/approve - Approve expense
router.put('/:id/approve', [
    param('id').isMongoId().withMessage('Invalid expense ID'),
    body('approver.name')
        .notEmpty()
        .withMessage('Approver name is required')
        .trim(),
    body('approver.email')
        .isEmail()
        .withMessage('Valid approver email is required')
        .normalizeEmail()
], handleValidationErrors, async (req, res) => {
    try {
        const expense = await expenseService.approveExpense(req.params.id, req.body.approver);

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Expense approved successfully',
            data: expense
        });
    } catch (error) {
        console.error('Error approving expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error approving expense',
            error: error.message
        });
    }
});

// PUT /api/v1/expenses/:id/reject - Reject expense
router.put('/:id/reject', [
    param('id').isMongoId().withMessage('Invalid expense ID'),
    body('rejector.name')
        .notEmpty()
        .withMessage('Rejector name is required')
        .trim(),
    body('rejector.email')
        .isEmail()
        .withMessage('Valid rejector email is required')
        .normalizeEmail(),
    body('reason')
        .notEmpty()
        .withMessage('Rejection reason is required')
        .isLength({ max: 300 })
        .withMessage('Rejection reason must be less than 300 characters')
        .trim()
], handleValidationErrors, async (req, res) => {
    try {
        const expense = await expenseService.rejectExpense(
            req.params.id, 
            req.body.rejector, 
            req.body.reason
        );

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Expense rejected successfully',
            data: expense
        });
    } catch (error) {
        console.error('Error rejecting expense:', error);
        res.status(500).json({
            success: false,
            message: 'Error rejecting expense',
            error: error.message
        });
    }
});

// POST /api/v1/expenses/:id/notes - Add note to expense
router.post('/:id/notes', [
    param('id').isMongoId().withMessage('Invalid expense ID'),
    body('text')
        .notEmpty()
        .withMessage('Note text is required')
        .trim(),
    body('author.name')
        .notEmpty()
        .withMessage('Author name is required')
        .trim(),
    body('author.email')
        .isEmail()
        .withMessage('Valid author email is required')
        .normalizeEmail()
], handleValidationErrors, async (req, res) => {
    try {
        const expense = await expenseService.addExpenseNote(
            req.params.id,
            req.body.text,
            req.body.author
        );

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Note added successfully',
            data: expense
        });
    } catch (error) {
        console.error('Error adding expense note:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding expense note',
            error: error.message
        });
    }
});

// POST /api/v1/expenses/:id/ai-categorize - Get AI category suggestion
router.post('/:id/ai-categorize', [
    param('id').isMongoId().withMessage('Invalid expense ID')
], handleValidationErrors, async (req, res) => {
    try {
        const result = await expenseService.getAICategorySuggestion(req.params.id);

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'AI category suggestion generated successfully',
            data: result
        });
    } catch (error) {
        console.error('Error getting AI category suggestion:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting AI category suggestion',
            error: error.message
        });
    }
});

// GET /api/v1/expenses/analytics/summary - Get expense analytics summary
router.get('/analytics/summary', [
    query('team').optional().isMongoId(),
    query('period').optional().isIn(['week', 'month', 'quarter', 'year']),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601()
], handleValidationErrors, async (req, res) => {
    try {
        const filters = {
            team: req.query.team,
            period: req.query.period || 'month',
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo
        };

        const analytics = await expenseService.getExpenseAnalytics(filters);

        res.status(200).json({
            success: true,
            message: 'Expense analytics retrieved successfully',
            data: analytics
        });
    } catch (error) {
        console.error('Error fetching expense analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching expense analytics',
            error: error.message
        });
    }
});

module.exports = router;
