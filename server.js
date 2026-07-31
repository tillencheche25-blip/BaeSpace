const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Storage
let users = [];
let chatHistory = {}; // Format: { pairCode: [ messages ] }
let memories = {};
let notes = {};
let dates = {};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

function getVerb(name) {
    if (!name) return 'is';
    const lower = name.toLowerCase();
    return (lower.includes(' and ') || lower.includes('&')) ? 'are' : 'is';
}

// --- AUTH ENDPOINTS ---

app.post('/api/auth/register', (req, res) => {
    const { username, password, pairCode } = req.body;
    if (!username || !password || !pairCode) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (existingUser) {
        return res.status(400).json({ message: 'Username already taken.' });
    }

    // RESTRICTION: Limit room to a maximum of 2 people
    const existingRoomUsers = users.filter(u => u.pairCode === pairCode);
    if (existingRoomUsers.length >= 2) {
        return res.status(403).json({ message: 'This room is full! Maximum of 2 people per room code.' });
    }

    const newUser = { username, password, pairCode, avatar: null, anniversary: null };
    users.push(newUser);
    return res.status(200).json({ user: newUser });
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);

    if (!user) {
        return res.status(401).json({ message: 'Invalid username or password.' });
    }
    return res.status(200).json({ user });
});

// --- PERMANENT ACCOUNT DELETION ---

app.post('/api/auth/delete-account', (req, res) => {
    const { username, pairCode } = req.body;
    if (!username) return res.status(400).json({ message: 'Username required.' });

    const initialLength = users.length;
    users = users.filter(u => u.username.toLowerCase() !== username.toLowerCase());

    if (users.length === initialLength) {
        return res.status(404).json({ message: 'User not found.' });
    }

    if (pairCode) {
        io.to(pairCode).emit('receive-message', {
            type: 'system',
            text: `${username} has permanently deleted their account.`
        });
    }

    return res.status(200).json({ success: true, message: 'Account permanently deleted.' });
});

// --- CHAT & MEDIA ENDPOINTS ---

app.get('/api/chat/:pairCode', (req, res) => {
    const { pairCode } = req.params;
    const history = (chatHistory[pairCode] || []).filter(msg => msg.type !== 'system');
    res.json(history);
});

app.post('/api/chat/upload', upload.single('file'), (req, res) => {
    const { pairCode, sender, type } = req.body;
    if (!req.file || !pairCode || !sender) {
        return res.status(400).json({ message: 'Missing parameters.' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    const messageData = {
        id: Date.now().toString(),
        pairCode,
        sender,
        type,
        fileUrl,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    if (!chatHistory[pairCode]) chatHistory[pairCode] = [];
    chatHistory[pairCode].push(messageData);
    res.json({ success: true, message: messageData });
});

// --- SOCKET LOGIC ---

io.on('connection', (socket) => {
    socket.on('join-room', ({ pairCode, username }) => {
        socket.join(pairCode);
        socket.pairCode = pairCode;
        socket.username = username;

        const verb = getVerb(username);
        socket.to(pairCode).emit('receive-message', {
            type: 'system',
            text: `${username} ${verb} now online 💕`,
            pairCode
        });
    });

    socket.on('send-message', (data) => {
        if (!data.pairCode) return;
        data.id = data.id || Date.now().toString();

        if (!chatHistory[data.pairCode]) chatHistory[data.pairCode] = [];
        if (data.type !== 'system') {
            chatHistory[data.pairCode].push(data);
        }

        io.to(data.pairCode).emit('receive-message', data);
    });

    socket.on('disconnect', () => {
        if (socket.pairCode && socket.username) {
            const verb = getVerb(socket.username);
            socket.to(socket.pairCode).emit('receive-message', {
                type: 'system',
                text: `${socket.username} ${verb} now offline 💔`,
                pairCode: socket.pairCode
            });
        }
    });
});

server.listen(PORT, () => console.log(`BaeSpace running on port ${PORT}`));