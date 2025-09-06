const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8787;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'labpanic',
  user: process.env.DB_USER || 'labpanic_user',
  password: process.env.DB_PASSWORD || 'password',
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Database connected successfully');
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Helper functions
function generateShareSlug() {
    return Math.random().toString(36).substring(2, 8);
}

function getCurrentWeekKey() {
    const now = new Date();
    const year = now.getFullYear();
    const week = Math.ceil((now.getDate() + new Date(year, 0, 1).getDay()) / 7);
    return `${year}-W${week.toString().padStart(2, '0')}`;
}

function validatePlayerName(name) {
    if (!name || name.length < 1 || name.length > 12) {
        return false;
    }
    // Alphanumeric + space / _ / -
    return /^[a-zA-Z0-9\s_-]+$/.test(name);
}

// API Routes

// Health check
app.get('/api/health', async (req, res) => {
    try {
        // Test database connection
        const dbResult = await pool.query('SELECT COUNT(*) as session_count FROM sessions');
        const scoreResult = await pool.query('SELECT COUNT(*) as score_count FROM scores');
        
        res.json({ 
            status: 'ok',
            timestamp: new Date().toISOString(),
            sessions: parseInt(dbResult.rows[0].session_count),
            scores: parseInt(scoreResult.rows[0].score_count),
            environment: NODE_ENV
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// Version
app.get('/api/version', (req, res) => {
    res.json({ version: '1.0.0' });
});

// Start session
app.post('/api/sessions/start', async (req, res) => {
    const { platform } = req.body;
    
    if (!platform || !['mobile', 'desktop'].includes(platform)) {
        return res.status(400).json({
            error: {
                code: 'INVALID_PLATFORM',
                message: 'Platform must be mobile or desktop'
            }
        });
    }
    
    try {
        const sessionId = uuidv4();
        const startToken = Math.random().toString(36).substring(2, 15);
        const startedAt = new Date();
        const expiresAt = new Date(startedAt.getTime() + 2 * 60 * 60 * 1000); // 2 hours
        
        // Insert session into database
        const result = await pool.query(
            'INSERT INTO sessions (session_id, start_token, started_at, expires_at, platform) VALUES ($1, $2, $3, $4, $5) RETURNING session_id, start_token, started_at, expires_at',
            [sessionId, startToken, startedAt, expiresAt, platform]
        );
        
        const session = result.rows[0];
        
        res.json({
            session_id: session.session_id,
            start_token: session.start_token,
            started_at: session.started_at.toISOString(),
            expires_at: session.expires_at.toISOString()
        });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({
            error: {
                code: 'DATABASE_ERROR',
                message: 'Failed to create session'
            }
        });
    }
});

// Submit score
app.post('/api/scores', async (req, res) => {
    if (NODE_ENV === 'production') {
        console.log('Score submit request:', req.body);
    }
    const { session_id, start_token, player_name, score, platform } = req.body;
    
    // Validate required fields
    if (!session_id || !start_token || !player_name || score === undefined || !platform) {
        return res.status(400).json({
            error: {
                code: 'MISSING_FIELDS',
                message: 'All fields are required'
            }
        });
    }
    
    try {
        // Validate session in database
        const sessionResult = await pool.query(
            'SELECT * FROM sessions WHERE session_id = $1 AND start_token = $2 AND used = false',
            [session_id, start_token]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(401).json({
                error: {
                    code: 'INVALID_SESSION',
                    message: 'Invalid or expired session'
                }
            });
        }
        
        const session = sessionResult.rows[0];
        
        // Check if session is expired
        if (new Date() > new Date(session.expires_at)) {
            return res.status(401).json({
                error: {
                    code: 'SESSION_EXPIRED',
                    message: 'Session has expired'
                }
            });
        }
        
        // Validate player name
        if (!validatePlayerName(player_name)) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_NAME',
                    message: 'Player name must be 1-12 characters, alphanumeric + space/_/-'
                }
            });
        }
        
        // Validate score
        if (score < 0 || score > 1000000000) {
            return res.status(400).json({
                error: {
                    code: 'INVALID_SCORE',
                    message: 'Score must be between 0 and 1,000,000,000'
                }
            });
        }
        
        // Generate share slug
        const shareSlug = generateShareSlug();
        const weeklyKey = getCurrentWeekKey();
        
        // Start transaction
        await pool.query('BEGIN');
        
        // Mark session as used
        await pool.query(
            'UPDATE sessions SET used = true WHERE session_id = $1',
            [session_id]
        );
        
        // Insert score
        const scoreResult = await pool.query(
            'INSERT INTO scores (player_name, score, platform, session_id, weekly_key, share_slug) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, player_name, score, created_at, weekly_key, share_slug',
            [player_name, score, platform, session_id, weeklyKey, shareSlug]
        );
        
        await pool.query('COMMIT');
        
        const scoreEntry = scoreResult.rows[0];
        
        // Calculate ranks
        const weeklyRank = await calculateRank(score, 'weekly', weeklyKey);
        const alltimeRank = await calculateRank(score, 'alltime');
        
        // Generate share URL based on environment
        const baseUrl = NODE_ENV === 'production' 
            ? `https://${req.get('host')}` 
            : `http://localhost:${PORT}`;
        
        res.status(201).json({
            score_id: scoreEntry.id,
            player_name: scoreEntry.player_name,
            score: scoreEntry.score,
            weekly_rank: weeklyRank,
            alltime_rank: alltimeRank,
            weekly_key: scoreEntry.weekly_key,
            created_at: scoreEntry.created_at.toISOString(),
            share_url: `${baseUrl}/share/${shareSlug}`
        });
        
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error submitting score:', error);
        res.status(500).json({
            error: {
                code: 'DATABASE_ERROR',
                message: 'Failed to submit score'
            }
        });
    }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
    const { scope, limit = 25, week } = req.query;
    
    if (!scope || !['weekly', 'alltime'].includes(scope)) {
        return res.status(400).json({
            error: {
                code: 'INVALID_SCOPE',
                message: 'Scope must be weekly or alltime'
            }
        });
    }
    
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25));
    
    try {
        let entries = [];
        
        if (scope === 'weekly') {
            const weekKey = week || getCurrentWeekKey();
            entries = await getWeeklyLeaderboard(weekKey, limitNum);
        } else {
            entries = await getAllTimeLeaderboard(limitNum);
        }
        
        res.json({
            scope: scope,
            weekly_key: scope === 'weekly' ? (week || getCurrentWeekKey()) : null,
            updated_at: new Date().toISOString(),
            entries: entries
        });
    } catch (error) {
        console.error('Error getting leaderboard:', error);
        res.status(500).json({
            error: {
                code: 'DATABASE_ERROR',
                message: 'Failed to get leaderboard'
            }
        });
    }
});

