// ════════════════════════════════════════
//  NYAY LEKHAK — Script (Redesigned UI)
// ════════════════════════════════════════

// ── Application State ──
let appState = {
    caseTitle: '',
    caseNumber: '',
    suspectName: '',
    selectedLanguages: [],
    transcripts: []
};

// ── Recognition State ──
let recognition = null;
let isRecording = false;
let isPaused = false;
let currentTranscriptBubble = null;

// ── Timer State ──
let sessionStart = null;
let timerInterval = null;

// ── Initialize Web Speech API ──
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function initRecognition() {
    if (!SpeechRecognition) {
        showNotification("⚠️ Browser not supported. Please use Google Chrome.", "error");
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = function () {
        document.getElementById('recordingStatus').textContent = 'Recording';
        document.getElementById('recordingStatus').className = 'status-label recording';
        document.getElementById('statusRing').className = 'status-ring recording';
        document.getElementById('liveDot').className = 'live-dot active';
    };

    recognition.onresult = function (event) {
        let interimTranscript = '';
        let finalTranscriptPiece = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscriptPiece += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        if (finalTranscriptPiece) {
            commitTranscriptBubble(finalTranscriptPiece);
        } else if (interimTranscript) {
            updateInterimBubble(interimTranscript);
        }
    };

    recognition.onerror = function (event) {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
            showNotification("Microphone access denied. Please allow microphone access.", "error");
            stopRecording();
        }
    };

    recognition.onend = function () {
        if (isRecording && !isPaused) {
            try { recognition.start(); } catch (e) { console.error("Could not restart recognition:", e); }
        }
    };
}

// ── Keyword Formatter ──
function formatText(text) {
    const keywords = ['objection', 'guilty', 'evidence', 'overruled', 'sustained', 'verdict', 'bail', 'accused', 'witness', 'petition'];
    const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
    return text.replace(regex, '<span class="keyword-highlight">$1</span>');
}

// ── Current Speaker Helpers ──
function getActiveSpeaker() {
    const activeTab = document.querySelector('.speaker-tab.active');
    if (activeTab) return activeTab.dataset.role;
    return document.getElementById('speakerSelect').value;
}

function getActiveSpeakerLabel() {
    const activeTab = document.querySelector('.speaker-tab.active');
    const labels = { judge: '⚖️ Judge', advocate: '💼 Advocate', witness: '👤 Witness' };
    const iconMap = { judge: 'fa-person-chalkboard', advocate: 'fa-briefcase', witness: 'fa-person' };
    const role = activeTab ? activeTab.dataset.role : document.getElementById('speakerSelect').value;
    return { label: labels[role] || role, icon: iconMap[role] || 'fa-user', role };
}

