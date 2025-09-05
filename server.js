const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8787;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// In-memory storage (in productie zou je een database gebruiken)
const sessions = new Map();
const scores = [];
const shareSlugs = new Map();

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
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        sessions: sessions.size,
        scores: scores.length,
        environment: NODE_ENV
    });
});

// Version
app.get('/api/version', (req, res) => {
    res.json({ version: '1.0.0' });
});

// Start session
app.post('/api/sessions/start', (req, res) => {
    const { platform } = req.body;
    
    if (!platform || !['mobile', 'desktop'].includes(platform)) {
        return res.status(400).json({
            error: {
                code: 'INVALID_PLATFORM',
                message: 'Platform must be mobile or desktop'
            }
        });
    }
    
    const sessionId = uuidv4();
    const startToken = Math.random().toString(36).substring(2, 15);
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    
    sessions.set(sessionId, {
        sessionId,
        startToken,
        startedAt,
        expiresAt,
        platform,
        used: false
    });
    
    res.json({
        session_id: sessionId,
        start_token: startToken,
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString()
    });
});

// Submit score
app.post('/api/scores', (req, res) => {
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
    
    // Validate session
    const session = sessions.get(session_id);
    if (!session || session.startToken !== start_token || session.used) {
        return res.status(401).json({
            error: {
                code: 'INVALID_SESSION',
                message: 'Invalid or expired session'
            }
        });
    }
    
    // Check if session is expired
    if (new Date() > session.expiresAt) {
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
    
    // Mark session as used
    session.used = true;
    
    // Generate share slug
    const shareSlug = generateShareSlug();
    
    // Create score entry
    const scoreEntry = {
        id: uuidv4(),
        player_name: player_name,
        score: score,
        created_at: new Date(),
        platform: platform,
        session_id: session_id,
        weekly_key: getCurrentWeekKey(),
        share_slug: shareSlug
    };
    
    scores.push(scoreEntry);
    shareSlugs.set(shareSlug, scoreEntry);
    
    // Calculate ranks
    const weeklyRank = calculateRank(score, 'weekly', scoreEntry.weekly_key);
    const alltimeRank = calculateRank(score, 'alltime');
    
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
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
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
    
    let entries = [];
    
    if (scope === 'weekly') {
        const weekKey = week || getCurrentWeekKey();
        entries = getWeeklyLeaderboard(weekKey, limitNum);
    } else {
        entries = getAllTimeLeaderboard(limitNum);
    }
    
    res.json({
        scope: scope,
        weekly_key: scope === 'weekly' ? (week || getCurrentWeekKey()) : null,
        updated_at: new Date().toISOString(),
        entries: entries
    });
});

// Get available weeks
app.get('/api/leaderboard/weeks', (req, res) => {
    const weeks = [...new Set(scores.map(s => s.weekly_key))].sort().reverse().slice(0, 52);
    res.json({ weeks });
});

// Share page
app.get('/share/:shareSlug', (req, res) => {
    const { shareSlug } = req.params;
    const scoreEntry = shareSlugs.get(shareSlug);
    
    if (!scoreEntry) {
        return res.status(404).send('Score not found');
    }
    
    const html = `
    <!DOCTYPE html>
    <html lang="nl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Lab Panic - ${scoreEntry.player_name} Score</title>
        <meta property="og:title" content="Lab Panic - ${scoreEntry.player_name} Score">
        <meta property="og:description" content="${scoreEntry.player_name} scoorde ${scoreEntry.score.toLocaleString()} punten in Lab Panic!">
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
            <div class="score">${scoreEntry.score.toLocaleString()} punten</div>
            <p>Speel nu en probeer deze score te verslaan!</p>
            <a href="/" class="play-button">SPEEL NU</a>
        </div>
    </body>
    </html>
    `;
    
    res.send(html);
});

// Helper functions for leaderboard calculations
function calculateRank(score, scope, weekKey = null) {
    let filteredScores = scores;
    
    if (scope === 'weekly' && weekKey) {
        filteredScores = scores.filter(s => s.weekly_key === weekKey);
    }
    
    // Get best score per player
    const playerBestScores = new Map();
    filteredScores.forEach(s => {
        const current = playerBestScores.get(s.player_name) || 0;
        if (s.score > current) {
            playerBestScores.set(s.player_name, s.score);
        }
    });
    
    // Sort by score (descending)
    const sortedScores = Array.from(playerBestScores.values()).sort((a, b) => b - a);
    
    // Find rank (1-based)
    const rank = sortedScores.findIndex(s => s <= score) + 1;
    return rank > 0 ? rank : null;
}

function getWeeklyLeaderboard(weekKey, limit) {
    const weekScores = scores.filter(s => s.weekly_key === weekKey);
    return getLeaderboardEntries(weekScores, limit);
}

function getAllTimeLeaderboard(limit) {
    return getLeaderboardEntries(scores, limit);
}

function getLeaderboardEntries(scoreList, limit) {
    // Get best score per player
    const playerBestScores = new Map();
    scoreList.forEach(s => {
        const current = playerBestScores.get(s.player_name);
        if (!current || s.score > current.score) {
            playerBestScores.set(s.player_name, {
                player_name: s.player_name,
                score: s.score,
                created_at: s.created_at
            });
        }
    });
    
    // Sort by score (descending), then by creation time (ascending)
    const entries = Array.from(playerBestScores.values())
        .sort((a, b) => {
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            return new Date(a.created_at) - new Date(b.created_at);
        })
        .slice(0, limit)
        .map((entry, index) => ({
            rank: index + 1,
            player_name: entry.player_name,
            score: entry.score,
            created_at: entry.created_at.toISOString()
        }));
    
    return entries;
}

// Clean up expired sessions periodically
setInterval(() => {
    const now = new Date();
    for (const [sessionId, session] of sessions.entries()) {
        if (now > session.expiresAt) {
            sessions.delete(sessionId);
        }
    }
}, 60000); // Every minute

// Start server
app.listen(PORT, () => {
    console.log(`Lab Panic API server running on port ${PORT} in ${NODE_ENV} mode`);
    console.log(`Open http://localhost:${PORT} to play the game`);
});
