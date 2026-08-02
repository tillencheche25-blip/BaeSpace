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
        toggleText.innerText = 'Already have an account?';
        toggleLink.innerText = 'Log In';
    } else {
        btn.innerText = 'Log In';
        toggleText.innerText = "Don't have an account?";
        toggleLink.innerText = 'Sign Up';
    }
}

// --- Form Submit Handler ---
function handleAuthSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('auth-email').value.trim().toLowerCase();
    const password = document.getElementById('auth-password').value.trim();

    if (!email || !password) {
        alert('Please fill in both email and password.');
        return;
    }

    if (isSignUpMode) {
        socket.emit('user_signup', { email, password });
    } else {
        socket.emit('user_login', { email, password });
    }
}

// --- Socket Event Handlers ---
socket.on('auth_success', (data) => {
    currentUser = data.user;

    const roomCodeInput = document.getElementById('auth-room-code');
    const roomCode = (roomCodeInput && roomCodeInput.value.trim()) ? roomCodeInput.value.trim() : 'default_room';

    socket.emit('join_partner_room', {
        userEmail: currentUser.email,
        targetRoomId: roomCode
    });
});

socket.on('auth_error', (msg) => {
    alert(msg);
});

socket.on('room_access_granted', (data) => {
    currentRoomId = data.roomId;
    const titleElem = document.getElementById('current-room-title');
    const statusElem = document.getElementById('room-status');

    if (titleElem) titleElem.innerText = `HeartSync [${data.roomId}]`;
    if (statusElem) statusElem.innerText = 'Connected & Encrypted';

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

function handleKeyPress(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
}

socket.on('receive_message', (data) => {
    const container = document.getElementById('messages-container');
    if (!container) return;

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