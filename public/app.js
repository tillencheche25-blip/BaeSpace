// ==========================================
// BAESPACE FRONTEND ENGINE (app.js)
// ==========================================

let socket = null;
let currentUser = null;
let selectedMessageId = null;
let typingTimer = null;

// Helper to determine subject-verb agreement (is vs are)
function getVerb(name) {
    if (!name) return 'is';
    const lower = name.toLowerCase();
    return (lower.includes(' and ') || lower.includes('&')) ? 'are' : 'is';
}

// --- INITIALIZATION & AUTHENTICATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Session persistence removed: Any refresh forces a new login!
    // Make sure any stale storage keys are wiped on load
    localStorage.removeItem('baespace_user');
    sessionStorage.removeItem('baespace_user');

    // Event listener for message input (Enter key)
    const msgInput = document.getElementById('msg-input');
    const sendBtn = document.getElementById('send-btn');

    if (msgInput) {
        msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            } else {
                handleTyping();
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
});

function toggleAuthMode() {
    const pairCodeInput = document.getElementById('auth-paircode');
    const authTitle = document.getElementById('auth-title');
    const authBtn = document.getElementById('auth-btn');
    const toggleLink = document.getElementById('toggle-link');

    if (pairCodeInput.style.display === 'none') {
        pairCodeInput.style.display = 'block';
        authTitle.innerText = 'Create Space 💕';
        authBtn.innerText = 'Sign Up';
        toggleLink.innerText = 'Login';
    } else {
        pairCodeInput.style.display = 'none';
        authTitle.innerText = 'BaeSpace 💕';
        authBtn.innerText = 'Login';
        toggleLink.innerText = 'Sign Up';
    }
}

async function handleAuth() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const pairCode = document.getElementById('auth-paircode').value.trim();
    const isSignUp = document.getElementById('auth-paircode').style.display !== 'none';

    if (!username || !password) {
        alert('Please fill in all required fields.');
        return;
    }

    const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
    const payload = isSignUp ? { username, password, pairCode } : { username, password };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            currentUser = data.user;
            // Memory-only session: No localStorage saving!
            initApp();
        } else {
            alert(data.message || 'Authentication failed');
        }
    } catch (err) {
        console.error('Auth Error:', err);
        alert('Server connection error.');
    }
}

function logout() {
    currentUser = null;
    if (socket) {
        socket.disconnect();
    }
    location.reload();
}

function initApp() {
    // Hide Auth, Show Main App UI
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('main-header').style.display = 'flex';
    document.getElementById('app-viewport').style.display = 'flex';

    const mainNav = document.getElementById('main-nav');
    if (mainNav) mainNav.style.display = 'flex';

    // Populate Profile Details
    const profName = document.getElementById('prof-username');
    const profCode = document.getElementById('prof-paircode');
    if (profName) profName.innerText = currentUser.username;
    if (profCode) profCode.innerText = `Pair Code: ${currentUser.pairCode}`;

    // Connect Socket.IO & Load History
    initSocketConnection();
    fetchChatHistory();
}

// --- SOCKET.IO REAL-TIME LOGIC ---

function initSocketConnection() {
    socket = io();

    // Join room upon login / initial socket connection
    socket.on('connect', () => {
        if (currentUser && currentUser.pairCode) {
            socket.emit('join-room', {
                pairCode: currentUser.pairCode,
                username: currentUser.username
            });
        }
    });

    socket.on('receive-message', (msg) => {
        // Prevent duplicate appending if element with ID already exists
        const existingMsg = document.querySelector(`[data-msg-id="${msg.id || msg._id}"]`);
        if (!existingMsg) {
            appendMessage(msg);
            scrollToBottom();
        }
    });

    socket.on('user-typing', ({ username }) => {
        if (currentUser && username !== currentUser.username) {
            const statusEl = document.getElementById('typing-status');
            const verb = getVerb(username);
            if (statusEl) statusEl.innerText = `${username} ${verb} typing...`;

            if (typingTimer) clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                if (statusEl) statusEl.innerText = '';
            }, 2000);
        }
    });
}

function handleTyping() {
    if (!socket || !currentUser) return;
    socket.emit('typing', { pairCode: currentUser.pairCode, username: currentUser.username });
}

// --- CHAT FUNCTIONS ---

async function fetchChatHistory() {
    if (!currentUser || !currentUser.pairCode) return;

    try {
        const res = await fetch(`/api/chat/${currentUser.pairCode}`);
        if (!res.ok) throw new Error('Failed to fetch history');

        const messages = await res.json();
        const chatBox = document.getElementById('chat-box');
        if (!chatBox) return;

        chatBox.innerHTML = ''; // Clear out prior messages

        if (Array.isArray(messages)) {
            messages.forEach(msg => appendMessage(msg));
        }
        scrollToBottom();
    } catch (err) {
        console.error('Failed to load chat history:', err);
    }
}

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();

    if (!text || !currentUser) return;

    // Create unique ID for the message
    const messageData = {
        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 4),
        pairCode: currentUser.pairCode,
        sender: currentUser.username,
        text: text,
        type: 'text',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Emit to server (Server will broadcast it back to EVERYONE in room)
    socket.emit('send-message', messageData);
    input.value = '';
}

function appendMessage(msg) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    if (msg.type === 'system') {
        const sysEl = document.createElement('div');
        sysEl.className = 'sys-msg';
        sysEl.innerText = msg.text;
        chatBox.appendChild(sysEl);
        return;
    }

    // Determine if message was sent by active user session
    const isSent = currentUser && (msg.sender === currentUser.username);

    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${isSent ? 'sent' : 'received'}`;

    const avatarHtml = msg.avatar ? `<img src="${msg.avatar}" />` : (msg.sender ? msg.sender[0].toUpperCase() : '👤');

    let bodyContent = '';
    if (msg.type === 'image') {
        bodyContent = `<img src="${msg.fileUrl}" alt="Sent photo" onclick="window.open('${msg.fileUrl}', '_blank')" />`;
    } else if (msg.type === 'audio') {
        bodyContent = `<audio controls src="${msg.fileUrl}"></audio>`;
    } else {
        bodyContent = msg.text || '';
    }

    const msgId = msg._id || msg.id || '';

    wrapper.innerHTML = `
        <div class="msg-avatar">${avatarHtml}</div>
        <div class="msg" data-msg-id="${msgId}">
            ${!isSent ? `<span class="sender">${msg.sender}</span>` : ''}
            ${bodyContent}
            <div class="msg-footer">
                <span class="time">${msg.timestamp || ''}</span>
                ${isSent ? `<span class="ticks">✓✓</span>` : ''}
            </div>
        </div>
    `;

    chatBox.appendChild(wrapper);
}

function scrollToBottom() {
    const chatBox = document.getElementById('chat-box');
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
}