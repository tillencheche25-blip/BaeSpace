const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io with permissive CORS and payload limits
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e7 // 10MB payload limit for profile photos
});

// Serve static files safely from root and public directories
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Real-time WebSockets logic
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join default room
    socket.join('couple-room');

    // Real-time Chat Messaging
    socket.on('send_message', (data) => {
        socket.to('couple-room').emit('receive_message', data);
    });

    // Real-time Profile Synchronization (Mood, Avatar, Anniversary)
    socket.on('update_profile', (data) => {
        socket.to('couple-room').emit('receive_profile_update', data);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Ensure Render's dynamic PORT is used
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`BaeSpace server running on port ${PORT}`);
});