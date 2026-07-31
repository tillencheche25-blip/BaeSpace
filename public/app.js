// Initialize Socket.io Connection with fallback transports
const socket = io({
    transports: ['websocket', 'polling']
});

// Global States
let isLoginMode = true;
let isRecording = false;

// Socket Connection Debugging & Room Handlers
socket.on('connect', () => {
    console.log('Connected to server with Socket ID:', socket.id);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Real-Time Message Listener
socket.on('receive_message', (data) => {
    console.log('Message received from partner:', data);
    appendMessage(data.text, 'received', data.time, data.image);
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

// Auth Flow Handlers
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

// Navigation Tab Switcher
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

    // 1. Render message locally on your screen
    appendMessage(text, 'sent', time);

    // 2. Emit real-time message via socket server
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
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); me

            // Render locally
            appendMessage('', 'sent', time, e.target.result);

            // Broadcast image to partner
            socket.emit('send_message', { text: '', time, image: e.target.result });
        };
        reader.readAsDataURL(file);
    }
}

// Helper to Append Messages Cleanly
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

// Profile Customizations
function setMood(emoji) {
    const moodHeader = document.getElementById('header-mood');
    if (moodHeader) moodHeader.textContent = emoji;
    alert(`Mood updated to ${emoji}`);
}

function saveAnniversary(event) {
    alert(`Anniversary saved for: ${event.target.value}`);
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
            const headerAvatar = document.getElementById('header-avatar');
            const profileAvatar = document.getElementById('profile-avatar');
            if (headerAvatar) headerAvatar.src = e.target.result;
            if (profileAvatar) profileAvatar.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// Modals
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
    if (!captionInput) return;

    const caption = captionInput.value;
    if (caption) {
        const grid = document.getElementById('memory-grid');
        if (grid) {
            const card = document.createElement('div');
            card.className = 'memory-card';
            card.innerHTML = `<img src="https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(caption)}" alt="Memory"><p>${escapeHtml(caption)}</p>`;
            grid.appendChild(card);
        }
        closeModal('memory-modal');
        captionInput.value = '';
    }
}

function saveNote() {
    const noteInput = document.getElementById('note-text-input');
    if (!noteInput) return;

    const text = noteInput.value;
    if (text) {
        const list = document.getElementById('notes-list');
        if (list) {
            const card = document.createElement('div');
            card.className = 'note-card';
            card.innerHTML = `<p class="note-text">${escapeHtml(text)}</p><span class="note-date">Just Now</span>`;
            list.appendChild(card);
        }
        closeModal('note-modal');
        noteInput.value = '';
    }
}

function saveDate() {
    const titleInput = document.getElementById('date-title-input');
    if (!titleInput) return;

    const title = titleInput.value;
    if (title) {
        const list = document.getElementById('dates-list');
        if (list) {
            const card = document.createElement('div');
            card.className = 'date-card';
            card.innerHTML = `<i class="fa-solid fa-heart date-icon"></i><div><h4>${escapeHtml(title)}</h4><p>Scheduled</p></div>`;
            list.appendChild(card);
        }
        closeModal('date-modal');
        titleInput.value = '';
    }
}

function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}