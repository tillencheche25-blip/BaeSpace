// Force WebSocket transport connection with automatic retries
const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
});

// Global States
let isLoginMode = true;
let isRecording = false;

// Socket Connection & Automatic Room Sync
socket.on('connect', () => {
    console.log('Connected to server! Socket ID:', socket.id);
    joinCoupleRoom();
});

socket.on('room_joined', (data) => {
    console.log('Active in room:', data.roomId);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

function joinCoupleRoom() {
    const pairCode = localStorage.getItem('bae_pair_code') || 'secret-pair-123';
    socket.emit('join_room', { roomId: pairCode });
}

// Real-Time Chat Listener
socket.on('receive_message', (data) => {
    console.log('Message received from partner:', data);
    appendMessage(data.text, 'received', data.time, data.image);
});

// Real-Time Profile Listener
socket.on('receive_profile_update', (data) => {
    console.log('Profile update received from partner:', data);

    if (data.mood) {
        const moodHeader = document.getElementById('header-mood');
        if (moodHeader) moodHeader.textContent = data.mood;
    }

    if (data.avatar) {
        const headerAvatar = document.getElementById('header-avatar');
        if (headerAvatar) headerAvatar.src = data.avatar;
    }

    if (data.anniversary) {
        const datePicker = document.getElementById('anniversary-picker');
        if (datePicker) datePicker.value = data.anniversary;
    }
});

// Real-Time Room Feature Listeners (Memories, Notes, Dates)
socket.on('receive_memory', (data) => {
    renderMemoryCard(data.caption, data.imageSrc);
});

socket.on('receive_note', (data) => {
    renderNoteCard(data.text, data.date);
});

socket.on('receive_date', (data) => {
    renderDateCard(data.title, data.scheduledTime);
});

// Initialize Emoji Mart Picker
document.addEventListener('DOMContentLoaded', () => {
    try {
        const pickerOptions = {
            onEmojiSelect: (emoji) => {
                const input = document.getElementById('msg-input');
                if (input) input.value += emoji.native;
            }
        };
        const picker = new EmojiMart.Picker(pickerOptions);
        const container = document.getElementById('emoji-picker-container');
        if (container) container.appendChild(picker);
    } catch (e) {
        console.log("Emoji picker ready.");
    }
});

// Auth Flow & Room Allocation
function toggleAuthMode(event) {
    if (event) event.preventDefault();
    isLoginMode = !isLoginMode;

    const title = document.querySelector('.auth-box h2');
    const subtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('auth-btn');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleLink = document.getElementById('auth-toggle-link');
    const pairInput = document.getElementById('auth-pair-code');

    if (!isLoginMode) {
        if (title) title.textContent = "Create Account";
        if (subtitle) subtitle.textContent = "Start sharing moments together";
        if (submitBtn) submitBtn.textContent = "Sign Up";
        if (toggleText) toggleText.textContent = "Already have an account?";
        if (toggleLink) toggleLink.textContent = "Log In";
        if (pairInput) pairInput.style.display = "block";
    } else {
        if (title) title.textContent = "BaeSpace";
        if (subtitle) subtitle.textContent = "Connect privately with your partner";
        if (submitBtn) submitBtn.textContent = "Log In";
        if (toggleText) toggleText.textContent = "Don't have an account?";
        if (toggleLink) toggleLink.textContent = "Sign Up";
        if (pairInput) pairInput.style.display = "none";
    }
}

function handleAuth(event) {
    event.preventDefault();

    const pairInput = document.getElementById('auth-pair-code');
    const pairCode = (pairInput && pairInput.value.trim()) ? pairInput.value.trim() : 'secret-pair-123';

    localStorage.setItem('bae_pair_code', pairCode);
    socket.emit('join_room', { roomId: pairCode });

    const authContainer = document.getElementById('auth-container');
    if (authContainer) authContainer.classList.add('hidden');
}

function logout() {
    const authContainer = document.getElementById('auth-container');
    if (authContainer) authContainer.classList.remove('hidden');
}

function deleteAccount() {
    if (confirm("Are you sure you want to delete your account?")) {
        logout();
    }
}

// Navigation View Switcher
function switchTab(tabName) {
    const screens = document.querySelectorAll('.screen-view');
    screens.forEach(screen => screen.classList.remove('active'));

    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));

    const targetScreen = document.getElementById(`${tabName}-screen`);
    if (targetScreen) targetScreen.classList.add('active');

    const activeNavIndex = ['chat', 'memories', 'notes', 'dates', 'profile'].indexOf(tabName);
    if (activeNavIndex !== -1 && navBtns[activeNavIndex]) {
        navBtns[activeNavIndex].classList.add('active');
    }
}

// Real-Time Messaging Functions
function toggleEmojiPicker() {
    const container = document.getElementById('emoji-picker-container');
    if (container) container.classList.toggle('emoji-picker-hidden');
}

function triggerFileInput() {
    const uploadInput = document.getElementById('image-upload');
    if (uploadInput) uploadInput.click();
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function sendMessage() {
    const input = document.getElementById('msg-input');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    appendMessage(text, 'sent', time);
    socket.emit('send_message', { text, time });

    input.value = '';
    const container = document.getElementById('emoji-picker-container');
    if (container) container.classList.add('emoji-picker-hidden');
}

function uploadImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            appendMessage('', 'sent', time, e.target.result);
            socket.emit('send_message', { text: '', time, image: e.target.result });
        };
        reader.readAsDataURL(file);
    }
}

