const socket = io();

let currentUser = null;
let currentRoomId = null;
let isSignUpMode = false;

// --- Modal Controls ---
function showAuthModal() {
    document.getElementById('auth-modal').classList.add('active');
}

function hideAuthModal() {
    document.getElementById('auth-modal').classList.remove('active');
}

function toggleAuthMode(e) {
    if (e) e.preventDefault();
    isSignUpMode = !isSignUpMode;

    const btn = document.getElementById('auth-submit-btn');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleLink = document.getElementById('auth-toggle-link');

    if (isSignUpMode) {
        btn.innerText = 'Sign Up';
        btn.setAttribute('onclick', 'handleSignUp()');
        toggleText.innerText = 'Already have an account?';
        if (toggleLink) toggleLink.innerText = 'Log In';
    } else {
        btn.innerText = 'Log In';
        btn.setAttribute('onclick', 'handleLogin()');
        toggleText.innerText = "Don't have an account?";
        if (toggleLink) toggleLink.innerText = 'Sign Up';
    }
}

// --- Keyboard Shortcuts ---
function handleKeyPress(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
}

// --- Auth Handlers ---
function handleSignUp() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;

    if (!email.trim() || !password.trim()) {
        alert('Please fill in both email and password.');
        return;
    }

    socket.emit('user_signup', { email, password });
}

function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const roomCode = document.getElementById('auth-room-code').value;

    if (!email.trim() || !password.trim()) {
        alert('Please enter your credentials.');
        return;
    }

    socket.emit('user_login', { email, password });

    if (roomCode.trim()) {
        currentRoomId = roomCode.trim();
    }
}

// --- Socket Event Handlers ---
socket.on('auth_success', (data) => {
    currentUser = data.user;

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

socket.on('room_access_granted', (data) => {
    currentRoomId = data.roomId;
    document.getElementById('current-room-title').innerText = `BaeSpace [${data.roomId}]`;
    document.getElementById('room-status').innerText = 'Connected & Encrypted';
    hideAuthModal();
});

socket.on('room_error', (msg) => {
    alert(msg);
});

// --- Messaging Handlers ---
function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();

    if (!currentUser || !currentRoomId) {
        alert('Please log in to your space first.');
        showAuthModal();
        return;
    }

    if (message) {
        socket.emit('send_message', {
            roomId: currentRoomId,
            message,
            userEmail: currentUser.email
        });
        input.value = '';
    }
}

// Render message with exact sent vs received alignment check
socket.on('receive_message', (data) => {
    const container = document.getElementById('messages-container');
    const msgDiv = document.createElement('div');

    const currentEmail = currentUser && currentUser.email ? currentUser.email.toLowerCase().trim() : '';
    const senderEmail = data.senderEmail ? data.senderEmail.toLowerCase().trim() : '';

    const isSent = currentEmail !== '' && currentEmail === senderEmail;

    msgDiv.className = `msg ${isSent ? 'sent' : 'received'}`;

    msgDiv.innerHTML = `
        <span class="msg-text">${escapeHTML(data.message)}</span>
        <span class="msg-meta">
            <span class="timestamp">${data.timestamp}</span>
            ${isSent ? '<span class="ticks">✓✓</span>' : ''}
        </span>
    `;

    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
});

// Utility
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}