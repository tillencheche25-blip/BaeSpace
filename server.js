const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Increase max buffer size to 10MB to handle image transfers safely
const io = new Server(server, {
    maxHttpBufferSize: 1e7
});

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join room logic
    socket.on('join-room', ({ email, roomCode }) => {
        socket.join(roomCode);
        socket.currentRoom = roomCode;
        socket.currentUser = email;
        console.log(`${email} joined room: ${roomCode}`);

        socket.to(roomCode).emit('user-joined', { email });
    });

    // Relay messages (text + image attachments)
    socket.on('send-message', (msgData) => {
        // Broadcast to everyone in the room except the sender
        socket.to(msgData.room).emit('receive-message', msgData);
    });

    // Relay read receipts
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