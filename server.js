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

// Serve static files from root AND public folder
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Real-time WebSockets logic
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Automatically join default couple room
    socket.join('couple-room');

    socket.on('send_message', (data) => {
        // Broadcast to everyone else in the room
        socket.to('couple-room').emit('receive_message', data);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`BaeSpace server running on port ${PORT}`);
});
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

// Serve static files from root AND public folder
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Real-time WebSockets logic
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Join room
    socket.join('couple-room');

    // Real-time Chat Messaging
    socket.on('send_message', (data) => {
        socket.to('couple-room').emit('receive_message', data);
    });

    // Real-time Profile Synchronization
    socket.on('update_profile', (data) => {
        socket.to('couple-room').emit('receive_profile_update', data);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`BaeSpace server running on port ${PORT}`);
});