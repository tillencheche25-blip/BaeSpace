const socket = io();
let currentUser = null;
let currentRoom = null;
let selectedImageData = null;

// Hide Splash Screen
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.style.display = 'none', 500);
        }
    }, 1000);
});

// Join Room Handler
function handleAuthSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const roomCode = document.getElementById('auth-room-code').value;
    const submitBtn = document.getElementById('auth-submit-btn');

    if (!email || !password || !roomCode) {
        alert('Please complete all fields.');
        return;
    }

    submitBtn.textContent = 'Verifying...';
    submitBtn.disabled = true;

    // Send join request with callback
    socket.emit('join-room', { email, password, roomCode }, (response) => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Join Room';

        if (response && response.success) {
            currentUser = email;
            currentRoom = response.roomCode;

            document.getElementById('auth-modal').style.display = 'none';
            document.getElementById('current-room-title').textContent = `Room: ${currentRoom}`;
            document.getElementById('messages-container').innerHTML = ''; // Clear previous messages
        } else {
            alert(response?.message || 'Access denied! Check your password.');
        }
    });
}

function showAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
}

function handleKeyPress(e) {
    if (e.key === 'Enter') sendMessage();
}

// Handle Image File Selection
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        selectedImageData = event.target.result;
        document.getElementById('image-preview').src = selectedImageData;
        document.getElementById('image-preview-bar').style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

function clearSelectedImage() {
    selectedImageData = null;
    document.getElementById('file-input').value = '';
    document.getElementById('image-preview-bar').style.display = 'none';
}

// Send Message
function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();

    if (!text && !selectedImageData) return;
    if (!currentRoom) {
        showAuthModal();
        return;
    }

    const msgData = {
        id: Date.now().toString(),
        sender: currentUser,
        room: currentRoom,
        text: text,
        image: selectedImageData,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false
    };

    socket.emit('send-message', msgData);
    appendMessage(msgData, 'sent');

    input.value = '';
    clearSelectedImage();
}

// Render Messages
function appendMessage(msg, direction) {
    const container = document.getElementById('messages-container');
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${direction}`;
    wrapper.dataset.id = msg.id;

    let contentHtml = '';
    if (msg.image) {
        contentHtml += `<img src="${msg.image}" class="message-img" alt="Attachment">`;
    }
    if (msg.text) {
        contentHtml += `<div class="message-bubble">${escapeHtml(msg.text)}</div>`;
    }

    const readStatus = direction === 'sent'
        ? `<span class="read-receipt">${msg.read ? '✓✓' : '✓'}</span>`
        : '';

    wrapper.innerHTML = `
        ${contentHtml}
        <div class="message-meta">
            <span>${msg.time}</span>
            ${readStatus}
        </div>
    `;

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;

    if (direction === 'received') {
        socket.emit('mark-read', { msgId: msg.id, room: currentRoom });
    }
}

// Socket Listeners
socket.on('receive-message', (msg) => {
    appendMessage(msg, 'received');
});

socket.on('message-read', ({ msgId }) => {
    const msgEl = document.querySelector(`[data-id="${msgId}"] .read-receipt`);
    if (msgEl) {
        msgEl.textContent = '✓✓';
    }
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}