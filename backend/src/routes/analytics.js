const express = require('express');
const { query } = require('../../config/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get activity statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get overall stats
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_activities,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN deadline < NOW() AND status = 'pending' THEN 1 END) as overdue_count,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_count,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority_count,
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority_count
      FROM activities 
      WHERE user_id = $1
    `, [userId]);
    
    // Get completion rate by type
    const typeStatsResult = await query(`
      SELECT 
        type,
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        ROUND(
          COUNT(CASE WHEN status = 'completed' THEN 1 END)::numeric / 
          NULLIF(COUNT(*), 0) * 100, 
          2
        ) as completion_rate
      FROM activities 
      WHERE user_id = $1
      GROUP BY type
      ORDER BY total DESC
    `, [userId]);
    
    // Get activities by month (last 6 months)
    const monthlyStatsResult = await query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as created,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM activities 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC
    `, [userId]);
    
    // Get upcoming deadlines (next 7 days)
    const upcomingResult = await query(`
      SELECT 
        DATE(deadline) as date,
        COUNT(*) as count
      FROM activities 
      WHERE user_id = $1 
        AND status = 'pending'
        AND deadline >= NOW()
        AND deadline < NOW() + INTERVAL '7 days'
      GROUP BY DATE(deadline)
      ORDER BY date ASC
    `, [userId]);
    
    res.json({
      overview: statsResult.rows[0],
      by_type: typeStatsResult.rows,
      by_month: monthlyStatsResult.rows,
      upcoming: upcomingResult.rows
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

// Get completion trends
router.get('/trends', async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = '30' } = req.query; // days
    
    const trendsResult = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as activities_created,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as activities_completed
      FROM activities 
      WHERE user_id = $1 
        AND created_at >= NOW() - INTERVAL '${parseInt(period)} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [userId]);
    
    res.json(trendsResult.rows);
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trends'
    });
  }
});

// Get productivity insights
router.get('/insights', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Average time to complete activities
    const avgCompletionResult = await query(`
      SELECT 
        type,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600) as avg_hours_to_complete,
        COUNT(*) as completed_count
      FROM activities 
      WHERE user_id = $1 
        AND status = 'completed'
        AND completed_at IS NOT NULL
      GROUP BY type
    `, [userId]);
    
    // Most productive time of day
    const timeOfDayResult = await query(`
      SELECT 
        EXTRACT(HOUR FROM completed_at) as hour,
        COUNT(*) as completions
      FROM activities 
      WHERE user_id = $1 
        AND status = 'completed'
        AND completed_at IS NOT NULL
      GROUP BY EXTRACT(HOUR FROM completed_at)
      ORDER BY completions DESC
      LIMIT 5
    `, [userId]);
    
    // Activity patterns by day of week
    const dayOfWeekResult = await query(`
      SELECT 
        TO_CHAR(created_at, 'Day') as day_of_week,
        COUNT(*) as activities_created,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as activities_completed
      FROM activities 
      WHERE user_id = $1
      GROUP BY TO_CHAR(created_at, 'Day'), EXTRACT(DOW FROM created_at)
      ORDER BY EXTRACT(DOW FROM created_at)
    `, [userId]);
    
    // Overdue analysis
    const overdueResult = await query(`
      SELECT 
        COUNT(*) as overdue_count,
        AVG(EXTRACT(EPOCH FROM (NOW() - deadline)) / 86400) as avg_days_overdue
      FROM activities 
      WHERE user_id = $1 
        AND status = 'pending'
        AND deadline < NOW()
    `, [userId]);
    
    res.json({
      completion_time: avgCompletionResult.rows,
      productive_hours: timeOfDayResult.rows,
      weekly_pattern: dayOfWeekResult.rows,
      overdue_analysis: overdueResult.rows[0]
    });
  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch insights'
    });
  }
});

// Get leaderboard (if collaborative feature needed)
router.get('/leaderboard', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    
    const leaderboardResult = await query(`
      SELECT 
        u.name,
        COUNT(a.id) as activities_completed,
        AVG(EXTRACT(EPOCH FROM (a.completed_at - a.created_at)) / 3600) as avg_completion_hours
      FROM users u
      JOIN activities a ON u.id = a.user_id
      WHERE a.status = 'completed'
        AND a.completed_at >= NOW() - INTERVAL '${parseInt(period)} days'
      GROUP BY u.id, u.name
      ORDER BY activities_completed DESC
      LIMIT 10
    `);
    
    res.json(leaderboardResult.rows);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard'
    });
  }
});

module.exports = router;
