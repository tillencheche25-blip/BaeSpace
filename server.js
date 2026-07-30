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

// JWT Secret Key
const JWT_SECRET = process.env.JWT_SECRET || 'baespace_super_secret_key_2026';

// MongoDB Atlas Connection URI
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin:Smalley254@cluster0.nuha0yj.mongodb.net/baespace?appName=Cluster0';

mongoose.connect(MONGO_URI)
    .then(() => console.log('🍃 MongoDB Connected Successfully'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// User Schema & Model
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pairCode: { type: String, required: true },
    avatarUrl: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/847/847969.png' }
});

const User = mongoose.model('User', userSchema);

// AUTHENTICATION ROUTES

// SIGNUP ROUTE
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { username, password, pairCode } = req.body;

        if (!username || !password || !pairCode) {
            return res.status(400).json({ error: 'Please fill in all fields.' });
        }

        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already taken.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword, pairCode });
        await newUser.save();

        const token = jwt.sign(
            { userId: newUser._id, username: newUser.username, pairCode: newUser.pairCode },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({ success: true, token, username: newUser.username, pairCode: newUser.pairCode });
    } catch (err) {
        console.error("DETAILED SIGNUP ERROR:", err);
        res.status(500).json({ error: 'Server error during signup.' });
    }
});

// LOGIN ROUTE
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Please provide both username and password.' });
        }

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }

        const token = jwt.sign(
            { userId: user._id, username: user.username, pairCode: user.pairCode },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({ success: true, token, username: user.username, pairCode: user.pairCode });
    } catch (err) {
        console.error("DETAILED LOGIN ERROR:", err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// SOCKET.IO REAL-TIME CHAT
io.on('connection', (socket) => {
    socket.on('join_room', (data) => {
        const room = String(data.room);
        const username = data.username || 'Anonymous';

        socket.data.username = username;
        socket.data.room = room;
        socket.join(room);

        io.to(room).emit('user_joined', {
            username: username,
            message: `${username} connected 💕`
        });
    });

    socket.on('send_message', (data) => {
        const room = String(data.room);
        const messageObj = {
            username: data.username,
            message: data.message,
            type: data.type || 'text',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        io.to(room).emit('receive_message', messageObj);
    });

    socket.on('typing', (data) => {
        socket.to(String(data.room)).emit('display_typing', { username: data.username });
    });

    socket.on('stop_typing', (data) => {
        socket.to(String(data.room)).emit('hide_typing');
    });

    socket.on('disconnect', () => {
        if (socket.data.room && socket.data.username) {
            io.to(socket.data.room).emit('user_left', { message: `${socket.data.username} disconnected.` });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 BaeSpace running on http://localhost:${PORT}`));