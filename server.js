const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, 'public')));

// Store message history per room in memory
const roomMessages = {};

io.on('connection', (socket) => {
    console.log(`⚡ Connected: ${socket.id}`);

    // JOIN ROOM
    socket.on('join_room', (data) => {
        const room = String(typeof data === 'object' ? data.room : data);
        const username = (typeof data === 'object' && data.username) ? data.username : 'Anonymous';

        socket.data.username = username;
        socket.data.room = room;

        socket.join(room);

        // Send previous chat history to the newly connected user
        if (roomMessages[room]) {
            socket.emit('load_history', roomMessages[room]);
        }

        // Broadcast join notice
        io.to(room).emit('user_joined', {
            username: username,
            message: `${username} joined BaeSpace 💕`
        });
    });

    // SEND MESSAGE
    socket.on('send_message', (data) => {
        const room = String(data.room);
        const username = data.username || socket.data.username || 'Anonymous';

        const messageObj = {
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            username: username,
            message: data.message,
            type: data.type || 'text',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        // Save to room history (keep last 100 messages)
        if (!roomMessages[room]) roomMessages[room] = [];
        roomMessages[room].push(messageObj);
        if (roomMessages[room].length > 100) roomMessages[room].shift();

        // Broadcast message to room
        io.to(room).emit('receive_message', messageObj);
    });

    // TYPING STATUS
    socket.on('typing', (data) => {
        socket.to(String(data.room)).emit('display_typing', { username: data.username });
    });

    socket.on('stop_typing', (data) => {
        socket.to(String(data.room)).emit('hide_typing');
    });

    // DISCONNECT
    socket.on('disconnect', () => {
        if (socket.data.room && socket.data.username) {
            io.to(socket.data.room).emit('user_left', {
                username: socket.data.username,
                message: `${socket.data.username} left.`
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 BaeSpace running on http://localhost:${PORT}`);
});