function appendMessage(text, type, time, imageSrc = null) {
    const msgContainer = document.getElementById('messages-container');
    if (!msgContainer) return;

    const msgElement = document.createElement('div');
    msgElement.className = `msg ${type}`;

    const checkmark = type === 'sent' ? ' <i class="fa-solid fa-check-double read-receipt"></i>' : '';
    let content = '';

    if (imageSrc) {
        content += `<img src="${imageSrc}" alt="Sent image">`;
    }
    if (text) {
        content += `<p>${escapeHtml(text)}</p>`;
    }
    content += `<span class="timestamp">${time}${checkmark}</span>`;

    msgElement.innerHTML = content;
    msgContainer.appendChild(msgElement);
    msgContainer.scrollTop = msgContainer.scrollHeight;
}

function toggleVoiceRecord() {
    const micBtn = document.getElementById('mic-btn');
    isRecording = !isRecording;
    if (isRecording) {
        if (micBtn) micBtn.style.color = '#ea4335';
    } else {
        if (micBtn) micBtn.style.color = '#8696a0';
        alert("Voice note feature processing...");
    }
}

function initiateCall(type) {
    alert(`Starting ${type} call with your partner...`);
}

// Helper Function for Profile Socket Transmission
function syncProfileUpdate(updateData) {
    if (socket.connected) {
        socket.emit('update_profile', updateData);
    } else {
        console.warn('Socket not connected, retrying socket connection...');
        socket.connect();
        setTimeout(() => socket.emit('update_profile', updateData), 500);
    }
}

// Profile Customization
function setMood(emoji) {
    const moodHeader = document.getElementById('header-mood');
    if (moodHeader) moodHeader.textContent = emoji;

    syncProfileUpdate({ mood: emoji });
}

function saveAnniversary(event) {
    const anniversaryDate = event.target.value;
    syncProfileUpdate({ anniversary: anniversaryDate });
}

function triggerAvatarUpload() {
    const avatarInput = document.getElementById('avatar-upload');
    if (avatarInput) avatarInput.click();
}

function uploadCustomAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const avatarData = e.target.result;

            const headerAvatar = document.getElementById('header-avatar');
            const profileAvatar = document.getElementById('profile-avatar');
            if (headerAvatar) headerAvatar.src = avatarData;
            if (profileAvatar) profileAvatar.src = avatarData;

            syncProfileUpdate({ avatar: avatarData });
        };
        reader.readAsDataURL(file);
    }
}

// Modals & Feature Syncing
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

function saveMemory() {
    const captionInput = document.getElementById('memory-caption-input');
    const imageInput = document.getElementById('memory-image-input');
    if (!captionInput) return;

    const caption = captionInput.value;
    if (caption) {
        let imageSrc = `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(caption)}`;

        if (imageInput && imageInput.files && imageInput.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                imageSrc = e.target.result;
                renderMemoryCard(caption, imageSrc);
                socket.emit('add_memory', { caption, imageSrc });
            };
            reader.readAsDataURL(imageInput.files[0]);
        } else {
            renderMemoryCard(caption, imageSrc);
            socket.emit('add_memory', { caption, imageSrc });
        }

        closeModal('memory-modal');
        captionInput.value = '';
        if (imageInput) imageInput.value = '';
    }
}

function renderMemoryCard(caption, imageSrc) {
    const grid = document.getElementById('memory-grid');
    if (grid) {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.innerHTML = `<img src="${imageSrc}" alt="Memory"><p>${escapeHtml(caption)}</p>`;
        grid.appendChild(card);
    }
}

function saveNote() {
    const noteInput = document.getElementById('note-text-input');
    if (!noteInput) return;

    const text = noteInput.value;
    if (text) {
        const date = "Just Now";
        renderNoteCard(text, date);
        socket.emit('add_note', { text, date });

        closeModal('note-modal');
        noteInput.value = '';
    }
}

function renderNoteCard(text, date) {
    const list = document.getElementById('notes-list');
    if (list) {
        const card = document.createElement('div');
        card.className = 'note-card';
        card.innerHTML = `<p class="note-text">${escapeHtml(text)}</p><span class="note-date">${date}</span>`;
        list.appendChild(card);
    }
}

function saveDate() {
    const titleInput = document.getElementById('date-title-input');
    const timeInput = document.getElementById('date-time-input');
    if (!titleInput) return;

    const title = titleInput.value;
    if (title) {
        const scheduledTime = timeInput && timeInput.value ? timeInput.value : "Scheduled";
        renderDateCard(title, scheduledTime);
        socket.emit('add_date', { title, scheduledTime });

        closeModal('date-modal');
        titleInput.value = '';
        if (timeInput) timeInput.value = '';
    }
}

function renderDateCard(title, scheduledTime) {
    const list = document.getElementById('dates-list');
    if (list) {
        const card = document.createElement('div');
        card.className = 'date-card';
        card.innerHTML = `<i class="fa-solid fa-heart date-icon"></i><div><h4>${escapeHtml(title)}</h4><p>${scheduledTime}</p></div>`;
        list.appendChild(card);
    }
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}