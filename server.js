const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    maxHttpBufferSize: 1e7 // 10MB limit for image attachments
});

app.use(express.static(path.join(__dirname, 'public')));

// In-memory store for room passwords: { roomCode: password }
const roomPasswords = {};

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Secure Join Room Handler
    socket.on('join-room', ({ email, password, roomCode }, callback) => {
        if (!roomCode || !password) {
            if (callback) callback({ success: false, message: 'Room code and password are required.' });
            return;
        }

        // If the room doesn't exist, create it and register the password
        if (!roomPasswords[roomCode]) {
            roomPasswords[roomCode] = password;
            console.log(`Room ${roomCode} created with password.`);
        }
        // If room exists, verify password
        else if (roomPasswords[roomCode] !== password) {
            console.log(`Failed join attempt for room ${roomCode}: Incorrect password`);
            if (callback) callback({ success: false, message: 'Incorrect password for this room!' });
            return;
        }

        // Password verified - join room
        socket.join(roomCode);
        socket.currentRoom = roomCode;
        socket.currentUser = email;
        console.log(`${email} successfully joined room: ${roomCode}`);

        socket.to(roomCode).emit('user-joined', { email });

        // Respond with success to client
        if (callback) callback({ success: true });
    });

    socket.on('send-message', (msgData) => {
        socket.to(msgData.room).emit('receive-message', msgData);
    });

    socket.on('mark-read', ({ msgId, room }) => {
        socket.to(room).emit('message-read', { msgId });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});