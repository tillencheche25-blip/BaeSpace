// --- STATE & GLOBAL VARIABLES ---
const socket = io();
let currentUser = null;
let currentPairCode = null;
let selectedMsgIdForReaction = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// --- DOM ELEMENTS ---
const authContainer = document.getElementById('auth-container');
const appViewport = document.getElementById('app-viewport');
const mainHeader = document.getElementById('main-header');
const mainNav = document.getElementById('main-nav');

const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authUsername = document.getElementById('auth-username');
const authPassword = document.getElementById('auth-password');
const authPaircode = document.getElementById('auth-paircode');
const authBtn = document.getElementById('auth-btn');
const toggleLink = document.getElementById('toggle-link');

const chatBox = document.getElementById('chat-box');
const msgInput = document.getElementById('msg-input');
const sendBtn = document.getElementById('send-btn');
const reactionBar = document.getElementById('reaction-bar');

let isSignUp = false;

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    checkSavedSession();
    setupEventListeners();
});

function setupEventListeners() {
    sendBtn.addEventListener('click', sendMessage);
    msgInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Typing indicator events
    msgInput.addEventListener('input', () => {
        if (currentPairCode) {
            socket.emit('typing', { pairCode: currentPairCode, username: currentUser.username });
        }
    });

    // Dismiss reaction bar on click outside
    document.addEventListener('click', (e) => {
        if (!reactionBar.contains(e.target) && !e.target.classList.contains('msg')) {
            reactionBar.style.display = 'none';
        }
    });
}

// --- AUTHENTICATION LOGIC ---
function toggleAuthMode() {
    isSignUp = !isSignUp;
    if (isSignUp) {
        authTitle.innerText = "Join BaeSpace 💕";
        authSubtitle.innerText = "Create an account and connect with your partner";
        authPaircode.style.display = "block";
        authBtn.innerText = "Sign Up";
        toggleLink.innerText = "Login";
        toggleLink.parentElement.childNodes[0].nodeValue = "Already have an account? ";
    } else {
        authTitle.innerText = "BaeSpace 💕";
        authSubtitle.innerText = "Enter your credentials to enter your space";
        authPaircode.style.display = "none";
        authBtn.innerText = "Login";
        toggleLink.innerText = "Sign Up";
        toggleLink.parentElement.childNodes[0].nodeValue = "Don't have an account? ";
    }
}

async function handleAuth() {
    const username = authUsername.value.trim();
    const password = authPassword.value.trim();
    const pairCode = authPaircode.value.trim();

    if (!username || !password) {
        alert("Please enter both username and password.");
        return;
    }

    const endpoint = isSignUp ? '/api/register' : '/api/login';
    const payload = isSignUp ? { username, password, pairCode } : { username, password };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('baespace_user', JSON.stringify(data.user));
            initAppSession(data.user);
        } else {
            alert(data.message || 'Authentication failed.');
        }
    } catch (err) {
        console.error('Auth error:', err);
        alert('Server connection error.');
    }
}

function checkSavedSession() {
    const savedUser = localStorage.getItem('baespace_user');
    if (savedUser) {
        initAppSession(JSON.parse(savedUser));
    }
}

function initAppSession(user) {
    currentUser = user;
    currentPairCode = user.pairCode;

    // IMPORTANT: Hide auth container smoothly using display: none
    authContainer.style.setProperty('display', 'none', 'important');
    appViewport.style.display = 'flex';
    mainHeader.style.display = 'flex';
    mainNav.style.display = 'flex';

    // Populate profile details
    document.getElementById('prof-username').innerText = user.username;
    document.getElementById('prof-paircode').innerText = `Pair Code: ${user.pairCode}`;
    if (user.avatar) updateAvatarUI(user.avatar);
    if (user.anniversaryDate) calculateAnniversary(user.anniversaryDate);

    // Socket Connection
    socket.emit('join-room', { pairCode: user.pairCode, username: user.username });

    // Load initial chat history
    fetchChatHistory();
}

function logout() {
    localStorage.removeItem('baespace_user');
    window.location.reload();
}

// --- CHAT MESSAGING ---
async function fetchChatHistory() {
    try {
        const res = await fetch(`/api/messages/${currentPairCode}`);
        const messages = await res.json();
        chatBox.innerHTML = '';
        messages.forEach(renderMessage);
        scrollToBottom();
    } catch (err) {
        console.error('Error loading chat history:', err);
    }
}

