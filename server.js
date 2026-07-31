const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin:Smalley254@cluster0.nuha0yj.mongodb.net/baespace?appName=Cluster0';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pairCode: { type: String, required: true },
    avatar: { type: String, default: '💬' },
    mood: { type: String, default: '🥰 Happy & Loving' },
    anniversary: { type: String, default: '' }
});

const User = mongoose.model('User', userSchema);

// Memory / Note / Date Schemas
const memorySchema = new mongoose.Schema({ pairCode: String, title: String, caption: String, image: String, date: { type: Date, default: Date.now } });
const noteSchema = new mongoose.Schema({ pairCode: String, sender: String, content: String, date: { type: Date, default: Date.now } });
const dateSchema = new mongoose.Schema({ pairCode: String, title: String, eventDate: String });

const Memory = mongoose.model('Memory', memorySchema);
const Note = mongoose.model('Note', noteSchema);
const EventDate = mongoose.model('Date', dateSchema);

// ================= AUTH ROUTES ================= //

// POST /api/register
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, pairCode } = req.body;

        if (!username || !password || !pairCode) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already taken.' });
        }

        const newUser = new User({ username, password, pairCode });
        await newUser.save();

        res.status(201).json({ message: 'Registration successful!', user: newUser });
    } catch (err) {
        console.error('Register Error:', err);
        res.status(500).json({ message: 'Server error during registration.' });
    }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username, password });
        if (!user) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }

        res.status(200).json({ message: 'Login successful!', user });
    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ message: 'Server error during login.' });
    }
});

// GET /api/memories
app.get('/api/memories', async (req, res) => {
    try {
        const { pairCode } = req.query;
        const memories = await Memory.find({ pairCode }).sort({ date: -1 });
        res.json(memories);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching memories.' });
    }
});

// POST /api/memories
app.post('/api/memories', async (req, res) => {
    try {
        const { pairCode, title, caption, image } = req.body;
        const newMemory = new Memory({ pairCode, title, caption, image });
        await newMemory.save();
        res.status(201).json(newMemory);
    } catch (err) {
        res.status(500).json({ message: 'Error saving memory.' });
    }
});

// Fallback Route to serve index.html for unknown routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Real-time Chat Socket
io.on('connection', (socket) => {
    socket.on('join', ({ pairCode }) => {
        socket.join(pairCode);
    });

    socket.on('sendMessage', (data) => {
        io.to(data.pairCode).emit('message', data);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});