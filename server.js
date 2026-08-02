const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Enable Socket.io with WebSockets fallback & CORS
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

// Store connected users & room state (profile, memories, notes, dates)
const roomStates = {};

io.on('connection', (socket) => {
    console.log(`[Socket Connected] ID: ${socket.id}`);

    // Join room event
    socket.on('join_room', (data) => {
        const roomId = (data && data.roomId) ? data.roomId.trim().toLowerCase() : 'secret-pair-123';

        // Leave any existing rooms except its own socket ID
        socket.rooms.forEach(room => {
            if (room !== socket.id) socket.leave(room);
        });

        socket.join(roomId);
        socket.currentRoom = roomId;
        console.log(`[Room Join] Socket ${socket.id} joined room: ${roomId}`);

        // Initialize room state structure if it doesn't exist
        if (!roomStates[roomId]) {
            roomStates[roomId] = {
                profile: {},
                memories: [],
                notes: [],
                dates: []
            };
        }

        // Confirm room join back to sender
        socket.emit('room_joined', { roomId });

        // Sync existing room state (profile, memories, notes, dates) to newly joined user
        const state = roomStates[roomId];

        if (Object.keys(state.profile).length > 0) {
            socket.emit('receive_profile_update', state.profile);
        }

        state.memories.forEach(memory => {
            socket.emit('receive_memory', memory);
        });

        state.notes.forEach(note => {
            socket.emit('receive_note', note);
        });

        state.dates.forEach(date => {
            socket.emit('receive_date', date);
        });
    });

    // Real-time Chat Messaging
    socket.on('send_message', (data) => {
        const room = socket.currentRoom || 'secret-pair-123';
        socket.to(room).emit('receive_message', data);
    });

    // Real-time Profile Updates (Sync & Save State)
    socket.on('update_profile', (data) => {
        const room = socket.currentRoom || 'secret-pair-123';

        if (!roomStates[room]) roomStates[room] = { profile: {}, memories: [], notes: [], dates: [] };
        roomStates[room].profile = { ...roomStates[room].profile, ...data };

        // Broadcast update to partner in room
        socket.to(room).emit('receive_profile_update', data);
    });

    // Real-time Memories Sync
    socket.on('add_memory', (data) => {
        const room = socket.currentRoom || 'secret-pair-123';
        if (!roomStates[room]) roomStates[room] = { profile: {}, memories: [], notes: [], dates: [] };

        roomStates[room].memories.push(data);
        socket.to(room).emit('receive_memory', data);
    });

    // Real-time Notes Sync
    socket.on('add_note', (data) => {
        const room = socket.currentRoom || 'secret-pair-123';
        if (!roomStates[room]) roomStates[room] = { profile: {}, memories: [], notes: [], dates: [] };

        roomStates[room].notes.push(data);
        socket.to(room).emit('receive_note', data);
    });

    // Real-time Dates Sync
    socket.on('add_date', (data) => {
        const room = socket.currentRoom || 'secret-pair-123';
        if (!roomStates[room]) roomStates[room] = { profile: {}, memories: [], notes: [], dates: [] };

        roomStates[room].dates.push(data);
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