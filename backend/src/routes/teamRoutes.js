const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Team = require('../models/Team');
const Expense = require('../models/Expenses');
const teamService = require('../services/teamService');

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

// GET /api/v1/teams - Get all teams with optional filtering
router.get('/', [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['good', 'warning', 'over-budget']),
    query('search').optional().isString().trim()
], handleValidationErrors, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const search = req.query.search;

        const result = await teamService.getTeams({
            page,
            limit,
            status,
            search
        });

        res.status(200).json({
            success: true,
            message: 'Teams retrieved successfully',
            data: result.teams,
            pagination: {
                currentPage: page,
                totalPages: result.totalPages,
                totalItems: result.totalItems,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        console.error('Error fetching teams:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching teams',
            error: error.message
        });
    }
});

// GET /api/v1/teams/:id - Get specific team with expenses
router.get('/:id', [
    param('id').isMongoId().withMessage('Invalid team ID')
], handleValidationErrors, async (req, res) => {
    try {
        const team = await teamService.getTeamById(req.params.id);
        
        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Team retrieved successfully',
            data: team
        });
    } catch (error) {
        console.error('Error fetching team:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching team',
            error: error.message
        });
    }
});

// POST /api/v1/teams - Create new team
router.post('/', [
    body('name')
        .notEmpty()
        .withMessage('Team name is required')
        .isLength({ max: 100 })
        .withMessage('Team name must be less than 100 characters')
        .trim(),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters')
        .trim(),
    body('budget')
        .isNumeric()
        .withMessage('Budget must be a number')
        .custom((value) => {
            if (value <= 0) {
                throw new Error('Budget must be greater than 0');
            }
            return true;
        }),
    body('currency')
        .optional()
        .isIn(['USD', 'EUR', 'GBP', 'CAD'])
        .withMessage('Invalid currency'),
    body('members')
        .optional()
        .isArray()
        .withMessage('Members must be an array'),
    body('members.*.name')
        .if(body('members').exists())
        .notEmpty()
        .withMessage('Member name is required')
        .trim(),
    body('members.*.email')
        .if(body('members').exists())
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
    body('members.*.role')
        .if(body('members').exists())
        .optional()
        .isIn(['manager', 'member'])
        .withMessage('Invalid member role'),
    body('createdBy')
        .notEmpty()
        .withMessage('Created by is required')
        .trim()
], handleValidationErrors, async (req, res) => {
    try {
        const team = await teamService.createTeam(req.body);

        res.status(201).json({
            success: true,
            message: 'Team created successfully',
            data: team
        });
    } catch (error) {
        console.error('Error creating team:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Team name already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error creating team',
            error: error.message
        });
    }
});

// PUT /api/v1/teams/:id - Update team
router.put('/:id', [
    param('id').isMongoId().withMessage('Invalid team ID'),
    body('name')
        .optional()
        .notEmpty()
        .withMessage('Team name cannot be empty')
        .isLength({ max: 100 })
        .withMessage('Team name must be less than 100 characters')
        .trim(),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must be less than 500 characters')
        .trim(),
    body('budget')
        .optional()
        .isNumeric()
        .withMessage('Budget must be a number')
        .custom((value) => {
            if (value <= 0) {
                throw new Error('Budget must be greater than 0');
            }
            return true;
        }),
    body('currency')
        .optional()
        .isIn(['USD', 'EUR', 'GBP', 'CAD'])
        .withMessage('Invalid currency')
], handleValidationErrors, async (req, res) => {
    try {
        const team = await teamService.updateTeam(req.params.id, req.body);

        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Team updated successfully',
            data: team
        });
    } catch (error) {
        console.error('Error updating team:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Team name already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error updating team',
            error: error.message
        });
    }
});

// DELETE /api/v1/teams/:id - Soft delete team
router.delete('/:id', [
    param('id').isMongoId().withMessage('Invalid team ID')
], handleValidationErrors, async (req, res) => {
    try {
        const team = await teamService.deleteTeam(req.params.id);

        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Team deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting team:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting team',
            error: error.message
        });
    }
});

// POST /api/v1/teams/:id/members - Add member to team
router.post('/:id/members', [
    param('id').isMongoId().withMessage('Invalid team ID'),
    body('name')
        .notEmpty()
        .withMessage('Member name is required')
        .trim(),
    body('email')
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
    body('role')
        .optional()
        .isIn(['manager', 'member'])
        .withMessage('Invalid member role')
], handleValidationErrors, async (req, res) => {
    try {
        const team = await teamService.addTeamMember(req.params.id, req.body);

        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Member added successfully',
            data: team
        });
    } catch (error) {
        console.error('Error adding team member:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding team member',
            error: error.message
        });
    }
});

// DELETE /api/v1/teams/:id/members/:memberId - Remove member from team
router.delete('/:id/members/:memberId', [
    param('id').isMongoId().withMessage('Invalid team ID'),
    param('memberId').isMongoId().withMessage('Invalid member ID')
], handleValidationErrors, async (req, res) => {
    try {
        const team = await teamService.removeTeamMember(req.params.id, req.params.memberId);

        if (!team) {
            return res.status(404).json({
                success: false,
                message: 'Team not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Member removed successfully',
            data: team
        });
    } catch (error) {
        console.error('Error removing team member:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing team member',
            error: error.message
        });
    }
});

// GET /api/v1/teams/:id/expenses - Get team expenses
router.get('/:id/expenses', [
    param('id').isMongoId().withMessage('Invalid team ID'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['pending', 'approved', 'rejected']),
    query('category').optional().isString(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601()
], handleValidationErrors, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        const filters = {
            status: req.query.status,
            category: req.query.category,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo
        };

        const result = await teamService.getTeamExpenses(req.params.id, filters, page, limit);

        res.status(200).json({
            success: true,
            message: 'Team expenses retrieved successfully',
            data: result.expenses,
            pagination: {
                currentPage: page,
                totalPages: result.totalPages,
                totalItems: result.totalItems,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        console.error('Error fetching team expenses:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching team expenses',
            error: error.message
        });
    }
});

// GET /api/v1/teams/:id/analytics - Get team spending analytics
router.get('/:id/analytics', [
    param('id').isMongoId().withMessage('Invalid team ID'),
    query('period').optional().isIn(['week', 'month', 'quarter', 'year'])
], handleValidationErrors, async (req, res) => {
    try {
        const period = req.query.period || 'month';
        const analytics = await teamService.getTeamAnalytics(req.params.id, period);

        res.status(200).json({
            success: true,
            message: 'Team analytics retrieved successfully',
            data: analytics
        });
    } catch (error) {
        console.error('Error fetching team analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching team analytics',
            error: error.message
        });
    }
});

module.exports = router;
