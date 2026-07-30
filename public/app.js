const socket = io();

let currentUser = "";
let currentRoom = "";
let typingTimeout = null;
let pickerInitialized = false;
let isSignUpMode = false;

// MediaRecorder State
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// Reactions State
let activeMessageForReaction = null;

// Relationship Counter
let relationshipStartDate = null;
let counterInterval = null;

// ================= AUTHENTICATION =================

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
        title.innerText = 'BaeSpace 💕';
        subtitle.innerText = 'Enter your credentials to enter your space';
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

        localStorage.setItem('baespace_token', data.token);
        localStorage.setItem('baespace_user', data.username);
        localStorage.setItem('baespace_pair', data.pairCode);

        enterApp(data.username, data.pairCode);
    } catch (err) {
        alert('Could not connect to the server.');
    }
}

function enterApp(username, room) {
    currentUser = username;
    currentRoom = room;

    socket.emit('join_room', { username: currentUser, room: currentRoom });

    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('main-header').style.display = 'flex';
    document.getElementById('app-viewport').style.display = 'flex';
    document.getElementById('main-nav').style.display = 'flex';

    document.getElementById('header-title').innerText = `Room #${currentRoom}`;
    document.getElementById('prof-username').innerText = currentUser;
    document.getElementById('prof-paircode').innerText = `Pair Code: ${currentRoom}`;

    initEmojiPicker();
    loadAnniversary();
}

function logout() {
    localStorage.removeItem('baespace_token');
    localStorage.removeItem('baespace_user');
    localStorage.removeItem('baespace_pair');
    location.reload();
}

window.addEventListener('DOMContentLoaded', () => {
    const savedUser = localStorage.getItem('baespace_user');
    const savedPair = localStorage.getItem('baespace_pair');

    if (savedUser && savedPair) {
        enterApp(savedUser, savedPair);
    }
});

// ================= EMOJI PICKER =================

function initEmojiPicker() {
    if (pickerInitialized) return;

    const container = document.getElementById('emoji-picker-container');
    const picker = new EmojiMart.Picker({
        onEmojiSelect: (emoji) => {
            const input = document.getElementById('msg-input');
            input.value += emoji.native;
            input.focus();
        },
        theme: 'dark',
        set: 'native',
        previewPosition: 'none'
    });

    container.appendChild(picker);
    pickerInitialized = true;
}

function toggleEmojiPicker() {
    const container = document.getElementById('emoji-picker-container');
    container.style.display = (container.style.display === 'block') ? 'none' : 'block';
}

document.addEventListener('click', (e) => {
    const container = document.getElementById('emoji-picker-container');
    const emojiBtn = document.getElementById('emoji-btn');
    if (container && emojiBtn) {
        if (!container.contains(e.target) && !emojiBtn.contains(e.target)) {
            container.style.display = 'none';
        }
    }

    const reactBar = document.getElementById('reaction-bar');
    if (reactBar && !reactBar.contains(e.target)) {
        reactBar.style.display = 'none';
    }
});

// ================= CHAT LOGIC =================

function sendMessage() {
    const msgField = document.getElementById('msg-input');
    const message = msgField.value.trim();

    if (!message || !currentRoom) return;

    socket.emit('send_message', {
        id: 'msg-' + Date.now(),
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

// 📸 Direct File Image Upload
function uploadImage(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        socket.emit('send_message', {
            id: 'msg-' + Date.now(),
            room: currentRoom,
            username: currentUser,
            message: e.target.result,
            type: 'image'
        });
    };
    reader.readAsDataURL(file);
    input.value = '';
}

// 🎙️ Voice Notes Recording
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
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = () => {
                    socket.emit('send_message', {
                        id: 'msg-' + Date.now(),
                        room: currentRoom,
                        username: currentUser,
                        message: reader.result,
                        type: 'audio'
                    });
                };
            };

            mediaRecorder.start();
            isRecording = true;
            micBtn.classList.add('recording');
        } catch (err) {
            alert('Microphone access denied or unavailable.');
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        micBtn.classList.remove('recording');
    }
}

// 🎭 Reactions Engine
function openReactions(e, msgId) {
    e.preventDefault();
    e.stopPropagation();
    activeMessageForReaction = msgId;

    const bar = document.getElementById('reaction-bar');
    bar.style.display = 'flex';
    bar.style.top = `${e.clientY - 40}px`;
    bar.style.left = `${Math.min(e.clientX, window.innerWidth - 200)}px`;
}

function sendReaction(emoji) {
    if (!activeMessageForReaction) return;
    socket.emit('send_reaction', {
        room: currentRoom,
        messageId: activeMessageForReaction,
        emoji: emoji,
        username: currentUser
    });
    document.getElementById('reaction-bar').style.display = 'none';
}

socket.on('receive_reaction', (data) => {
    const msgEl = document.getElementById(data.messageId);
    if (msgEl) {
        let badge = msgEl.querySelector('.reaction-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'reaction-badge';
            msgEl.appendChild(badge);
        }
        badge.innerText = data.emoji;
    }
});

// SOCKET LISTENERS

socket.on('user_joined', (data) => appendSystemMessage(data.message));
socket.on('receive_message', (data) => appendChatMessage(data));

socket.on('display_typing', (data) => {
    if (data.username !== currentUser) {
        document.getElementById('typing-status').innerText = `${data.username} is typing...`;
    }
});

socket.on('hide_typing', () => {
    document.getElementById('typing-status').innerText = '';
});

