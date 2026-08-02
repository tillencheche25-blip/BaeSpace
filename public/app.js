const socket = io();

let currentUser = null;
let currentRoomId = null;
let isSignUpMode = false;

function showAuthModal() {
    document.getElementById('auth-modal').classList.add('active');
}

function hideAuthModal() {
    document.getElementById('auth-modal').classList.remove('active');
}

function toggleAuthMode(e) {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    const btn = document.getElementById('auth-submit-btn');
    const toggleText = document.getElementById('auth-toggle-text');

    if (isSignUpMode) {
        btn.innerText = 'Sign Up';
        btn.setAttribute('onclick', 'handleSignUp()');
        toggleText.innerText = 'Already have an account?';
    } else {
        btn.innerText = 'Log In';
        btn.setAttribute('onclick', 'handleLogin()');
        toggleText.innerText = "Don't have an account?";
    }
}

// Handle Sign Up
function handleSignUp() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    if (!email.trim() || !password.trim()) {
        alert('Please fill in both email and password.');
        return;
    }

    socket.emit('user_signup', { email, password });
}

// Handle Log In
function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const roomCode = document.getElementById('auth-room-code').value;

    if (!email.trim() || !password.trim()) {
        alert('Please enter your credentials.');
        return;
    }

    socket.emit('user_login', { email, password });

    // Store room code to join right after login completes
    if (roomCode.trim()) {
        currentRoomId = roomCode.trim();
    }
}

// Auth Success Response
socket.on('auth_success', (data) => {
    currentUser = data.user;

    // Auto-join room with password validation if room code was supplied
    const password = document.getElementById('auth-password').value;
    const roomCode = document.getElementById('auth-room-code').value || 'default_room';

    socket.emit('join_partner_room', {
        userEmail: currentUser.email,
        password: password,
        targetRoomId: roomCode
    });
});

socket.on('auth_error', (msg) => {
    alert(msg);
});

// Room Verification Response
socket.on('room_access_granted', (data) => {
    currentRoomId = data.roomId;
    document.getElementById('current-room-title').innerText = `BaeSpace [${data.roomId}]`;
    document.getElementById('room-status').innerText = 'Connected & Encrypted';
    hideAuthModal();
});

socket.on('room_error', (msg) => {
    alert(msg);
});

// Messaging
function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!currentUser || !currentRoomId) {
        alert('Please log in to your space first.');
        return;
    }

    if (message) {
        socket.emit('send_message', {
            roomId: currentRoomId,
            message,
            userEmail: currentUser.email,
            userName: currentUser.name
        });
        input.value = '';
    }
}

socket.on('receive_message', (data) => {
    const container = document.getElementById('messages-container');
    const msgDiv = document.createElement('div');
    const isSent = currentUser && data.senderEmail === currentUser.email;

    msgDiv.className = `msg ${isSent ? 'sent' : 'received'}`;
    msgDiv.innerHTML = `
        <div>${data.message}</div>
        <span class="timestamp">${data.timestamp}</span>
    `;

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
});