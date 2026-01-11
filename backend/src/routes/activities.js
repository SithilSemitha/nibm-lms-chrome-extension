const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Validation middleware
const activityValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('type').isIn(['assignment', 'quiz', 'exam', 'project', 'reading', 'other']).withMessage('Invalid activity type'),
  body('deadline').isISO8601().withMessage('Invalid deadline format'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority')
];

// Get all activities for user
router.get('/', async (req, res) => {
  try {
    const { status, type, priority, from_date, to_date } = req.query;
    
    let queryText = 'SELECT * FROM activities WHERE user_id = $1';
    const queryParams = [req.user.id];
    let paramCount = 1;
    
    // Add filters
    if (status) {
      paramCount++;
      queryText += ` AND status = $${paramCount}`;
      queryParams.push(status);
    }
    
    if (type) {
      paramCount++;
      queryText += ` AND type = $${paramCount}`;
      queryParams.push(type);
    }
    
    if (priority) {
      paramCount++;
      queryText += ` AND priority = $${paramCount}`;
      queryParams.push(priority);
    }
    
    if (from_date) {
      paramCount++;
      queryText += ` AND deadline >= $${paramCount}`;
      queryParams.push(from_date);
    }
    
    if (to_date) {
      paramCount++;
      queryText += ` AND deadline <= $${paramCount}`;
      queryParams.push(to_date);
    }
    
    queryText += ' ORDER BY deadline ASC';
    
    const result = await query(queryText, queryParams);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities'
    });
  }
});

// Get single activity
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'SELECT * FROM activities WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity'
    });
  }
});

// Create new activity
router.post('/', activityValidation, async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }
    
    const {
      title,
      type,
      deadline,
      description,
      priority = 'medium',
      status = 'pending',
      url,
      source
    } = req.body;
    
    const result = await query(
      `INSERT INTO activities 
       (user_id, title, type, deadline, description, priority, status, url, source, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) 
       RETURNING *`,
      [req.user.id, title, type, deadline, description, priority, status, url, source]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create activity'
    });
  }
});

// Update activity
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      type,
      deadline,
      description,
      priority,
      status,
      url
    } = req.body;
    
    // Check if activity exists and belongs to user
    const existing = await query(
      'SELECT id FROM activities WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 0;
    
    if (title !== undefined) {
      paramCount++;
      updates.push(`title = $${paramCount}`);
      values.push(title);
    }
    
    if (type !== undefined) {
      paramCount++;
      updates.push(`type = $${paramCount}`);
      values.push(type);
    }
    
    if (deadline !== undefined) {
      paramCount++;
      updates.push(`deadline = $${paramCount}`);
      values.push(deadline);
    }
    
    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(description);
    }
    
    if (priority !== undefined) {
      paramCount++;
      updates.push(`priority = $${paramCount}`);
      values.push(priority);
    }
    
    if (status !== undefined) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      values.push(status);
      
      // If marking as completed, set completed_at
      if (status === 'completed') {
        paramCount++;
        updates.push(`completed_at = $${paramCount}`);
        values.push(new Date());
      }
    }
    
    if (url !== undefined) {
      paramCount++;
      updates.push(`url = $${paramCount}`);
      values.push(url);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    paramCount++;
    updates.push(`updated_at = $${paramCount}`);
    values.push(new Date());
    
    paramCount++;
    values.push(id);
    paramCount++;
    values.push(req.user.id);
    
    const updateQuery = `
      UPDATE activities 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount - 1} AND user_id = $${paramCount}
      RETURNING *
    `;
    
    const result = await query(updateQuery, values);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update activity'
    });
  }
});

// Delete activity
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM activities WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete activity'
    });
  }
});

// Bulk update activities
router.patch('/bulk', async (req, res) => {
  try {
    const { ids, updates } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid activity IDs'
      });
    }
    
    // Build update query
    const updateFields = [];
    const values = [];
    let paramCount = 0;
    
    if (updates.status) {
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      values.push(updates.status);
    }
    
    if (updates.priority) {
      paramCount++;
      updateFields.push(`priority = $${paramCount}`);
      values.push(updates.priority);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }
    
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    values.push(new Date());
    
    // Add ids and user_id to values
    paramCount++;
    values.push(ids);
    paramCount++;
    values.push(req.user.id);
    
    const updateQuery = `
      UPDATE activities 
      SET ${updateFields.join(', ')} 
      WHERE id = ANY($${paramCount - 1}::int[]) AND user_id = $${paramCount}
      RETURNING *
    `;
    
    const result = await query(updateQuery, values);
    
    res.json({
      success: true,
      updated: result.rows.length,
      activities: result.rows
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update activities'
    });
  }
});

module.exports = router;
