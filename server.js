const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static('public'));

// In-memory databases (Replace with MongoDB / PostgreSQL models if needed)
// Users store: { "email@example.com": { email, password, name, partnerEmail, roomId } }
const users = {};
// Rooms store: { "room123": { roomId, members: [email1, email2], messages: [] } }
const rooms = {};

io.on('connection', (socket) => {
    console.log('⚡ User connected:', socket.id);

    // --- 1. USER AUTHENTICATION: SIGN UP ---
    socket.on('user_signup', ({ email, password, name }) => {
        const cleanEmail = email ? email.trim().toLowerCase() : '';
        const cleanPass = password ? password.trim() : '';

        if (!cleanEmail || !cleanPass) {
            return socket.emit('auth_error', 'Email and password are required.');
        }

        if (users[cleanEmail]) {
            return socket.emit('auth_error', 'Account already exists. Please log in.');
        }

        // Save User Account
        users[cleanEmail] = {
            email: cleanEmail,
            password: cleanPass, // Note: Use bcrypt in production
            name: name || cleanEmail.split('@')[0],
            partnerEmail: null,
            roomId: null
        };

        console.log(`👤 User Registered: [${cleanEmail}]`);
        socket.emit('auth_success', { user: users[cleanEmail] });
    });

    // --- 2. USER AUTHENTICATION: LOG IN ---
    socket.on('user_login', ({ email, password }) => {
        const cleanEmail = email ? email.trim().toLowerCase() : '';
        const cleanPass = password ? password.trim() : '';

        const user = users[cleanEmail];

        if (!user) {
            return socket.emit('auth_error', 'No account found with this email.');
        }

        if (user.password !== cleanPass) {
            return socket.emit('auth_error', 'Incorrect password! Access denied.');
        }

        console.log(`✅ Logged in: [${cleanEmail}]`);
        socket.emit('auth_success', { user });
    });

    // --- 3. SECURE ROOM PAIRING / ENTER ROOM ---
    socket.on('join_partner_room', ({ userEmail, password, targetRoomId }) => {
        const cleanEmail = userEmail ? userEmail.trim().toLowerCase() : '';
        const cleanPass = password ? password.trim() : '';
        const cleanRoom = targetRoomId ? targetRoomId.trim().toLowerCase() : '';

        const user = users[cleanEmail];

        // Strict Check: User identity & password verification
        if (!user || user.password !== cleanPass) {
            return socket.emit('room_error', 'Authentication failed. Incorrect email or password.');
        }

        // Initialize room if it doesn't exist
        if (!rooms[cleanRoom]) {
            rooms[cleanRoom] = {
                roomId: cleanRoom,
                members: [],
                messages: []
            };
        }

        // Max 2 partners per BaeSpace room
        const room = rooms[cleanRoom];
        if (!room.members.includes(cleanEmail) && room.members.length >= 2) {
            return socket.emit('room_error', 'This BaeSpace room is already full!');
        }

        if (!room.members.includes(cleanEmail)) {
            room.members.push(cleanEmail);
        }

        user.roomId = cleanRoom;
        socket.join(cleanRoom);
        console.log(`🔒 ${cleanEmail} securely joined BaeSpace room: [${cleanRoom}]`);

        socket.emit('room_access_granted', {
            roomId: cleanRoom,
            members: room.members
        });
    });

    // --- 4. MESSAGING ---
    socket.on('send_message', ({ roomId, message, userEmail, userName }) => {
        const cleanRoom = roomId ? roomId.trim().toLowerCase() : '';

        if (!rooms[cleanRoom]) {
            return socket.emit('room_error', 'Room connection lost.');
        }

        io.to(cleanRoom).emit('receive_message', {
            message,
            senderEmail: userEmail,
            senderName: userName,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 BaeSpace Server active on port ${PORT}`));