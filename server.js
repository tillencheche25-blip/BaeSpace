const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const Database = require('better-sqlite3');
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
const db = new Database('./baespace.db');

// Create Database Tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        pairCode TEXT,
        avatar TEXT DEFAULT '👤'
    );
    CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pairCode TEXT,
        title TEXT,
        imageUrl TEXT,
        caption TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pairCode TEXT,
        author TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS dates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pairCode TEXT,
        title TEXT,
        eventDate TEXT
    );
    CREATE TABLE IF NOT EXISTS moods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        mood TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS anniversaries (
        pairCode TEXT PRIMARY KEY,
        startDate TEXT
    );
`);

// Ensure avatar column exists if updating existing DB
try {
    db.exec(`ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '👤'`);
} catch (e) { }

// ================= API ENDPOINTS =================

// Signup
app.post('/api/auth/signup', async (req, res) => {
    const { username, password, pairCode } = req.body;

    if (!username || !password || !pairCode) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const stmt = db.prepare(`INSERT INTO users (username, password, pairCode) VALUES (?, ?, ?)`);
        const info = stmt.run(username, hashedPassword, pairCode);

        const token = jwt.sign({ id: info.lastInsertRowid, username, pairCode }, JWT_SECRET);
        res.json({ token, username, pairCode, avatar: '👤' });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username already exists.' });
        }
        res.status(500).json({ error: 'Database error.' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required.' });
    }

    try {
        const user = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, pairCode: user.pairCode }, JWT_SECRET);
        res.json({ token, username: user.username, pairCode: user.pairCode, avatar: user.avatar || '👤' });
    } catch (err) {
        res.status(500).json({ error: 'Database error.' });
    }
});

// Get User Avatar
app.get('/api/user/avatar/:username', (req, res) => {
    const { username } = req.params;
    try {
        const user = db.prepare(`SELECT avatar FROM users WHERE username = ?`).get(username);
        res.json({ avatar: user ? user.avatar : '👤' });
    } catch (err) {
        res.status(500).json({ error: 'Database error.' });
    }
});

// Update User Avatar
app.post('/api/user/avatar', (req, res) => {
    const { username, avatar } = req.body;
    try {
        const stmt = db.prepare(`UPDATE users SET avatar = ? WHERE username = ?`);
        stmt.run(avatar, username);
        res.json({ success: true, avatar });
    } catch (err) {
        res.status(500).json({ error: 'Database error.' });
    }
});

// Get Memories
app.get('/api/memories/:pairCode', (req, res) => {
    const { pairCode } = req.params;
    try {
        const rows = db.prepare(`SELECT * FROM memories WHERE pairCode = ? ORDER BY id DESC`).all(pairCode);
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: 'Database error.' });
    }
});

// Add Memory
app.post('/api/memories', (req, res) => {
    const { pairCode, title, imageUrl, caption } = req.body;
    try {
        const stmt = db.prepare(`INSERT INTO memories (pairCode, title, imageUrl, caption) VALUES (?, ?, ?, ?)`);
        const info = stmt.run(pairCode, title, imageUrl, caption);
        res.json({ id: info.lastInsertRowid, pairCode, title, imageUrl, caption });
    } catch (err) {
        res.status(500).json({ error: 'Database error.' });
    }
});

// Get Love Notes
app.get('/api/notes/:pairCode', (req, res) => {
    const { pairCode } = req.params;
    try {
        const rows = db.prepare(`SELECT * FROM notes WHERE pairCode = ? ORDER BY id DESC`).all(pairCode);
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: 'Database error.' });
    }
});

// Add Love Note
app.post('/api/notes', (req, res) => {
    const { pairCode, author, content } = req.body;
    try {
        const stmt = db.prepare(`INSERT INTO notes (pairCode, author, content) VALUES (?, ?, ?)`);
        const info = stmt.run(pairCode, author, content);
        res.json({ id: info.lastInsertRowid, pairCode, author, content });
    } catch (err) {
        res.status(500).json({ error: 'Database error.' });
    }
});

// Get Important Dates
app.get('/api/dates/:pairCode', (req, res) => {
    const { pairCode } = req.params;
    try {
        const rows = db.prepare(`SELECT * FROM dates WHERE pairCode = ? ORDER BY eventDate ASC`).all(pairCode);
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: 'Database error.' });
    }
});

// Add Important Date
app.post('/api/dates', (req, res) => {
    const { pairCode, title, eventDate } = req.body;
    try {
        const stmt = db.prepare(`INSERT INTO dates (pairCode, title, eventDate) VALUES (?, ?, ?)`);
        const info = stmt.run(pairCode, title, eventDate);
        res.json({ id: info.lastInsertRowid, pairCode, title, eventDate });
    } catch (err) {
        res.status(500).json({ error: 'Database error.' });
    }
});

// Get Relationship Anniversary Date
app.get('/api/anniversary/:pairCode', (req, res) => {
    const { pairCode } = req.params;
    try {
        const row = db.prepare(`SELECT startDate FROM anniversaries WHERE pairCode = ?`).get(pairCode);
        res.json({ startDate: row ? row.startDate : null });
    } catch (err) {
        res.status(500).json({ error: 'Database error.' });
    }
});

// Save/Update Relationship Anniversary Date
app.post('/api/anniversary', (req, res) => {
    const { pairCode, startDate } = req.body;
    try {
        const stmt = db.prepare(`
            INSERT INTO anniversaries (pairCode, startDate) VALUES (?, ?)
            ON CONFLICT(pairCode) DO UPDATE SET startDate = ?
        `);
        stmt.run(pairCode, startDate, startDate);
        res.json({ success: true, startDate });
    } catch (err) {
        res.status(500).json({ error: 'Database error.' });
    }
});

// Update or Set Mood
app.post('/api/mood', (req, res) => {
    const { username, mood } = req.body;
    try {
        const stmt = db.prepare(`
            INSERT INTO moods (username, mood) VALUES (?, ?) 
            ON CONFLICT(username) DO UPDATE SET mood = ?, updated_at = CURRENT_TIMESTAMP
        `);
        stmt.run(username, mood, mood);
        res.json({ success: true, mood });
    } catch (err) {
        res.status(500).json({ error: 'Database error.' });
    }
});

// ================= SOCKET.IO REAL-TIME EVENTS =================

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', (data) => {
        socket.join(data.room);
        socket.to(data.room).emit('user_joined', {
            message: `${data.username} is now online 💕`
        });
    });

    socket.on('send_message', (data) => {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        io.to(data.room).emit('receive_message', { ...data, time });
    });

    socket.on('send_reaction', (data) => {
        io.to(data.room).emit('receive_reaction', data);
    });

    socket.on('typing', (data) => {
        socket.to(data.room).emit('display_typing', data);
    });

    socket.on('stop_typing', (data) => {
        socket.to(data.room).emit('hide_typing');
    });

    socket.on('new_activity_badge', (data) => {
        socket.to(data.room).emit('show_badge', data);
    });

    socket.on('update_anniversary', (data) => {
        io.to(data.room).emit('anniversary_updated', data);
    });

    socket.on('profile_avatar_updated', (data) => {
        socket.to(data.room).emit('partner_avatar_changed', data);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Start Server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});