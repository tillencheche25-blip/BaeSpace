const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'baespace_secret_key_123';

// Middleware
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database Initialization
const db = new sqlite3.Database('./baespace.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

// Create Database Tables
db.serialize(() => {
    // Users table
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            pairCode TEXT
        )
    `);

    // Memories table
    db.run(`
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pairCode TEXT,
            title TEXT,
            imageUrl TEXT,
            caption TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Love Notes table
    db.run(`
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pairCode TEXT,
            author TEXT,
            content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Important Dates table
    db.run(`
        CREATE TABLE IF NOT EXISTS dates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pairCode TEXT,
            title TEXT,
            eventDate TEXT
        )
    `);

    // Moods table
    db.run(`
        CREATE TABLE IF NOT EXISTS moods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            mood TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

// ================= API ENDPOINTS =================

// Signup
app.post('/api/auth/signup', async (req, res) => {
    const { username, password, pairCode } = req.body;

    if (!username || !password || !pairCode) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = `INSERT INTO users (username, password, pairCode) VALUES (?, ?, ?)`;

        db.run(query, [username, hashedPassword, pairCode], function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'Username already exists.' });
                }
                return res.status(500).json({ error: 'Database error.' });
            }

            const token = jwt.sign({ id: this.lastID, username, pairCode }, JWT_SECRET);
            res.json({ token, username, pairCode });
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error.' });
    }
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required.' });
    }

    const query = `SELECT * FROM users WHERE username = ?`;
    db.get(query, [username], async (err, user) => {
        if (err || !user) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, pairCode: user.pairCode }, JWT_SECRET);
        res.json({ token, username: user.username, pairCode: user.pairCode });
    });
});

// Get Memories
app.get('/api/memories/:pairCode', (req, res) => {
    const { pairCode } = req.params;
    db.all(`SELECT * FROM memories WHERE pairCode = ? ORDER BY id DESC`, [pairCode], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json(rows);
    });
});

// Add Memory
app.post('/api/memories', (req, res) => {
    const { pairCode, title, imageUrl, caption } = req.body;
    db.run(
        `INSERT INTO memories (pairCode, title, imageUrl, caption) VALUES (?, ?, ?, ?)`,
        [pairCode, title, imageUrl, caption],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error.' });
            res.json({ id: this.lastID, pairCode, title, imageUrl, caption });
        }
    );
});

// Get Love Notes
app.get('/api/notes/:pairCode', (req, res) => {
    const { pairCode } = req.params;
    db.all(`SELECT * FROM notes WHERE pairCode = ? ORDER BY id DESC`, [pairCode], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json(rows);
    });
});

// Add Love Note
app.post('/api/notes', (req, res) => {
    const { pairCode, author, content } = req.body;
    db.run(
        `INSERT INTO notes (pairCode, author, content) VALUES (?, ?, ?)`,
        [pairCode, author, content],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error.' });
            res.json({ id: this.lastID, pairCode, author, content });
        }
    );
});

// Get Important Dates
app.get('/api/dates/:pairCode', (req, res) => {
    const { pairCode } = req.params;
    db.all(`SELECT * FROM dates WHERE pairCode = ? ORDER BY eventDate ASC`, [pairCode], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        res.json(rows);
    });
});

// Add Important Date
app.post('/api/dates', (req, res) => {
    const { pairCode, title, eventDate } = req.body;
    db.run(
        `INSERT INTO dates (pairCode, title, eventDate) VALUES (?, ?, ?)`,
        [pairCode, title, eventDate],
        function (err) {
            if (err) return res.status(500).json({ error: 'Database error.' });
            res.json({ id: this.lastID, pairCode, title, eventDate });
        }
    );
});

// Update or Set Mood
app.post('/api/mood', (req, res) => {
    const { username, mood } = req.body;
    db.run(
        `INSERT INTO moods (username, mood) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET mood = ?, updated_at = CURRENT_TIMESTAMP`,
        [username, mood, mood],
        (err) => {
            if (err) return res.status(500).json({ error: 'Database error.' });
            res.json({ success: true, mood });
        }
    );
});

// ================= SOCKET.IO REAL-TIME EVENTS =================

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join Room
    socket.on('join_room', (data) => {
        socket.join(data.room);
        socket.to(data.room).emit('user_joined', {
            message: `${data.username} is now online 💕`
        });
    });

    // Send Message (Text, Image, Audio)
    socket.on('send_message', (data) => {
        // data = { id, room, username, message, type }
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        io.to(data.room).emit('receive_message', { ...data, time });
    });

    // Message Reactions
    socket.on('send_reaction', (data) => {
        // data = { room, messageId, emoji, username }
        io.to(data.room).emit('receive_reaction', data);
    });

    // Typing Indicators
    socket.on('typing', (data) => {
        socket.to(data.room).emit('display_typing', data);
    });

    socket.on('stop_typing', (data) => {
        socket.to(data.room).emit('hide_typing');
    });

    // Activity Badges Sync
    socket.on('new_activity_badge', (data) => {
        // data = { room, category }
        socket.to(data.room).emit('show_badge', data);
    });

    // Anniversary Sync
    socket.on('update_anniversary', (data) => {
        // data = { room, startDate }
        io.to(data.room).emit('anniversary_updated', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});