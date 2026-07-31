const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS and 10MB payload limit for profile images
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 1e7
});

// Serve static files safely from root and public directories
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Real-time WebSockets with Dynamic Room Security
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join isolated private room based on partner Pair Code
    socket.on('join_room', (data) => {
        const roomId = data && data.roomId ? data.roomId.trim().toLowerCase() : 'secret-pair-123';

        // Leave previous rooms
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });

        socket.join(roomId);
        socket.currentRoom = roomId;
        console.log(`Socket ${socket.id} joined private room: ${roomId}`);

        socket.emit('room_joined', { roomId });
    });

    // Relay messages ONLY within the specific room
    socket.on('send_message', (data) => {
        const room = socket.currentRoom || 'secret-pair-123';
        socket.to(room).emit('receive_message', data);
    });

    // Relay profile sync ONLY within the specific room
    socket.on('update_profile', (data) => {
        const room = socket.currentRoom || 'secret-pair-123';
        socket.to(room).emit('receive_profile_update', data);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// Bind to Render's dynamic PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`BaeSpace server running on port ${PORT}`);
});