socket.on('show_badge', (data) => {
    if (data.category === 'notes') document.getElementById('badge-notes').style.display = 'block';
    if (data.category === 'memories') document.getElementById('badge-memories').style.display = 'block';
});

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
    const msgId = data.id || ('msg-' + Date.now());

    msgDiv.id = msgId;
    msgDiv.className = `msg ${isSelf ? 'sent' : 'received'}`;

    // Attach reaction listeners (double tap or long press contextmenu)
    msgDiv.addEventListener('contextmenu', (e) => openReactions(e, msgId));

    let contentHTML = '';
    if (!isSelf) {
        contentHTML += `<span class="sender">${data.username}</span>`;
    }

    if (data.type === 'image') {
        contentHTML += `<img src="${data.message}" alt="Shared photo" />`;
    } else if (data.type === 'audio') {
        contentHTML += `<audio controls src="${data.message}"></audio>`;
    } else {
        contentHTML += `<div>${escapeHTML(data.message)}</div>`;
    }

    const ticksHTML = isSelf ? `<span class="ticks">✓✓</span>` : '';
    contentHTML += `
        <div class="msg-footer">
            <span class="time">${data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            ${ticksHTML}
        </div>
    `;

    msgDiv.innerHTML = contentHTML;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// ================= MEMORIES FEATURE =================

async function fetchMemories() {
    const res = await fetch(`/api/memories/${currentRoom}`);
    const memories = await res.json();
    const list = document.getElementById('memories-list');
    list.innerHTML = memories.map(m => `
        <div class="card">
            <h4>${escapeHTML(m.title)}</h4>
            ${m.imageUrl ? `<img src="${m.imageUrl}" alt="Memory" />` : ''}
            <p style="margin-top: 6px;">${escapeHTML(m.caption || '')}</p>
        </div>
    `).join('');
}

async function saveMemory() {
    const title = document.getElementById('mem-title').value.trim();
    const fileInput = document.getElementById('mem-file');
    const caption = document.getElementById('mem-caption').value.trim();

    if (!title || !fileInput.files[0]) return alert('Please enter a title and select an image.');

    const reader = new FileReader();
    reader.readAsDataURL(fileInput.files[0]);
    reader.onload = async function () {
        const imageUrl = reader.result;

        await fetch('/api/memories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pairCode: currentRoom, title, imageUrl, caption })
        });

        socket.emit('new_activity_badge', { room: currentRoom, category: 'memories' });

        document.getElementById('mem-title').value = '';
        fileInput.value = '';
        document.getElementById('mem-caption').value = '';
        fetchMemories();
    };
}

// ================= LOVE NOTES FEATURE =================

async function fetchNotes() {
    const res = await fetch(`/api/notes/${currentRoom}`);
    const notes = await res.json();
    const list = document.getElementById('notes-list');
    list.innerHTML = notes.map(n => `
        <div class="card">
            <h4>From: ${escapeHTML(n.author)}</h4>
            <p>${escapeHTML(n.content)}</p>
        </div>
    `).join('');
}

async function saveNote() {
    const content = document.getElementById('note-content').value.trim();
    if (!content) return alert('Please write a note.');

    await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairCode: currentRoom, author: currentUser, content })
    });

    socket.emit('new_activity_badge', { room: currentRoom, category: 'notes' });

    document.getElementById('note-content').value = '';
    fetchNotes();
}

// ================= DATES FEATURE =================

async function fetchDates() {
    const res = await fetch(`/api/dates/${currentRoom}`);
    const dates = await res.json();
    const list = document.getElementById('dates-list');
    list.innerHTML = dates.map(d => `
        <div class="card">
            <h4>${escapeHTML(d.title)}</h4>
            <p>🗓️ ${new Date(d.eventDate).toLocaleDateString()}</p>
        </div>
    `).join('');
}

async function saveDate() {
    const title = document.getElementById('date-title').value.trim();
    const eventDate = document.getElementById('date-value').value;

    if (!title || !eventDate) return alert('Please select a title and date.');

    await fetch('/api/dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairCode: currentRoom, title, eventDate })
    });

    document.getElementById('date-title').value = '';
    document.getElementById('date-value').value = '';
    fetchDates();
}

// ================= MOOD TRACKER =================

async function updateMood(moodText) {
    await fetch('/api/mood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, mood: moodText })
    });

    document.getElementById('current-mood-tag').innerText = moodText.split(' ')[0];
    alert(`Mood updated to: ${moodText}`);
}

// ================= RELATIONSHIP COUNTER =================

function loadAnniversary() {
    const saved = localStorage.getItem(`anniversary_${currentRoom}`);
    if (saved) {
        relationshipStartDate = new Date(saved);
        startCounterTicker();
    }
}

function saveAnniversary() {
    const dateVal = document.getElementById('anniversary-input').value;
    if (!dateVal) return alert('Please choose a date.');

    localStorage.setItem(`anniversary_${currentRoom}`, dateVal);
    relationshipStartDate = new Date(dateVal);

    socket.emit('update_anniversary', { room: currentRoom, startDate: dateVal });
    startCounterTicker();
}

socket.on('anniversary_updated', (data) => {
    localStorage.setItem(`anniversary_${data.room}`, data.startDate);
    relationshipStartDate = new Date(data.startDate);
    startCounterTicker();
});

function startCounterTicker() {
    if (counterInterval) clearInterval(counterInterval);

    const display = document.getElementById('days-together-display');

    function updateDisplay() {
        if (!relationshipStartDate) return;
        const now = new Date();
        const diff = now - relationshipStartDate;

        if (diff < 0) {
            display.innerText = 'Date is in the future!';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diff / (1000 * 60)) % 60);

        display.innerText = `${days} Days, ${hours}h ${mins}m`;
    }

    updateDisplay();
    counterInterval = setInterval(updateDisplay, 60000);
}

// HELPER
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g,
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}