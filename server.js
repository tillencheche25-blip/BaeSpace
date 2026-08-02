const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static assets from the public directory
app.use(express.static('public'));

// --- 1. Database Connection ---
// Set your MongoDB Atlas URI in your Render Environment Variables (Key: MONGO_URI)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/baespace';

mongoose.connect(MONGO_URI)
    .then(() => console.log(' Connected to MongoDB Database'))
    .catch(err => console.error(' MongoDB Connection Error:', err));

// --- 2. Database User Schema ---
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const User = mongoose.model('User', userSchema);

// --- 3. Socket.IO Authentication & Chat Relays ---
io.on('connection', (socket) => {
    console.log(` Client Connected: ${socket.id}`);

    // --- SIGN UP HANDLER ---
    socket.on('user_signup', async ({ email, password }) => {
        try {
            if (!email || !password) {
                return socket.emit('auth_error', 'Email and password are required.');
            }

            const cleanEmail = email.toLowerCase().trim();
            const existingUser = await User.findOne({ email: cleanEmail });

            if (existingUser) {
                return socket.emit('auth_error', 'An account with this email already exists.');
            }

            // Hash password (salt rounds: 10)
            const hashedPassword = await bcrypt.hash(password, 10);

            const newUser = new User({
                email: cleanEmail,
                password: hashedPassword
            });

            await newUser.save();
            console.log(` New account created: ${cleanEmail}`);

            socket.emit('auth_success', { user: { email: newUser.email } });
        } catch (err) {
            console.error('Signup error:', err);
            socket.emit('auth_error', 'Error creating account. Please try again.');
        }
    });

    // --- LOG IN HANDLER ---
    socket.on('user_login', async ({ email, password }) => {
        try {
            if (!email || !password) {
                return socket.emit('auth_error', 'Email and password are required.');
            }

            const cleanEmail = email.toLowerCase().trim();
            const user = await User.findOne({ email: cleanEmail });

            if (!user) {
                return socket.emit('auth_error', 'No account found with this email.');
            }

            // Verify password hash match
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return socket.emit('auth_error', 'Incorrect password.');
            }

            console.log(` User logged in: ${cleanEmail}`);
            socket.emit('auth_success', { user: { email: user.email } });
        } catch (err) {
            console.error('Login error:', err);
            socket.emit('auth_error', 'Error logging in. Please try again.');
        }
    });

    // --- ROOM JOINING HANDLER ---
    socket.on('join_partner_room', ({ userEmail, password, targetRoomId }) => {
        const roomId = targetRoomId || 'default_room';
        socket.join(roomId);
        console.log(` Socket ${socket.id} joined room: ${roomId}`);

        socket.emit('room_access_granted', { roomId });
    });

    // --- MESSAGING HANDLER ---
    socket.on('send_message', (data) => {
        const timestamp = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        io.to(data.roomId).emit('receive_message', {
            message: data.message,
            senderEmail: data.userEmail,
            timestamp: timestamp
        });
    });

    socket.on('disconnect', () => {
        console.log(` Client Disconnected: ${socket.id}`);
    });
});

// --- 4. Server Listener ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(` BaeSpace server running on port ${PORT}`);
});