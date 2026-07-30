const socket = io();

let currentUser = "";
let currentRoom = "";
let typingTimeout = null;
let pickerInitialized = false;
let isSignUpMode = false;

// AUTH FUNCTIONS

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    const pairCodeInput = document.getElementById('auth-paircode');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const btn = document.getElementById('auth-btn');
    const toggleLink = document.getElementById('toggle-link');

    if (isSignUpMode) {
        pairCodeInput.style.display = 'block';
        title.innerText = 'Create BaeSpace Account';
        subtitle.innerText = 'Choose a Pair Code to share with your partner';
        btn.innerText = 'Sign Up';
        toggleLink.innerText = 'Login';
    } else {
        pairCodeInput.style.display = 'none';
        title.innerText = 'Welcome to BaeSpace 💕';
        subtitle.innerText = 'Login to your private space';
        btn.innerText = 'Login';
        toggleLink.innerText = 'Sign Up';
    }
}

async function handleAuth() {
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const pairCode = document.getElementById('auth-paircode').value.trim();

    const endpoint = isSignUpMode ? '/api/auth/signup' : '/api/auth/login';
    const payload = isSignUpMode ? { username, password, pairCode } : { username, password };

    if (!username || !password || (isSignUpMode && !pairCode)) {
        alert('Please fill in all required fields.');
        return;
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Authentication failed.');
            return;
        }

        // Store session locally
        localStorage.setItem('baespace_token', data.token);
        localStorage.setItem('baespace_user', data.username);
        localStorage.setItem('baespace_pair', data.pairCode);

        enterChatRoom(data.username, data.pairCode);
    } catch (err) {
        alert('Could not connect to the server.');
    }
}

function enterChatRoom(username, room) {
    currentUser = username;
    currentRoom = room;

    socket.emit('join_room', { username: currentUser, room: currentRoom });

    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('chat-interface').style.display = 'flex';
    document.getElementById('logout-btn').style.display = 'inline-block';
    document.getElementById('header-title').innerText = `💕 Pair Room: ${currentRoom}`;

    initEmojiPicker();
}

function logout() {
    localStorage.removeItem('baespace_token');
    localStorage.removeItem('baespace_user');
    localStorage.removeItem('baespace_pair');
    location.reload();
}

// Auto-login on load if token exists
window.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('baespace_user');
    const savedPair = localStorage.getItem('baespace_pair');

    if (savedUser && savedPair) {
        enterChatRoom(savedUser, savedPair);
    }
});

// EMOJI PICKER

function initEmojiPicker() {
    if (pickerInitialized) return;

    const container = document.getElementById('emoji-picker-container');

    const picker = new EmojiMart.Picker({
        onEmojiSelect: (emoji) => {
            const input = document.getElementById('msg-input');
            input.value += emoji.native;
            input.focus();
        },
        theme: 'light',
        set: 'native',
        previewPosition: 'none'
    });

    container.appendChild(picker);
    pickerInitialized = true;
}

function toggleEmojiPicker() {
    const container = document.getElementById('emoji-picker-container');
    if (container.style.display === 'block') {
        container.style.display = 'none';
    } else {
        container.style.display = 'block';
    }
}

document.addEventListener('click', (e) => {
    const container = document.getElementById('emoji-picker-container');
    const emojiBtn = document.getElementById('emoji-btn');
    if (container && emojiBtn) {
        if (!container.contains(e.target) && !emojiBtn.contains(e.target)) {
            container.style.display = 'none';
        }
    }
});

// CHAT FUNCTIONS

function sendMessage() {
    const msgField = document.getElementById('msg-input');
    const message = msgField.value.trim();

    if (!message || !currentRoom) return;

    socket.emit('send_message', {
        room: currentRoom,
        username: currentUser,
        message: message,
        type: 'text'
    });

    msgField.value = '';
    document.getElementById('emoji-picker-container').style.display = 'none';
    socket.emit('stop_typing', { room: currentRoom });
}

function handleTyping() {
    socket.emit('typing', { room: currentRoom, username: currentUser });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop_typing', { room: currentRoom });
    }, 1500);
}

function uploadImage(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        socket.emit('send_message', {
            room: currentRoom,
            username: currentUser,
            message: e.target.result,
            type: 'image'
        });
    };
    reader.readAsDataURL(file);
    input.value = '';
}

// SOCKET LISTENERS

socket.on('user_joined', (data) => {
    appendSystemMessage(data.message);
});

socket.on('user_left', (data) => {
    appendSystemMessage(data.message);
});

socket.on('receive_message', (data) => {
    appendChatMessage(data);
});

socket.on('display_typing', (data) => {
    const statusSpan = document.getElementById('typing-status');
    if (data.username !== currentUser) {
        statusSpan.innerText = `${data.username} is typing...`;
    }
});

socket.on('hide_typing', () => {
    document.getElementById('typing-status').innerText = '';
});

// UI HELPERS

function appendSystemMessage(msgText) {
    const chatBox = document.getElementById('chat-box');
    const sysDiv = document.createElement('div');
    sysDiv.className = 'sys-msg';
    sysDiv.innerText = msgText;
    chatBox.appendChild(sysDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function appendChatMessage(data) {
    const chatBox = document.getElementById('chat-box');
    const msgDiv = document.createElement('div');

    const isSelf = data.username === currentUser;
    msgDiv.className = `msg ${isSelf ? 'sent' : 'received'}`;

    let contentHTML = '';

    if (!isSelf) {
        contentHTML += `<span class="sender">${data.username}</span>`;
    }

    if (data.type === 'image') {
        contentHTML += `<img src="${data.message}" alt="Shared photo" />`;
    } else {
        contentHTML += `<div>${escapeHTML(data.message)}</div>`;
    }

    const ticksHTML = isSelf ? `<span class="ticks">✓✓</span>` : '';
    contentHTML += `
        <div class="msg-footer">
            <span class="time">${data.time}</span>
            ${ticksHTML}
        </div>
    `;

    msgDiv.innerHTML = contentHTML;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}