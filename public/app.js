const socket = io();
let currentUser = null;
let currentRoom = null;
let currentPassword = null;
let selectedImageData = null;
let sharedMemories = [];
let bucketList = [];

// Safe Splash Screen Hide
function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.style.transition = 'opacity 0.5s ease';
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 500);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(hideSplashScreen, 500));
} else {
    setTimeout(hideSplashScreen, 500);
}

// Mobile Keyboard / Viewport adjustment listeners
window.addEventListener('resize', () => {
    const container = document.getElementById('messages-container');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('focus', () => {
            setTimeout(() => {
                const container = document.getElementById('messages-container');
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            }, 300);
        });
    }
});

// Re-join room on Socket Reconnection
socket.on('connect', () => {
    if (currentUser && currentRoom && currentPassword) {
        socket.emit('join-room', {
            email: currentUser,
            password: currentPassword,
            roomCode: currentRoom
        });
    }
});

// Dropdown Menu Handlers
function toggleHeaderMenu(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('header-dropdown');
    if (dropdown) dropdown.classList.toggle('show');
}

window.addEventListener('click', (e) => {
    const dropdown = document.getElementById('header-dropdown');
    const menuBtn = document.getElementById('menu-btn');
    if (dropdown && dropdown.classList.contains('show')) {
        if (!dropdown.contains(e.target) && e.target !== menuBtn) {
            dropdown.classList.remove('show');
        }
    }
});

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// 1. Profile Option
function openProfileModal() {
    toggleHeaderMenu();
    document.getElementById('profile-email-display').textContent = currentUser || 'Not Logged In';
    document.getElementById('profile-room-display').textContent = currentRoom || 'None';
    document.getElementById('profile-modal').style.display = 'flex';
}

// 2. Memories Gallery Option
function openMemoriesModal() {
    toggleHeaderMenu();
    renderMemories();
    document.getElementById('memories-modal').style.display = 'flex';
}

function renderMemories() {
    const grid = document.getElementById('memories-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (sharedMemories.length === 0) {
        grid.innerHTML = '<div class="empty-state">No photos shared in this room yet!</div>';
        return;
    }

    sharedMemories.forEach(imgUrl => {
        const img = document.createElement('img');
        img.src = imgUrl;
        img.className = 'memory-thumb';
        grid.appendChild(img);
    });
}

// 3. Bucket List Option
function openBucketListModal() {
    toggleHeaderMenu();
    renderBucketList();
    document.getElementById('bucketlist-modal').style.display = 'flex';
}

function addBucketItem() {
    const input = document.getElementById('bucket-input');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    const item = { id: Date.now(), text, completed: false };
    bucketList.push(item);
    input.value = '';

    socket.emit('update-bucket', { room: currentRoom, bucketList });
    renderBucketList();
}

function toggleBucketItem(id) {
    bucketList = bucketList.map(item => item.id === id ? { ...item, completed: !item.completed } : item);
    socket.emit('update-bucket', { room: currentRoom, bucketList });
    renderBucketList();
}

function renderBucketList() {
    const container = document.getElementById('bucket-list-container');
    if (!container) return;
    container.innerHTML = '';

    if (bucketList.length === 0) {
        container.innerHTML = '<li style="justify-content:center; color:#888;">No goals added yet!</li>';
        return;
    }

    bucketList.forEach(item => {
        const li = document.createElement('li');
        li.className = item.completed ? 'completed' : '';
        li.innerHTML = `
            <span>${escapeHtml(item.text)}</span>
            <input type="checkbox" ${item.completed ? 'checked' : ''} onclick="toggleBucketItem(${item.id})">
        `;
        container.appendChild(li);
    });
}

// 4. Clear Local Chat Option
function clearLocalChat() {
    toggleHeaderMenu();
    if (confirm('Clear message history from your screen?')) {
        const container = document.getElementById('messages-container');
        if (container) container.innerHTML = '';
    }
}

// 5. Logout Option
function logoutUser() {
    toggleHeaderMenu();
    if (confirm('Are you sure you want to log out?')) {
        currentUser = null;
        currentRoom = null;
        currentPassword = null;
        sharedMemories = [];
        bucketList = [];

        const container = document.getElementById('messages-container');
        if (container) container.innerHTML = '';
        showAuthModal();
    }
}

// Login Handler
function handleAuthSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const roomCode = document.getElementById('auth-room-code').value.trim().toLowerCase();
    const submitBtn = document.getElementById('auth-submit-btn');

    if (!email || !password || !roomCode) {
        alert('Please complete all fields.');
        return;
    }

    submitBtn.textContent = 'Verifying...';
    submitBtn.disabled = true;

    socket.emit('join-room', { email, password, roomCode }, (response) => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Join Room';

        if (response && response.success) {
            currentUser = email;
            currentRoom = response.roomCode;
            currentPassword = password;

            document.getElementById('auth-modal').style.display = 'none';
            document.getElementById('current-room-title').textContent = `Room: ${currentRoom}`;
            document.getElementById('messages-container').innerHTML = '';
        } else {
            alert(response?.message || 'Access denied!');
        }
    });
}

function showAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'flex';
}

function handleKeyPress(e) {
    if (e.key === 'Enter') sendMessage();
}

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
    const input = document.getElementById('file-input');
    if (input) input.value = '';
    const bar = document.getElementById('image-preview-bar');
    if (bar) bar.style.display = 'none';
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input ? input.value.trim() : '';

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

    if (selectedImageData) {
        sharedMemories.push(selectedImageData);
    }

    socket.emit('send-message', msgData);
    appendMessage(msgData, 'sent');

    if (input) input.value = '';
    clearSelectedImage();
}

function appendMessage(msg, direction) {
    const container = document.getElementById('messages-container');
    if (!container) return;

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
    if (msg.image) {
        sharedMemories.push(msg.image);
    }
    appendMessage(msg, 'received');
});

socket.on('sync-bucket', (data) => {
    if (data && data.bucketList) {
        bucketList = data.bucketList;
        const modal = document.getElementById('bucketlist-modal');
        if (modal && modal.style.display === 'flex') {
            renderBucketList();
        }
    }
});

socket.on('message-read', ({ msgId }) => {
    const msgEl = document.querySelector(`[data-id="${msgId}"] .read-receipt`);
    if (msgEl) msgEl.textContent = '✓✓';
});

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}