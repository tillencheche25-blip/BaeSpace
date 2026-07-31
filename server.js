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
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e7
});

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store connected users per room to handle state sync
const roomStates = {};

io.on('connection', (socket) => {
    console.log(`[Socket Connected] ID: ${socket.id}`);

    // Join room event
    socket.on('join_room', (data) => {
        const roomId = (data && data.roomId) ? data.roomId.trim().toLowerCase() : 'secret-pair-123';

        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });

        socket.join(roomId);
        socket.currentRoom = roomId;
        console.log(`[Room Join] Socket ${socket.id} joined room: ${roomId}`);

        socket.emit('room_joined', { roomId });

        if (roomStates[roomId]) {
            socket.emit('receive_profile_update', roomStates[roomId]);
        }
    });

    // Real-time Chat Messaging
    socket.on('send_message', (data) => {
        const room = socket.currentRoom || 'secret-pair-123';
        socket.to(room).emit('receive_message', data);
    });

    // Real-time Profile Updates
    socket.on('update_profile', (data) => {
        const room = socket.currentRoom || 'secret-pair-123';
        roomStates[room] = { ...(roomStates[room] || {}), ...data };
        socket.to(room).emit('receive_profile_update', data);
    });

    // Real-time Sync for Memories, Notes, and Dates
    socket.on('add_memory', (data) => {
        const room = socket.currentRoom || 'secret-pair-123';
        socket.to(room).emit('receive_memory', data);
    });

    socket.on('add_note', (data) => {
        const room = socket.currentRoom || 'secret-pair-123';
        socket.to(room).emit('receive_note', data);
    });

    socket.on('add_date', (data) => {
        const room = socket.currentRoom || 'secret-pair-123';
        socket.to(room).emit('receive_date', data);
    });

    socket.on('disconnect', () => {
        console.log(`[Socket Disconnected] ID: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`BaeSpace server live on port ${PORT}`);
});