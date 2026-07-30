require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'baespace_super_secret_key_2026';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin:Smalley254@cluster0.nuha0yj.mongodb.net/baespace?appName=Cluster0';

mongoose.connect(MONGO_URI)
    .then(() => console.log('🍃 MongoDB Connected Successfully'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ================= SCHEMAS =================

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pairCode: { type: String, required: true },
    avatarUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/847/847969.png' },
    mood: { type: String, default: '🥰 Happy' }
});

// Love Notes Schema
const noteSchema = new mongoose.Schema({
    pairCode: { type: String, required: true },
    author: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Important Dates Schema
const dateSchema = new mongoose.Schema({
    pairCode: { type: String, required: true },
    title: { type: String, required: true },
    eventDate: { type: Date, required: true }
});

// Shared Memories Schema
const memorySchema = new mongoose.Schema({
    pairCode: { type: String, required: true },
    title: { type: String, required: true },
    imageUrl: { type: String, required: true },
    caption: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Note = mongoose.model('Note', noteSchema);
const EventDate = mongoose.model('EventDate', dateSchema);
const Memory = mongoose.model('Memory', memorySchema);

// ================= API ROUTES =================

// AUTHENTICATION
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password, pairCode } = req.body;
        if (!username || !password || !pairCode) return res.status(400).json({ error: 'Please fill in all fields.' });

        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: 'Username already taken.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword, pairCode });
        await newUser.save();

        const token = jwt.sign({ userId: newUser._id, username: newUser.username, pairCode: newUser.pairCode }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, username: newUser.username, pairCode: newUser.pairCode });
    } catch (err) {
        res.status(500).json({ error: 'Server error during signup.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Provide both fields.' });

        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        const token = jwt.sign({ userId: user._id, username: user.username, pairCode: user.pairCode }, JWT_SECRET, { expiresIn: '30d' });
        res.json({ success: true, token, username: user.username, pairCode: user.pairCode, mood: user.mood });
    } catch (err) {
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// LOVE NOTES
app.get('/api/notes/:pairCode', async (req, res) => {
    const notes = await Note.find({ pairCode: req.params.pairCode }).sort({ createdAt: -1 });
    res.json(notes);
});

app.post('/api/notes', async (req, res) => {
    const { pairCode, author, content } = req.body;
    const newNote = new Note({ pairCode, author, content });
    await newNote.save();
    res.json(newNote);
});

// IMPORTANT DATES
app.get('/api/dates/:pairCode', async (req, res) => {
    const dates = await EventDate.find({ pairCode: req.params.pairCode }).sort({ eventDate: 1 });
    res.json(dates);
});

app.post('/api/dates', async (req, res) => {
    const { pairCode, title, eventDate } = req.body;
    const newDate = new EventDate({ pairCode, title, eventDate });
    await newDate.save();
    res.json(newDate);
});

// SHARED MEMORIES
app.get('/api/memories/:pairCode', async (req, res) => {
    const memories = await Memory.find({ pairCode: req.params.pairCode }).sort({ createdAt: -1 });
    res.json(memories);
});

app.post('/api/memories', async (req, res) => {
    const { pairCode, title, imageUrl, caption } = req.body;
    const newMemory = new Memory({ pairCode, title, imageUrl, caption });
    await newMemory.save();
    res.json(newMemory);
});

// MOOD UPDATE
app.post('/api/mood', async (req, res) => {
    const { username, mood } = req.body;
    await User.updateOne({ username }, { mood });
    res.json({ success: true });
});

// ================= SOCKET.IO CHAT =================
io.on('connection', (socket) => {
    socket.on('join_room', (data) => {
        socket.join(String(data.room));
        socket.data.username = data.username;
        socket.data.room = String(data.room);
        io.to(data.room).emit('user_joined', { username: data.username, message: `${data.username} connected 💕` });
    });

    socket.on('send_message', (data) => {
        const messageObj = {
            username: data.username,
            message: data.message,
            type: data.type || 'text',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        io.to(String(data.room)).emit('receive_message', messageObj);
    });

    socket.on('typing', (data) => {
        socket.to(String(data.room)).emit('display_typing', { username: data.username });
    });

    socket.on('stop_typing', (data) => {
        socket.to(String(data.room)).emit('hide_typing');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 BaeSpace active on http://localhost:${PORT}`));