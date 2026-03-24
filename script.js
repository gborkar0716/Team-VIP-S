// Application State
let appState = {
    caseTitle: '',
    caseNumber: '',
    suspectName: '',
    selectedLanguages: [],
    transcripts: []
};

// Recognition objects
let recognition = null;
let isRecording = false;
let isPaused = false;
let currentTranscriptLine = null;

// Initialize Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function initRecognition() {
    if (!SpeechRecognition) {
        alert("Your browser does not support the Web Speech API. Please use Google Chrome.");
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = function() {
        document.getElementById('recordingStatus').textContent = '🔴 Recording';
        document.getElementById('recordingStatus').className = 'status recording';
    };

    recognition.onresult = function(event) {
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
            commitTranscriptLine(finalTranscriptPiece);
        } else if (interimTranscript) {
            updateInterimLine(interimTranscript);
        }
    };

    recognition.onerror = function(event) {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
            alert('Microphone access denied. Please allow microphone access.');
            stopRecording();
        }
    };

    recognition.onend = function() {
        if (isRecording && !isPaused) {
            // Automatically restart if it stops unexpectedly while supposed to be recording
            try {
                recognition.start();
            } catch (e) {
                console.error("Could not restart recognition:", e);
            }
        }
    };
}

// Format keywords
function formatText(text) {
    // Highlight keywords
    const keywords = ['objection', 'guilty', 'evidence', 'overruled', 'sustained'];
    const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
    return text.replace(regex, '<span class="keyword-highlight">$1</span>');
}

// Transcript UI management
function createNewTranscriptLine() {
    const container = document.getElementById('transcriptOutput');
    const speakerDrop = document.getElementById('speakerSelect');
    const langDrop = document.getElementById('recordingLanguage');
    
    const speakerVal = speakerDrop.value;
    const speakerText = speakerDrop.options[speakerDrop.selectedIndex].text;
    const langText = langDrop.options[langDrop.selectedIndex].dataset.name;

    // Remove placeholder if present
    const placeholder = container.querySelector('.placeholder-text');
    if (placeholder) placeholder.remove();

    const lineDiv = document.createElement('div');
    lineDiv.className = 'transcript-line';
    
    lineDiv.innerHTML = `
        <span class="tag ${speakerVal}">[${speakerText} | <span class="lang-hint">${langText}</span>]</span>
        <span class="text-content text-new">...</span>
    `;
    
    container.appendChild(lineDiv);
    container.scrollTop = container.scrollHeight;
    
    currentTranscriptLine = lineDiv;
    return lineDiv;
}

function updateInterimLine(text) {
    if (!currentTranscriptLine) {
        currentTranscriptLine = createNewTranscriptLine();
    }
    const textSpan = currentTranscriptLine.querySelector('.text-content');
    textSpan.innerHTML = formatText(text) + '<i>...</i>';
}

function commitTranscriptLine(text) {
    if (!currentTranscriptLine) {
        currentTranscriptLine = createNewTranscriptLine();
    }
    const textSpan = currentTranscriptLine.querySelector('.text-content');
    textSpan.innerHTML = formatText(text);
    textSpan.classList.remove('text-new');
    
    // Save to state
    const speakerDrop = document.getElementById('speakerSelect');
    const langDrop = document.getElementById('recordingLanguage');
    const speakerText = speakerDrop.options[speakerDrop.selectedIndex].text;
    const langText = langDrop.options[langDrop.selectedIndex].dataset.name;

    appState.transcripts.push({
        speaker: speakerText,
        language: langText,
        text: text,
        timestamp: new Date().toISOString()
    });

    currentTranscriptLine = null; // Next speech will create a new line
}

// Page Navigation & Setup
function goToRecordingPage() {
    // Gather inputs
    appState.caseTitle = document.getElementById('caseTitle').value.trim();
    appState.caseNumber = document.getElementById('caseNumber').value.trim();
    appState.suspectName = document.getElementById('suspectName').value.trim();
    
    if (!appState.caseTitle || !appState.caseNumber || !appState.suspectName) {
        alert("Please fill in all case details.");
        return;
    }

    // Gather languages
    const checkboxes = document.querySelectorAll('#languageSelection input[type="checkbox"]:checked');
    appState.selectedLanguages = Array.from(checkboxes).map(cb => ({
        code: cb.value,
        name: cb.dataset.name
    }));

    if (appState.selectedLanguages.length === 0) {
        alert("Please select at least one language.");
        return;
    }

    // Update UI
    document.getElementById('displayCaseTitle').textContent = appState.caseTitle;
    document.getElementById('displayCaseNumber').textContent = appState.caseNumber;
    document.getElementById('displaySuspectName').textContent = appState.suspectName;

    // Populate Language Dropdown in Page 2
    const langSelect = document.getElementById('recordingLanguage');
    langSelect.innerHTML = '';
    appState.selectedLanguages.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang.code;
        opt.dataset.name = lang.name;
        opt.textContent = lang.name;
        langSelect.appendChild(opt);
    });

    // Update listening lang indicator
    document.getElementById('listeningLang').textContent = `Using: ${appState.selectedLanguages[0].name}`;

    // Switch pages
    document.getElementById('page1').classList.remove('active');
    document.getElementById('page2').classList.add('active');
    
    // Reset scroll position to top
    window.scrollTo(0, 0);
    
    initRecognition();
}

