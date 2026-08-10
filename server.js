const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    maxHttpBufferSize: 1e7
});

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Accept password alongside email and room code
    socket.on('join-room', ({ email, password, roomCode }) => {
        socket.join(roomCode);
        socket.currentRoom = roomCode;
        socket.currentUser = email;
        console.log(`${email} joined room ${roomCode} with password`);

        socket.to(roomCode).emit('user-joined', { email });
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