function setSpeaker(btn) {
    document.querySelectorAll('.speaker-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    // Sync hidden select
    document.getElementById('speakerSelect').value = btn.dataset.role;
    document.getElementById('speakerSelect').className = `speaker-${btn.dataset.role}`;
    // Force new bubble on speaker change
    currentTranscriptBubble = null;
}

// ── Transcript UI ──
function createNewBubble() {
    const feed = document.getElementById('transcriptOutput');

    // Remove empty state if present
    const empty = feed.querySelector('.empty-state');
    if (empty) empty.remove();

    const langDrop = document.getElementById('recordingLanguage');
    const langText = langDrop.options[langDrop.selectedIndex]?.dataset?.name || 'Unknown';
    const { label, icon, role } = getActiveSpeakerLabel();

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const bubble = document.createElement('div');
    bubble.className = `transcript-bubble ${role}-bubble`;

    bubble.innerHTML = `
        <div class="bubble-header">
            <span class="bubble-speaker">
                <i class="fa-solid ${icon}"></i>
                ${role.charAt(0).toUpperCase() + role.slice(1)}
            </span>
            <div class="bubble-meta">
                <span class="lang-badge">${langText}</span>
                <span class="bubble-time">${timeStr}</span>
            </div>
        </div>
        <div class="bubble-text interim">…</div>
    `;

    feed.appendChild(bubble);
    feed.scrollTop = feed.scrollHeight;

    currentTranscriptBubble = bubble;
    return bubble;
}

function updateInterimBubble(text) {
    if (!currentTranscriptBubble) currentTranscriptBubble = createNewBubble();
    const textEl = currentTranscriptBubble.querySelector('.bubble-text');
    textEl.innerHTML = formatText(text) + '<span style="opacity:0.5"> …</span>';
    textEl.classList.add('interim');
    document.getElementById('transcriptOutput').scrollTop = document.getElementById('transcriptOutput').scrollHeight;
}

function commitTranscriptBubble(text) {
    if (!currentTranscriptBubble) currentTranscriptBubble = createNewBubble();
    const textEl = currentTranscriptBubble.querySelector('.bubble-text');
    textEl.innerHTML = formatText(text);
    textEl.classList.remove('interim');

    // Save to state
    const langDrop = document.getElementById('recordingLanguage');
    const langText = langDrop.options[langDrop.selectedIndex]?.dataset?.name || 'Unknown';
    const { label } = getActiveSpeakerLabel();

    appState.transcripts.push({
        speaker: label,
        language: langText,
        text: text,
        timestamp: new Date().toISOString()
    });

    currentTranscriptBubble = null;
    updateStats();
}

// ── Stats ──
function updateStats() {
    const count = appState.transcripts.length;
    const words = appState.transcripts.reduce((acc, t) => acc + t.text.trim().split(/\s+/).length, 0);
    document.getElementById('statEntries').textContent = count;
    document.getElementById('statWords').textContent = words;
}

function startTimer() {
    sessionStart = sessionStart || Date.now();
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
        const m = Math.floor(elapsed / 60);
        const s = elapsed % 60;
        document.getElementById('statTime').textContent = `${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

// ── Page Navigation ──
function goToRecordingPage() {
    appState.caseTitle = document.getElementById('caseTitle').value.trim();
    appState.caseNumber = document.getElementById('caseNumber').value.trim();
    appState.suspectName = document.getElementById('suspectName').value.trim();

    if (!appState.caseTitle || !appState.caseNumber || !appState.suspectName) {
        shakeCard();
        showNotification("Please fill in all case details.", "warning");
        return;
    }

    const checkboxes = document.querySelectorAll('#languageSelection input[type="checkbox"]:checked');
    appState.selectedLanguages = Array.from(checkboxes).map(cb => ({
        code: cb.value,
        name: cb.dataset.name
    }));

    if (appState.selectedLanguages.length === 0) {
        showNotification("Please select at least one language.", "warning");
        return;
    }

    // Populate displays
    document.getElementById('displayCaseTitle').textContent = appState.caseTitle;
    document.getElementById('displayCaseNumber').textContent = appState.caseNumber;
    document.getElementById('displaySuspectName').textContent = appState.suspectName;

    // Populate language dropdown
    const langSelect = document.getElementById('recordingLanguage');
    langSelect.innerHTML = '';
    appState.selectedLanguages.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang.code;
        opt.dataset.name = lang.name;
        opt.textContent = lang.name;
        langSelect.appendChild(opt);
    });

    document.getElementById('listeningLang').textContent = appState.selectedLanguages[0].name;

    // Switch pages
    document.getElementById('page1').classList.remove('active');
    document.getElementById('page1').style.display = 'none';
    document.getElementById('page2').classList.add('active');
    document.getElementById('page2').style.display = 'block';
    window.scrollTo(0, 0);

    // Advance step indicator
    document.querySelectorAll('.step')[1]?.classList.add('active');

    initRecognition();
}

function goBack() {
    if (isRecording) {
        if (!confirm("Recording is active. Going back will stop the session. Continue?")) return;
        stopRecording();
    }

    document.getElementById('page2').classList.remove('active');
    document.getElementById('page2').style.display = 'none';
    document.getElementById('page1').classList.add('active');
    document.getElementById('page1').style.display = 'flex';
    window.scrollTo(0, 0);
}

// ── Recording Controls ──
function updateButtonStates() {
    document.getElementById('btnStart').disabled = isRecording && !isPaused;
    document.getElementById('btnPause').disabled = !isRecording;
    document.getElementById('btnStop').disabled = !isRecording;
}

function startRecording() {
    if (!recognition) return;

    const langSelect = document.getElementById('recordingLanguage');
    recognition.lang = langSelect.value;
    document.getElementById('listeningLang').textContent = langSelect.options[langSelect.selectedIndex]?.text || '';

    try {
        if (isPaused) isPaused = false;
        recognition.start();
        isRecording = true;
        currentTranscriptBubble = null;
        startTimer();
        updateButtonStates();
    } catch (e) {
        console.error(e);
    }
}

function togglePauseRecording() {
    if (!recognition || !isRecording) return;

    if (isPaused) {
        startRecording();
        document.getElementById('btnPause').querySelector('span').textContent = 'Pause';
        document.getElementById('btnPause').querySelector('i').className = 'fa-solid fa-pause';
    } else {
        recognition.stop();
        isPaused = true;
        stopTimer();
        document.getElementById('recordingStatus').textContent = 'Paused';
        document.getElementById('recordingStatus').className = 'status-label paused';
        document.getElementById('statusRing').className = 'status-ring paused';
        document.getElementById('liveDot').className = 'live-dot';
        document.getElementById('btnPause').querySelector('span').textContent = 'Resume';
        document.getElementById('btnPause').querySelector('i').className = 'fa-solid fa-play';
        updateButtonStates();
    }
}

function stopRecording() {
    if (!recognition || !isRecording) return;

    isRecording = false;
    isPaused = false;
    recognition.stop();
    stopTimer();

    document.getElementById('recordingStatus').textContent = 'Idle';
    document.getElementById('recordingStatus').className = 'status-label idle';
    document.getElementById('statusRing').className = 'status-ring';
    document.getElementById('liveDot').className = 'live-dot';
    document.getElementById('btnPause').querySelector('span').textContent = 'Pause';
    document.getElementById('btnPause').querySelector('i').className = 'fa-solid fa-pause';
    currentTranscriptBubble = null;
    updateButtonStates();
}

// ── Language change ──
document.getElementById('recordingLanguage').addEventListener('change', (e) => {
    document.getElementById('listeningLang').textContent = e.target.options[e.target.selectedIndex]?.text || '';
    if (isRecording && !isPaused) {
        recognition.stop();
        currentTranscriptBubble = null;
        setTimeout(() => {
            if (isRecording && !isPaused) {
                recognition.lang = e.target.value;
                try { recognition.start(); } catch (err) {}
            }
        }, 300);
    }
});

// ── Speaker change (hidden select) ──
document.getElementById('speakerSelect').addEventListener('change', () => {
    currentTranscriptBubble = null;
});

// ── Download Transcript ──
function downloadTranscript() {
    if (appState.transcripts.length === 0) {
        showNotification("No transcript data to export.", "warning");
        return;
    }

    let content = `╔══════════════════════════════════════╗\n`;
    content += `║       NYAY LEKHAK — TRANSCRIPT        ║\n`;
    content += `╚══════════════════════════════════════╝\n\n`;
    content += `CASE TITLE   : ${appState.caseTitle}\n`;
    content += `CASE NUMBER  : ${appState.caseNumber}\n`;
    content += `SUSPECT NAME : ${appState.suspectName}\n`;
    content += `DATE         : ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    content += `TOTAL ENTRIES: ${appState.transcripts.length}\n\n`;
    content += `─────────────────────────────────────────\n\n`;

    appState.transcripts.forEach((t, i) => {
        const time = new Date(t.timestamp).toLocaleTimeString('en-IN');
        content += `[${i + 1}] ${t.speaker} | ${t.language} | ${time}\n`;
        content += `${t.text}\n\n`;
    });

    content += `─────────────────────────────────────────\n`;
    content += `Generated by Nyay Lekhak — Smart Court Transcription System\n`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `NyayLekhak_${appState.caseNumber.replace(/\//g, '-')}_${Date.now()}.txt`;
    link.click();

    showNotification("Transcript exported successfully!", "success");
}

// ── Summary Modal ──
function generateSummary() {
    if (appState.transcripts.length === 0) {
        showNotification("No transcript to summarize yet.", "warning");
        return;
    }

    const modal = document.getElementById('summaryModal');
    const list = document.getElementById('summaryList');
    const loader = document.getElementById('summaryLoader');

    list.innerHTML = '';
    loader.style.display = 'flex';
    modal.classList.add('show');

    setTimeout(() => {
        loader.style.display = 'none';

        const langs = [...new Set(appState.transcripts.map(t => t.language))];
        const speakers = [...new Set(appState.transcripts.map(t => t.speaker))];
        const wordCount = appState.transcripts.reduce((a, t) => a + t.text.trim().split(/\s+/).length, 0);
        const dur = document.getElementById('statTime').textContent;

        const items = [
            `Session recorded ${appState.transcripts.length} dialogue entries totalling approximately ${wordCount} words.`,
            `Case "${appState.caseTitle}" (${appState.caseNumber}) involving accused ${appState.suspectName}.`,
            `Active speakers in session: ${speakers.join(', ')}.`,
            `Languages used during session: ${langs.join(', ')}.`,
            `Session duration recorded: ${dur}.`,
            `Legal keywords flagged include terms such as "objection", "evidence", "verdict", and "bail".`,
        ];

        items.forEach((item, i) => {
            setTimeout(() => {
                const li = document.createElement('li');
                li.textContent = item;
                list.appendChild(li);
            }, i * 100);
        });
    }, 900);
}

function closeModal() {
    document.getElementById('summaryModal').classList.remove('show');
}

function handleOverlayClick(event) {
    if (event.target === document.getElementById('summaryModal')) closeModal();
}

// ── Utility: Notification Toast ──
function showNotification(msg, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const colors = {
        success: { bg: '#f0fdf4', border: '#86efac', text: '#166534', icon: 'fa-circle-check' },
        warning: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', icon: 'fa-triangle-exclamation' },
        error:   { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', icon: 'fa-circle-xmark' },
        info:    { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', icon: 'fa-circle-info' }
    };

    const c = colors[type] || colors.info;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 999;
        background: ${c.bg}; border: 1.5px solid ${c.border}; color: ${c.text};
        padding: 12px 18px; border-radius: 12px;
        font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
        display: flex; align-items: center; gap: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        animation: toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;
        max-width: 320px;
    `;

    toast.innerHTML = `<i class="fa-solid ${c.icon}" style="font-size:14px;"></i> ${msg}`;
    document.body.appendChild(toast);

    const style = document.createElement('style');
    style.textContent = `@keyframes toast-in { from { opacity:0; transform:translateY(12px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }`;
    document.head.appendChild(style);

    setTimeout(() => {
        toast.style.animation = 'none';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ── Utility: Card shake on validation ──
function shakeCard() {
    const card = document.querySelector('.setup-card');
    card.style.animation = 'none';
    card.style.transform = 'translateX(0)';
    const style = document.createElement('style');
    style.textContent = `@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }`;
    document.head.appendChild(style);
    card.style.animation = 'shake 0.4s ease';
    setTimeout(() => { card.style.animation = ''; }, 500);
}
