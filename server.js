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

// Simple file-backed database so passwords survive Render restarts
const DB_FILE = path.join(__dirname, 'rooms_db.json');

function loadRooms() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(data);
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

    socket.on('join-room', (data, callback) => {
        // Ensure callback exists to prevent crash
        const ack = typeof callback === 'function' ? callback : () => { };

        const { email, password, roomCode } = data || {};

        if (!roomCode || !password || !email) {
            ack({ success: false, message: 'Please fill in all fields (Email, Password, Room Code).' });
            return;
        }

        const cleanRoom = roomCode.trim().toLowerCase();
        const cleanPass = password.trim();

        // If room does NOT exist, set its password
        if (!roomPasswords[cleanRoom]) {
            roomPasswords[cleanRoom] = cleanPass;
            saveRooms(roomPasswords);
            console.log(`Created new room "${cleanRoom}" with password.`);
        }
        // If room exists, verify password
        else if (roomPasswords[cleanRoom] !== cleanPass) {
            console.log(`Failed join attempt on room "${cleanRoom}": Incorrect password.`);
            ack({ success: false, message: 'Incorrect password for this room!' });
            return;
        }

        // Successfully authenticated
        socket.join(cleanRoom);
        socket.currentRoom = cleanRoom;
        socket.currentUser = email;
        console.log(`${email} joined room: ${cleanRoom}`);

        socket.to(cleanRoom).emit('user-joined', { email });

        ack({ success: true, roomCode: cleanRoom });
    });

    socket.on('send-message', (msgData) => {
        if (msgData && msgData.room) {
            socket.to(msgData.room.trim().toLowerCase()).emit('receive-message', msgData);
        }
    });

    socket.on('mark-read', ({ msgId, room }) => {
        if (room) {
            socket.to(room.trim().toLowerCase()).emit('message-read', { msgId });
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