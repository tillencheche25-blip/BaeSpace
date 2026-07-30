// 1. Initialize socket connection first to avoid ReferenceError
const socket = io();

let currentUser = "";
let currentRoom = "";
let typingTimeout = null;

// 2. JOIN ROOM FUNCTION
function joinRoom() {
    const usernameField = document.getElementById('username-input');
    const roomField = document.getElementById('room-input');

    currentUser = usernameField.value.trim();
    currentRoom = roomField.value.trim();

    if (!currentUser || !currentRoom) {
        alert("Please enter both your name and a room ID.");
        return;
    }

    // Emit object payload
    socket.emit('join_room', {
        username: currentUser,
        room: currentRoom
    });

    // Switch view
    document.getElementById('room-selection').style.display = 'none';
    document.getElementById('chat-interface').style.display = 'flex';
    document.getElementById('header-title').innerText = `Room: ${currentRoom}`;
}

// 3. SEND MESSAGE FUNCTION
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
    socket.emit('stop_typing', { room: currentRoom });
}

// 4. TYPING HANDLER
function handleTyping() {
    socket.emit('typing', { room: currentRoom, username: currentUser });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop_typing', { room: currentRoom });
    }, 1500);
}

// 5. IMAGE UPLOAD HANDLER
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

// ==========================================
// SOCKET EVENT LISTENERS
// ==========================================

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

// ==========================================
// DOM RENDER HELPERS
// ==========================================

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
        contentHTML += `<img src="${data.message}" alt="Uploaded image" />`;
    } else {
        contentHTML += `<div>${escapeHTML(data.message)}</div>`;
    }

    contentHTML += `<span class="time">${data.time}</span>`;

    msgDiv.innerHTML = contentHTML;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}