function sendMessage() {
    const text = msgInput.value.trim();
    if (!text) return;

    const msgData = {
        pairCode: currentPairCode,
        sender: currentUser.username,
        text: text,
        type: 'text',
        timestamp: new Date().toISOString()
    };

    socket.emit('send-message', msgData);
    msgInput.value = '';
}

socket.on('receive-message', (msg) => {
    renderMessage(msg);
    scrollToBottom();
});

function renderMessage(msg) {
    const isSent = msg.sender === currentUser.username;
    const wrapper = document.createElement('div');
    wrapper.className = `msg-wrapper ${isSent ? 'sent' : 'received'}`;
    wrapper.id = `msg-${msg._id || msg.timestamp}`;

    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let contentHtml = '';
    if (msg.type === 'image') {
        contentHtml = `<img src="${msg.mediaUrl}" alt="Shared Image" />`;
    } else if (msg.type === 'audio') {
        contentHtml = `<audio controls src="${msg.mediaUrl}"></audio>`;
    } else {
        contentHtml = `<span>${escapeHtml(msg.text)}</span>`;
    }

    const reactionHtml = msg.reaction ? `<div class="reaction-badge">${msg.reaction}</div>` : '';

    wrapper.innerHTML = `
        <div class="msg-avatar">${msg.sender.charAt(0).toUpperCase()}</div>
        <div class="msg" onclick="showReactions(event, '${msg._id || msg.timestamp}')">
            ${!isSent ? `<span class="sender">${escapeHtml(msg.sender)}</span>` : ''}
            ${contentHtml}
            <div class="msg-footer">
                <span class="time">${time}</span>
                ${isSent ? '<span class="ticks">✓✓</span>' : ''}
            </div>
            ${reactionHtml}
        </div>
    `;

    chatBox.appendChild(wrapper);
}

function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

// --- MEDIA UPLOADS (IMAGES & AUDIO) ---
async function uploadImage(input) {
    if (!input.files || !input.files[0]) return;
    const formData = new FormData();
    formData.append('file', input.files[0]);

    try {
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.url) {
            socket.emit('send-message', {
                pairCode: currentPairCode,
                sender: currentUser.username,
                type: 'image',
                mediaUrl: data.url,
                timestamp: new Date().toISOString()
            });
        }
    } catch (err) {
        alert('Failed to upload image.');
    }
}

async function toggleVoiceRecord() {
    const micBtn = document.getElementById('mic-btn');

    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const formData = new FormData();
                formData.append('file', audioBlob, 'voice-note.webm');

                const res = await fetch('/api/upload', { method: 'POST', body: formData });
                const data = await res.json();

                if (data.url) {
                    socket.emit('send-message', {
                        pairCode: currentPairCode,
                        sender: currentUser.username,
                        type: 'audio',
                        mediaUrl: data.url,
                        timestamp: new Date().toISOString()
                    });
                }
            };

            mediaRecorder.start();
            isRecording = true;
            micBtn.classList.add('recording');
        } catch (err) {
            alert('Microphone access denied or unsupported.');
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        micBtn.classList.remove('recording');
    }
}

// --- MESSAGE REACTIONS ---
function showReactions(event, msgId) {
    selectedMsgIdForReaction = msgId;
    const rect = event.currentTarget.getBoundingClientRect();
    reactionBar.style.top = `${rect.top - 45}px`;
    reactionBar.style.left = `${Math.min(rect.left, window.innerWidth - 220)}px`;
    reactionBar.style.display = 'flex';
}

function sendReaction(emoji) {
    if (!selectedMsgIdForReaction) return;
    socket.emit('add-reaction', {
        pairCode: currentPairCode,
        msgId: selectedMsgIdForReaction,
        reaction: emoji
    });
    reactionBar.style.display = 'none';
}

socket.on('update-reaction', ({ msgId, reaction }) => {
    const msgElement = document.getElementById(`msg-${msgId}`);
    if (msgElement) {
        let badge = msgElement.querySelector('.reaction-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'reaction-badge';
            msgElement.querySelector('.msg').appendChild(badge);
        }
        badge.innerText = reaction;
    }
});

