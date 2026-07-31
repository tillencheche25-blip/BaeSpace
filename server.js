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

// Express Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000 // Timeout fast if IP is blocked
})
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pairCode: { type: String, required: true },
    avatar: { type: String, default: '💬' },
    mood: { type: String, default: '🥰 Happy & Loving' },
    anniversaryDate: { type: String, default: '' }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Memory / Note / Date Schemas
const memorySchema = new mongoose.Schema({ pairCode: String, title: String, caption: String, imageUrl: String, date: { type: Date, default: Date.now } });
const noteSchema = new mongoose.Schema({ pairCode: String, author: String, content: String, date: { type: Date, default: Date.now } });
const dateSchema = new mongoose.Schema({ pairCode: String, title: String, date: String });

const Memory = mongoose.model('Memory', memorySchema);
const Note = mongoose.model('Note', noteSchema);
const EventDate = mongoose.model('Date', dateSchema);

// ================= AUTH ROUTES ================= //

// POST /api/register
app.post('/api/register', async (req, res) => {
    try {
        console.log('Incoming Register Payload:', req.body);
        const { username, password, pairCode } = req.body;

        if (!username || !password || !pairCode) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Check if username exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already taken.' });
        }

        const newUser = new User({ username, password, pairCode });
        await newUser.save();

        console.log('User registered successfully:', username);
        res.status(201).json({ message: 'Registration successful!', user: newUser });
    } catch (err) {
        console.error('❌ Register Server Error Details:', err);
        res.status(500).json({ message: err.message || 'Server error during registration.' });
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
        console.error('❌ Login Server Error Details:', err);
        res.status(500).json({ message: err.message || 'Server error during login.' });
    }
});

// GET & POST API Routes for Memories, Notes, Dates
app.get('/api/memories/:pairCode', async (req, res) => {
    try {
        const memories = await Memory.find({ pairCode: req.params.pairCode }).sort({ date: -1 });
        res.json(memories);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching memories.' });
    }
});

app.post('/api/memories', async (req, res) => {
    try {
        const newMemory = new Memory(req.body);
        await newMemory.save();
        res.status(201).json(newMemory);
    } catch (err) {
        res.status(500).json({ message: 'Error saving memory.' });
    }
});

app.get('/api/notes/:pairCode', async (req, res) => {
    try {
        const notes = await Note.find({ pairCode: req.params.pairCode }).sort({ date: -1 });
        res.json(notes);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching notes.' });
    }
});

app.post('/api/notes', async (req, res) => {
    try {
        const newNote = new Note(req.body);
        await newNote.save();
        res.status(201).json(newNote);
    } catch (err) {
        res.status(500).json({ message: 'Error saving note.' });
    }
});

app.get('/api/dates/:pairCode', async (req, res) => {
    try {
        const dates = await EventDate.find({ pairCode: req.params.pairCode });
        res.json(dates);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching dates.' });
    }
});

app.post('/api/dates', async (req, res) => {
    try {
        const newDate = new EventDate(req.body);
        await newDate.save();
        res.status(201).json(newDate);
    } catch (err) {
        res.status(500).json({ message: 'Error saving date.' });
    }
});

// Catch-all route to serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io Real-time Communication
io.on('connection', (socket) => {
    socket.on('join-room', ({ pairCode }) => {
        socket.join(pairCode);
    });

    socket.on('send-message', (data) => {
        io.to(data.pairCode).emit('receive-message', data);
    });

    socket.on('add-reaction', (data) => {
        io.to(data.pairCode).emit('update-reaction', data);
    });

    socket.on('typing', (data) => {
        socket.to(data.pairCode).emit('user-typing', data);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});