const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    maxHttpBufferSize: 1e7 // 10MB limit
});

app.use(express.static(path.join(__dirname, 'public')));

// Persistent file-backed database for room passwords
const DB_FILE = path.join(__dirname, 'rooms_db.json');

function loadRooms() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('Error reading rooms DB:', err);
    }
    return {};
}

function saveRooms(rooms) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(rooms, null, 2));
    } catch (err) {
        console.error('Error saving rooms DB:', err);
    }
}

const roomPasswords = loadRooms();

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join Room Handler with strict normalization
    socket.on('join-room', (data, callback) => {
        const ack = typeof callback === 'function' ? callback : () => { };
        const { email, password, roomCode } = data || {};

        if (!roomCode || !password || !email) {
            return ack({ success: false, message: 'Please fill in Email, Password, and Room Code.' });
        }

        // Clean & normalize room code and password to prevent room mismatches
        const cleanRoom = roomCode.trim().toLowerCase();
        const cleanPass = password.trim();

        // 1. Create room if it doesn't exist
        if (!roomPasswords[cleanRoom]) {
            roomPasswords[cleanRoom] = cleanPass;
            saveRooms(roomPasswords);
            console.log(`[DB] Created room "${cleanRoom}"`);
        }
        // 2. Validate password if room exists
        else if (roomPasswords[cleanRoom] !== cleanPass) {
            console.log(`[AUTH FAILED] Room "${cleanRoom}" wrong password.`);
            return ack({ success: false, message: 'Incorrect room password!' });
        }

        // Leave any previously joined room on this socket
        if (socket.currentRoom) {
            socket.leave(socket.currentRoom);
        }

        // Join the Socket.io room
        socket.join(cleanRoom);
        socket.currentRoom = cleanRoom;
        socket.currentUser = email;

        console.log(`[JOIN SUCCESS] ${email} joined room: "${cleanRoom}"`);

        // Notify room mates
        socket.to(cleanRoom).emit('user-joined', { email });

        ack({ success: true, roomCode: cleanRoom });
    });

    // Send Message Handler
    socket.on('send-message', (msgData) => {
        if (!msgData || !msgData.room) return;

        const targetRoom = msgData.room.trim().toLowerCase();

        // Broadcast message to everyone ELSE in the room
        socket.to(targetRoom).emit('receive-message', msgData);
        console.log(`[MSG] Sent from ${msgData.sender} to room "${targetRoom}"`);
    });

    // Read Receipts
    socket.on('mark-read', ({ msgId, room }) => {
        if (room) {
            const targetRoom = room.trim().toLowerCase();
            socket.to(targetRoom).emit('message-read', { msgId });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});