// --- EMOJI PICKER ---
function toggleEmojiPicker() {
    const container = document.getElementById('emoji-picker-container');
    if (container.style.display === 'block') {
        container.style.display = 'none';
    } else {
        if (!container.hasChildNodes()) {
            const picker = new EmojiMart.Picker({
                onEmojiSelect: (emoji) => {
                    msgInput.value += emoji.native;
                    container.style.display = 'none';
                }
            });
            container.appendChild(picker);
        }
        container.style.display = 'block';
    }
}

// --- MEMORIES, NOTES & DATES ---
async function fetchMemories() {
    const res = await fetch(`/api/memories/${currentPairCode}`);
    const memories = await res.json();
    const container = document.getElementById('memories-list');
    container.innerHTML = memories.map(m => `
        <div class="card">
            <h4>${escapeHtml(m.title)}</h4>
            <p>${escapeHtml(m.caption || '')}</p>
            ${m.imageUrl ? `<img src="${m.imageUrl}" />` : ''}
        </div>
    `).join('');
}

async function saveMemory() {
    const title = document.getElementById('mem-title').value;
    const caption = document.getElementById('mem-caption').value;
    const fileInput = document.getElementById('mem-file');

    if (!title) return alert('Memory title required');

    let imageUrl = '';
    if (fileInput.files[0]) {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        imageUrl = uploadData.url;
    }

    await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairCode: currentPairCode, title, caption, imageUrl })
    });

    document.getElementById('mem-title').value = '';
    document.getElementById('mem-caption').value = '';
    fetchMemories();
}

async function fetchNotes() {
    const res = await fetch(`/api/notes/${currentPairCode}`);
    const notes = await res.json();
    const container = document.getElementById('notes-list');
    container.innerHTML = notes.map(n => `
        <div class="card">
            <p>"${escapeHtml(n.content)}"</p>
            <span style="font-size: 0.75rem; color: #00a884;">- ${escapeHtml(n.author)}</span>
        </div>
    `).join('');
}

async function saveNote() {
    const content = document.getElementById('note-content').value.trim();
    if (!content) return;

    await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairCode: currentPairCode, author: currentUser.username, content })
    });

    document.getElementById('note-content').value = '';
    fetchNotes();
}

async function fetchDates() {
    const res = await fetch(`/api/dates/${currentPairCode}`);
    const dates = await res.json();
    const container = document.getElementById('dates-list');
    container.innerHTML = dates.map(d => `
        <div class="card">
            <h4>${escapeHtml(d.title)}</h4>
            <p>📅 ${new Date(d.date).toLocaleDateString()}</p>
        </div>
    `).join('');
}

async function saveDate() {
    const title = document.getElementById('date-title').value;
    const date = document.getElementById('date-value').value;

    if (!title || !date) return alert('Please enter title and date');

    await fetch('/api/dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairCode: currentPairCode, title, date })
    });

    document.getElementById('date-title').value = '';
    document.getElementById('date-value').value = '';
    fetchDates();
}

// --- MOOD & ANNIVERSARY COUNTER ---
function updateMood(moodText) {
    document.getElementById('current-mood-tag').innerText = moodText.split(' ')[0];
    socket.emit('update-mood', { pairCode: currentPairCode, username: currentUser.username, mood: moodText });
    alert(`Mood updated to: ${moodText}`);
}

function saveAnniversary() {
    const dateVal = document.getElementById('anniversary-input').value;
    if (!dateVal) return;

    calculateAnniversary(dateVal);
    // Persist date locally/backend
    currentUser.anniversaryDate = dateVal;
    localStorage.setItem('baespace_user', JSON.stringify(currentUser));
}

function calculateAnniversary(startDateStr) {
    const start = new Date(startDateStr);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    document.getElementById('days-together-display').innerText = `${diffDays} Days ❤️`;
}

function updateAvatarUI(avatarSrc) {
    const avatarContainer = document.getElementById('profile-avatar-display');
    if (avatarSrc.length <= 3) {
        avatarContainer.innerHTML = avatarSrc;
    } else {
        avatarContainer.innerHTML = `<img src="${avatarSrc}" />`;
    }
}

function setEmojiAvatar(emoji) {
    updateAvatarUI(emoji);
}

function escapeHtml(text) {
    return text ? text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
}