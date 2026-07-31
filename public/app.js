// Global State Tracker
let isLoginMode = true;
let isRecording = false;

// 1. Initialize Emoji Mart Picker
document.addEventListener('DOMContentLoaded', () => {
    try {
        const pickerOptions = {
            onEmojiSelect: (emoji) => {
                const input = document.getElementById('msg-input');
                input.value += emoji.native;
            }
        };
        const picker = new EmojiMart.Picker(pickerOptions);
        document.getElementById('emoji-picker-container').appendChild(picker);
    } catch (e) {
        console.log("Emoji Mart initialized lazily or offline mode.");
    }
});

// 2. Auth Flow Toggle
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
        title.textContent = "Create Account";
        subtitle.textContent = "Start sharing moments together";
        submitBtn.textContent = "Sign Up";
        toggleText.textContent = "Already have an account?";
        toggleLink.textContent = "Log In";
        pairInput.style.display = "block";
    } else {
        title.textContent = "BaeSpace";
        subtitle.textContent = "Connect privately with your partner";
        submitBtn.textContent = "Log In";
        toggleText.textContent = "Don't have an account?";
        toggleLink.textContent = "Sign Up";
    }
}

function handleAuth(event) {
    event.preventDefault();
    // Hide auth screen cleanly using the .hidden class
    document.getElementById('auth-container').classList.add('hidden');
}

function logout() {
    document.getElementById('auth-container').classList.remove('hidden');
}

function deleteAccount() {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
        logout();
    }
}

// 3. Tab Switching Logic
function switchTab(tabName) {
    // Hide all screens
    const screens = document.querySelectorAll('.screen-view');
    screens.forEach(screen => screen.classList.remove('active'));

    // Remove active state from nav buttons
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));

    // Show target screen
    const targetScreen = document.getElementById(`${tabName}-screen`);
    if (targetScreen) targetScreen.classList.add('active');

    // Highlight nav item
    const activeNavIndex = ['chat', 'memories', 'notes', 'dates', 'profile'].indexOf(tabName);
    if (activeNavIndex !== -1 && navBtns[activeNavIndex]) {
        navBtns[activeNavIndex].classList.add('active');
    }
}

// 4. Chat & Messaging Actions
function toggleEmojiPicker() {
    const container = document.getElementById('emoji-picker-container');
    container.classList.toggle('emoji-picker-hidden');
}

function triggerFileInput() {
    document.getElementById('image-upload').click();
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text) return;

    const msgContainer = document.getElementById('messages-container');
    const msgElement = document.createElement('div');
    msgElement.className = 'msg sent';

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    msgElement.innerHTML = `<p>${escapeHtml(text)}</p><span class="timestamp">${time} <i class="fa-solid fa-check"></i></span>`;

    msgContainer.appendChild(msgElement);
    input.value = '';
    msgContainer.scrollTop = msgContainer.scrollHeight;

    // Hide Emoji Picker if open
    document.getElementById('emoji-picker-container').classList.add('emoji-picker-hidden');
}

function uploadImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const msgContainer = document.getElementById('messages-container');
            const msgElement = document.createElement('div');
            msgElement.className = 'msg sent';
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            msgElement.innerHTML = `<img src="${e.target.result}" alt="Uploaded image"><span class="timestamp">${time}</span>`;
            msgContainer.appendChild(msgElement);
            msgContainer.scrollTop = msgContainer.scrollHeight;
        };
        reader.readAsDataURL(file);
    }
}

function toggleVoiceRecord() {
    const micBtn = document.getElementById('mic-btn');
    isRecording = !isRecording;
    if (isRecording) {
        micBtn.style.color = '#ea4335'; // Red color when recording
    } else {
        micBtn.style.color = '#8696a0';
        alert("Voice note recording saved!");
    }
}

function initiateCall(type) {
    alert(`Starting ${type} call with your partner...`);
}

// 5. Profile & Mood Customization
function setMood(emoji) {
    document.getElementById('header-mood').textContent = emoji;
    alert(`Mood updated to ${emoji}`);
}

function saveAnniversary(event) {
    alert(`Anniversary saved for: ${event.target.value}`);
}

function triggerAvatarUpload() {
    document.getElementById('avatar-upload').click();
}

function uploadCustomAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('header-avatar').src = e.target.result;
            document.getElementById('profile-avatar').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// 6. Modal Functions
function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function saveMemory() {
    const caption = document.getElementById('memory-caption-input').value;
    if (caption) {
        const grid = document.getElementById('memory-grid');
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.innerHTML = `<img src="https://via.placeholder.com/150" alt="Memory"><p>${escapeHtml(caption)}</p>`;
        grid.appendChild(card);
        closeModal('memory-modal');
        document.getElementById('memory-caption-input').value = '';
    }
}

function saveNote() {
    const text = document.getElementById('note-text-input').value;
    if (text) {
        const list = document.getElementById('notes-list');
        const card = document.createElement('div');
        card.className = 'note-card';
        card.innerHTML = `<p class="note-text">${escapeHtml(text)}</p><span class="note-date">Just Now</span>`;
        list.appendChild(card);
        closeModal('note-modal');
        document.getElementById('note-text-input').value = '';
    }
}

function saveDate() {
    const title = document.getElementById('date-title-input').value;
    if (title) {
        const list = document.getElementById('dates-list');
        const card = document.createElement('div');
        card.className = 'date-card';
        card.innerHTML = `<i class="fa-solid fa-heart date-icon"></i><div><h4>${escapeHtml(title)}</h4><p>Scheduled</p></div>`;
        list.appendChild(card);
        closeModal('date-modal');
        document.getElementById('date-title-input').value = '';
    }
}

// Helper to sanitize inputs
function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}