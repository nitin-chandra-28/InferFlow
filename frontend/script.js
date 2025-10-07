// Modern frontend interactions for InferBot
import { CHAT_CONFIG } from './config.js';

const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const chatContainer = document.getElementById('chat-container');
const messageTemplate = document.getElementById('message-template');
const sendBtn = document.getElementById('send-btn');
const themeToggle = document.getElementById('theme-toggle');
const brandLogo = document.getElementById('brand-logo');
const brandTitle = document.getElementById('brand-title');

const API_ENDPOINT = 'https://inferflow.onrender.com/chat';

// Set brand/logo from config
if (brandLogo && CHAT_CONFIG.bot.avatar) {
    if (/^https?:\/\//.test(CHAT_CONFIG.bot.avatar)) {
        brandLogo.innerHTML = `<img src="${CHAT_CONFIG.bot.avatar}" alt="Bot" />`;
    } else {
        brandLogo.textContent = CHAT_CONFIG.bot.avatar;
    }
}
if (brandTitle && CHAT_CONFIG.bot.brand) {
    brandTitle.textContent = CHAT_CONFIG.bot.brand;
}

// helpers
function timeNow() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function createMessageEl({role = 'bot', text = '', meta = ''} = {}) {
    const tpl = messageTemplate.content.cloneNode(true);
    const row = tpl.querySelector('.message-row');
    row.classList.toggle('user', role === 'user');
    const avatar = tpl.querySelector('.avatar');
    const conf = CHAT_CONFIG[role] || {};
    if (conf.avatar) {
        if (/^https?:\/\//.test(conf.avatar)) {
            avatar.innerHTML = `<img src="${conf.avatar}" alt="${conf.name || role}" />`;
        } else {
            avatar.textContent = conf.avatar;
        }
    } else {
        avatar.textContent = role === 'user' ? 'You' : 'Bot';
    }
    const bubble = tpl.querySelector('.message-bubble');
    bubble.classList.toggle('user', role === 'user');
    tpl.querySelector('.message-text').textContent = text;
    tpl.querySelector('.ts').textContent = meta || timeNow();
    const el = tpl.firstElementChild;
    chatContainer.appendChild(el);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return el;
}

function appendTyping() {
    const el = createMessageEl({ role: 'bot', text: '' });
    const bubble = el.querySelector('.message-bubble');
    bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
    return el;
}

function replaceBubbleText(el, text) {
    const bubble = el.querySelector('.message-bubble');
    bubble.querySelector('.message-text')?.remove();
    bubble.innerHTML = `<div class="message-text">${escapeHtml(text)}</div><div class="message-meta"><time class="ts">${timeNow()}</time></div>`;
}

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// auto-resize textarea
function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

messageInput.addEventListener('input', () => autoResize(messageInput));

// theme toggle (persist in localStorage)
function setTheme(theme) {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('inferbot-theme', theme);
}
themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.classList.contains('light') ? 'light' : 'dark';
    setTheme(cur === 'light' ? 'dark' : 'light');
});
// init theme
setTheme(localStorage.getItem('inferbot-theme') || 'dark');

// main submit handler
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    // lock UI
    sendBtn.disabled = true;
    messageInput.value = '';
    autoResize(messageInput);

    // show user message
    createMessageEl({ role: 'user', text, meta: timeNow() });

    // typing indicator
    const typingEl = appendTyping();

    try {
        const resp = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        if (!resp.ok) throw new Error('Network response not ok');

        // attempt to stream text if server supports it, otherwise fallback to json
        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const data = await resp.json();
            const reply = (data.reply || '').split(text).pop().trim();
            replaceBubbleText(typingEl, reply || '');
        } else {
            // stream reader
            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let accumulated = '';
            while (!done) {
                const { value, done: d } = await reader.read();
                done = d;
                if (value) {
                    accumulated += decoder.decode(value, { stream: !done });
                    replaceBubbleText(typingEl, accumulated);
                }
            }
        }

    } catch (err) {
        console.error(err);
        replaceBubbleText(typingEl, 'Sorry, something went wrong.');
    } finally {
        sendBtn.disabled = false;
        messageInput.focus();
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
});

// small keyboard shortcut: Enter to send, Shift+Enter for newline
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.requestSubmit();
    }
});

// initial welcome message
createMessageEl({ role: 'bot', text: `Hi — I'm ${CHAT_CONFIG.bot.name}. Ask me anything!`, meta: timeNow() });