function goBack() {
    if (isRecording) {
        if (!confirm("Recording is active. Going back will stop recording. Continue?")) return;
        stopRecording();
    }
    document.getElementById('page2').classList.remove('active');
    document.getElementById('page1').classList.add('active');
}

// Recording Controls
function updateButtonStates() {
    document.getElementById('btnStart').disabled = isRecording && !isPaused;
    document.getElementById('btnPause').disabled = !isRecording;
    document.getElementById('btnStop').disabled = !isRecording;
}

function startRecording() {
    if (!recognition) return;
    
    const langSelect = document.getElementById('recordingLanguage');
    recognition.lang = langSelect.value;
    document.getElementById('listeningLang').textContent = `Using: ${langSelect.options[langSelect.selectedIndex].text}`;

    try {
        if (isPaused) {
            // Resume
            isPaused = false;
        }
        recognition.start();
        isRecording = true;
        currentTranscriptLine = null; // force new line on start
        updateButtonStates();
    } catch (e) {
        console.error(e);
    }
}

function togglePauseRecording() {
    if (!recognition || !isRecording) return;
    
    if (isPaused) {
        startRecording(); // Resume
    } else {
        recognition.stop();
        isPaused = true;
        document.getElementById('recordingStatus').textContent = '⏸️ Paused';
        document.getElementById('recordingStatus').className = 'status paused';
        document.getElementById('btnPause').textContent = '▶️ Resume';
        updateButtonStates();
    }
}

function stopRecording() {
    if (!recognition || !isRecording) return;
    
    isRecording = false;
    isPaused = false;
    recognition.stop();
    
    document.getElementById('recordingStatus').textContent = 'Idle';
    document.getElementById('recordingStatus').className = 'status idle';
    document.getElementById('btnPause').textContent = '⏸️ Pause';
    currentTranscriptLine = null;
    updateButtonStates();
}

// Language and Speaker change events
document.getElementById('recordingLanguage').addEventListener('change', (e) => {
    document.getElementById('listeningLang').textContent = `Using: ${e.target.options[e.target.selectedIndex].text}`;
    if (isRecording && !isPaused) {
        // Restart recognition with new language
        recognition.stop(); // This triggers onend, which will restart it
        currentTranscriptLine = null; // New line on language change
        
        // Timeout to ensure stop is fully processed before we try to start manually 
        // if onend doesn't handle it
        setTimeout(() => {
            if (isRecording && !isPaused) {
                recognition.lang = e.target.value;
                try { recognition.start(); } catch(err){}
            }
        }, 300);
    }
});

document.getElementById('speakerSelect').addEventListener('change', (e) => {
    // When speaker changes, force new line for next speech
    currentTranscriptLine = null;
    
    // Update border/color to match speaker
    const select = e.target;
    select.className = `speaker-${select.value}`;
});

// Download Transcript
function downloadTranscript() {
    if (appState.transcripts.length === 0) {
        alert("No transcript data to download.");
        return;
    }

    let content = `======================================\n`;
    content += `         VERBACOURT TRANSCRIPT       \n`;
    content += `======================================\n\n`;
    content += `CASE TITLE: ${appState.caseTitle}\n`;
    content += `CASE NUMBER: ${appState.caseNumber}\n`;
    content += `SUSPECT NAME: ${appState.suspectName}\n`;
    content += `DATE: ${new Date().toLocaleDateString()}\n\n`;
    content += `--------------------------------------\n\n`;

    appState.transcripts.forEach(t => {
        content += `[${t.speaker} | ${t.language}]\n${t.text}\n\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `VerbaCourt_${appState.caseNumber.replace(/\//g,'-')}.txt`;
    link.click();
}

// Summary Modal Logic
function generateSummary() {
    if (appState.transcripts.length === 0) {
        alert("No transcript recorded to summarize yet.");
        return;
    }
    
    const modal = document.getElementById('summaryModal');
    const list = document.getElementById('summaryList');
    list.innerHTML = '';
    
    // Mock summary generation
    setTimeout(() => {
        const items = [
            `The recording contains ${appState.transcripts.length} dialogue entries.`,
            `The case "${appState.caseTitle}" involved questioning of suspect ${appState.suspectName}.`,
            `Keywords such as 'evidence' and 'objection' were flagged during the transcription session.`,
            `Main languages spoken: ${[...new Set(appState.transcripts.map(t=>t.language))].join(', ')}.`
        ];
        
        items.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            list.appendChild(li);
        });
        
    }, 800);
    
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('summaryModal').style.display = 'none';
}

// Close modal if user clicks outside
window.onclick = function(event) {
    const modal = document.getElementById('summaryModal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}