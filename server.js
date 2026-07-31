const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Socket.io Connection Handler
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Listen for live messages and broadcast to other connected windows
    socket.on('send_message', (data) => {
        socket.broadcast.emit('receive_message', data);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`BaeSpace server running on port ${PORT}`);
});