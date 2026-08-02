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

app.use(express.static('public'));

// --- 1. Database Connection & Stale Index Cleanup ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/baespace';

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log(' Connected to MongoDB Database');

        // Auto-drop the old 'username_1' index if it exists in MongoDB
        try {
            await mongoose.connection.collection('users').dropIndex('username_1');
            console.log(' Successfully dropped legacy username_1 index');
        } catch (err) {
            // If the index doesn't exist, ignore the error
            if (err.code !== 27 && err.codeName !== 'IndexNotFound') {
                console.log(' Index cleanup status:', err.message);
            }
        }
    })
    .catch(err => console.error(' MongoDB Connection Error:', err));

// --- 2. User Schema ---
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

// --- 3. Socket.IO Connections ---
io.on('connection', (socket) => {
    console.log(` Client Connected: ${socket.id}`);

    // --- SIGN UP ---
    socket.on('user_signup', async ({ email, password }) => {
        try {
            if (!email || !password) {
                return socket.emit('auth_error', 'Email and password are required.');
            }

            const cleanEmail = String(email).toLowerCase().trim();
            console.log(`[SIGNUP ATTEMPT] Email: "${cleanEmail}"`);

            const existingUser = await User.findOne({ email: cleanEmail });
            if (existingUser) {
                console.log(`[SIGNUP FAIL] Email "${cleanEmail}" already exists in DB.`);
                return socket.emit('auth_error', 'An account with this email already exists.');
            }

            if (password.toString().length < 4) {
                return socket.emit('auth_error', 'Password must be at least 4 characters long.');
            }

            const hashedPassword = await bcrypt.hash(password.toString(), 10);

            const newUser = new User({
                email: cleanEmail,
                password: hashedPassword
            });

            await newUser.save();
            console.log(`[SIGNUP SUCCESS] Account created for "${cleanEmail}"`);

            socket.emit('auth_success', { user: { email: newUser.email } });
        } catch (err) {
            console.error('Signup Error Details:', err);

            if (err.code === 11000) {
                return socket.emit('auth_error', 'An account with this email already exists.');
            }

            socket.emit('auth_error', err.message || 'Error creating account.');
        }
    });

    // --- LOG IN ---
    socket.on('user_login', async ({ email, password }) => {
        try {
            if (!email || !password) {
                return socket.emit('auth_error', 'Email and password are required.');
            }

            const cleanEmail = String(email).toLowerCase().trim();
            console.log(`[LOGIN ATTEMPT] Email: "${cleanEmail}"`);

            const user = await User.findOne({ email: cleanEmail });

            if (!user) {
                console.log(`[LOGIN FAIL] No user found for "${cleanEmail}"`);
                return socket.emit('auth_error', 'No account found with this email.');
            }

            const isMatch = await bcrypt.compare(password.toString(), user.password);
            if (!isMatch) {
                console.log(`[LOGIN FAIL] Password mismatch for "${cleanEmail}"`);
                return socket.emit('auth_error', 'Incorrect password.');
            }

            console.log(`[LOGIN SUCCESS] "${cleanEmail}" authenticated.`);
            socket.emit('auth_success', { user: { email: user.email } });
        } catch (err) {
            console.error('Login Error Details:', err);
            socket.emit('auth_error', 'Error logging in.');
        }
    });

    // --- ROOM JOINING ---
    socket.on('join_partner_room', ({ userEmail, targetRoomId }) => {
        const roomId = targetRoomId || 'default_room';
        socket.join(roomId);
        console.log(` User ${userEmail || socket.id} joined room: ${roomId}`);

        socket.emit('room_access_granted', { roomId });
    });

    // --- MESSAGING ---
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(` BaeSpace server running on port ${PORT}`);
});