// Get available weeks
app.get('/api/leaderboard/weeks', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT DISTINCT weekly_key FROM scores ORDER BY weekly_key DESC LIMIT 52'
        );
        const weeks = result.rows.map(row => row.weekly_key);
        res.json({ weeks });
    } catch (error) {
        console.error('Error getting weeks:', error);
        res.status(500).json({
            error: {
                code: 'DATABASE_ERROR',
                message: 'Failed to get weeks'
            }
        });
    }
});

// Share page
app.get('/share/:shareSlug', async (req, res) => {
    const { shareSlug } = req.params;
    
    try {
        const result = await pool.query(
            'SELECT * FROM scores WHERE share_slug = $1',
            [shareSlug]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).send('Score not found');
        }
        
        const scoreEntry = result.rows[0];
    
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lab Panic - ${scoreEntry.player_name} Score</title>
        <meta property="og:title" content="Lab Panic - ${scoreEntry.player_name} Score">
        <meta property="og:description" content="${scoreEntry.player_name} scored ${scoreEntry.score.toLocaleString()} points in Lab Panic!">
        <meta property="og:type" content="website">
        <meta property="og:url" content="${req.protocol}://${req.get('host')}${req.originalUrl}">
        <style>
            body {
                font-family: 'Orbitron', monospace;
                background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
                color: #ffffff;
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                text-align: center;
            }
            .share-card {
                background: rgba(0, 0, 0, 0.8);
                padding: 2rem;
                border-radius: 15px;
                border: 2px solid #00ff88;
                max-width: 500px;
            }
            .score {
                font-size: 3rem;
                color: #00ff88;
                margin: 1rem 0;
                text-shadow: 0 0 20px #00ff88;
            }
            .player-name {
                font-size: 1.5rem;
                color: #88aaff;
                margin-bottom: 1rem;
            }
            .play-button {
                background: linear-gradient(45deg, #00ff88, #00cc6a);
                color: #000;
                padding: 1rem 2rem;
                border: none;
                border-radius: 10px;
                font-family: 'Orbitron', monospace;
                font-size: 1.1rem;
                font-weight: 700;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                margin-top: 1rem;
            }
        </style>
    </head>
    <body>
        <div class="share-card">
            <h1>Lab Panic</h1>
            <div class="player-name">${scoreEntry.player_name}</div>
            <div class="score">${scoreEntry.score.toLocaleString()} points</div>
            <p>Play now and try to beat this score!</p>
            <a href="/" class="play-button">PLAY NOW</a>
        </div>
    </body>
    </html>
    `;
    
    res.send(html);
    } catch (error) {
        console.error('Error getting score:', error);
        res.status(500).send('Internal server error');
    }
});

// Helper functions for leaderboard calculations
async function calculateRank(score, scope, weekKey = null) {
    try {
        let query;
        let params;
        
        if (scope === 'weekly' && weekKey) {
            query = `
                WITH ranked AS (
                    SELECT player_name, score, created_at,
                           ROW_NUMBER() OVER (
                               PARTITION BY player_name
                               ORDER BY score DESC, created_at ASC
                           ) as rn
                    FROM scores
                    WHERE weekly_key = $1
                )
                SELECT COUNT(*) as rank
                FROM ranked
                WHERE rn = 1 AND (score > $2 OR (score = $2 AND created_at < (SELECT MIN(created_at) FROM ranked WHERE rn = 1 AND score = $2)))
            `;
            params = [weekKey, score];
        } else {
            query = `
                WITH best AS (
                    SELECT player_name, MAX(score) as best_score
                    FROM scores
                    GROUP BY player_name
                ),
                best_rows AS (
                    SELECT s.player_name, s.score, s.created_at
                    FROM scores s
                    JOIN best b ON b.player_name = s.player_name AND b.best_score = s.score
                )
                SELECT COUNT(*) as rank
                FROM best_rows
                WHERE (score > $1 OR (score = $1 AND created_at < (SELECT MIN(created_at) FROM best_rows WHERE score = $1)))
            `;
            params = [score];
        }
        
        const result = await pool.query(query, params);
        const rank = parseInt(result.rows[0].rank) + 1;
        return rank > 0 ? rank : null;
    } catch (error) {
        console.error('Error calculating rank:', error);
        return null;
    }
}

async function getWeeklyLeaderboard(weekKey, limit) {
    try {
        const query = `
            WITH ranked AS (
                SELECT player_name, score, created_at,
                       ROW_NUMBER() OVER (
                           PARTITION BY player_name
                           ORDER BY score DESC, created_at ASC
                       ) as rn
                FROM scores
                WHERE weekly_key = $1
            )
            SELECT ROW_NUMBER() OVER (ORDER BY score DESC, created_at ASC) as rank,
                   player_name, score, created_at
            FROM ranked
            WHERE rn = 1
            ORDER BY score DESC, created_at ASC
            LIMIT $2
        `;
        
        const result = await pool.query(query, [weekKey, limit]);
        return result.rows.map(row => ({
            rank: parseInt(row.rank),
            player_name: row.player_name,
            score: parseInt(row.score),
            created_at: row.created_at.toISOString()
        }));
    } catch (error) {
        console.error('Error getting weekly leaderboard:', error);
        return [];
    }
}

async function getAllTimeLeaderboard(limit) {
    try {
        const query = `
            WITH best AS (
                SELECT player_name, MAX(score) as best_score
                FROM scores
                GROUP BY player_name
            ),
            best_rows AS (
                SELECT s.player_name, s.score, s.created_at
                FROM scores s
                JOIN best b ON b.player_name = s.player_name AND b.best_score = s.score
            )
            SELECT ROW_NUMBER() OVER (ORDER BY score DESC, created_at ASC) as rank,
                   player_name, score, created_at
            FROM best_rows
            ORDER BY score DESC, created_at ASC
            LIMIT $1
        `;
        
        const result = await pool.query(query, [limit]);
        return result.rows.map(row => ({
            rank: parseInt(row.rank),
            player_name: row.player_name,
            score: parseInt(row.score),
            created_at: row.created_at.toISOString()
        }));
    } catch (error) {
        console.error('Error getting all-time leaderboard:', error);
        return [];
    }
}

// Clean up expired sessions periodically
setInterval(async () => {
    try {
        await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
        console.log('Cleaned up expired sessions');
    } catch (error) {
        console.error('Error cleaning up sessions:', error);
    }
}, 60000); // Every minute

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await pool.end();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down gracefully...');
    await pool.end();
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`Lab Panic API server running on port ${PORT} in ${NODE_ENV} mode`);
    console.log(`Open http://localhost:${PORT} to play the game`);
});
