/* =========================================================================
 * ⚡ app.js - BX Score Keeper Main Application Logic
 * ========================================================================= */

let scoreP1 = 0, scoreP2 = 0, scoreP3 = 0;
let foulsP1 = 0, foulsP2 = 0, foulsP3 = 0;
let teamWinsP1 = 0, teamWinsP2 = 0;
let kofIndexP1 = 0, kofIndexP2 = 0;
let isFinalTeamWinActive = false;
let battleCount = 1;
let matchMode = 'std';
let targetScore = 4;
let history = [], logs = [];
let currentLang = 'zh';

// 🎯 全面標準化預設陣容
let roster = {
    t1Name: '隊伍 A', t1: ['選手一', '陀螺二', '陀螺三'],
    t2Name: '隊伍 B', t2: ['選手二', '陀螺二', '陀螺三'],
    t3Name: '選手三'
};

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playBeep(freq = 440, type = 'sine', duration = 0.1) {
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

function forceRefreshApp() {
    if (confirm(currentLang === 'zh' ? "是否重新載入並清除舊資料？" : "Reload and clear cache?")) {
        localStorage.removeItem('bx_score_state');
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.unregister();
                }
                caches.keys().then(names => {
                    for (let name of names) {
                        caches.delete(name);
                    }
                    window.location.reload(true);
                });
            });
        } else {
            window.location.reload(true);
        }
    }
}

function startShootCountdown() {
    const btn = document.getElementById('shoot-btn');
    if (!btn) return;
    btn.disabled = true;

    const steps = [
        { txt: "Three", label: "3...", freq: 523.25 },
        { txt: "Two", label: "2...", freq: 523.25 },
        { txt: "One", label: "1...", freq: 523.25 },
        { txt: "Go Shoot!", label: "GO SHOOT!", freq: 1046.50 }
    ];

    let stepIndex = 0;

    function playStep() {
        if (stepIndex >= steps.length) {
            setTimeout(() => {
                btn.innerText = "📢 3, 2, 1, Go Shoot!";
                btn.disabled = false;
            }, 1200);
            return;
        }

        const current = steps[stepIndex];
        playBeep(current.freq, 'square', stepIndex === 3 ? 0.35 : 0.15);

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            let u = new SpeechSynthesisUtterance(current.txt);
            u.lang = 'en-US';
            u.rate = 1.3;

            u.onstart = () => {
                btn.innerText = current.label;
            };

            u.onend = () => {
                stepIndex++;
                setTimeout(playStep, stepIndex === 3 ? 100 : 200);
            };

            u.onerror = () => {
                btn.innerText = current.label;
                stepIndex++;
                setTimeout(playStep, 800);
            };

            window.speechSynthesis.speak(u);
        } else {
            btn.innerText = current.label;
            stepIndex++;
            setTimeout(playStep, 800);
        }
    }

    playStep();
}

function safeSetDisplay(id, val) { const el = document.getElementById(id); if (el) el.style.display = val; }
function safeSetText(id, val) { const el = document.getElementById(id); if (el) el.innerText = val; }
function safeSetInputValue(id, val) { const el = document.getElementById(id); if (el) el.value = val; }
function safeSetInputPlaceholder(id, txt) { const el = document.getElementById(id); if (el) el.placeholder = txt; }

function setMatchMode(mode, shouldReset = false) {
    matchMode = mode;
    if (mode === 'team') targetScore = 2;
    else if (mode === 'p3') targetScore = 5;
    else targetScore = 4;

    const stdBtn = document.getElementById('mode-std-btn');
    const btn3v3 = document.getElementById('mode-3v3-btn');
    const teamBtn = document.getElementById('mode-team-btn');
    const p3Btn = document.getElementById('mode-p3-btn');

    if (stdBtn) stdBtn.classList.toggle('active', mode === 'std');
    if (btn3v3) btn3v3.classList.toggle('active', mode === '3v3');
    if (teamBtn) teamBtn.classList.toggle('active', mode === 'team');
    if (p3Btn) p3Btn.classList.toggle('active', mode === 'p3');

    safeSetDisplay('deck-box', mode === '3v3' ? 'flex' : 'none');
    safeSetDisplay('team-tracker-bar', mode === 'team' ? 'flex' : 'none');
    safeSetDisplay('next-kof-btn', mode === 'team' ? 'inline-block' : 'none');

    if (shouldReset) {
        resetMatch(false);
    }

    const scoreboard = document.getElementById('main-scoreboard');
    const p3Card = document.getElementById('p3-card');
    if (mode === 'p3') {
        if (scoreboard) scoreboard.classList.add('p3-mode');
        if (p3Card) p3Card.style.display = 'flex';
    } else {
        if (scoreboard) scoreboard.classList.remove('p3-mode');
        if (p3Card) p3Card.style.display = 'none';
    }

    updatePlayerNamesForMode();
    applyLanguage();

    if (myPeerRole === 'host') {
        broadcastToClients({ type: 'MODE_SYNC', mode });
    }
}

/* 🎯 關鍵修復：乾淨統一所有賽制的名稱顯示 */
function updatePlayerNamesForMode() {
    const p1Title = document.getElementById('p1-title');
    const p2Title = document.getElementById('p2-title');
    const p3Title = document.getElementById('p3-title');

    let defP1 = currentLang === 'zh' ? '選手一' : 'Player 1';
    let defP2 = currentLang === 'zh' ? '選手二' : 'Player 2';
    let defP3 = currentLang === 'zh' ? '選手三' : 'Player 3';

    let rolesZh = ['先鋒', '中堅', '大將'];
    let rolesEn = ['1st Vanguard', '2nd Middle', '3rd General'];

    if (matchMode === 'team') {
        let t1Name = roster.t1Name || (currentLang === 'zh' ? '隊伍 A' : 'Team A');
        let t2Name = roster.t2Name || (currentLang === 'zh' ? '隊伍 B' : 'Team B');
        let idx1 = Math.min(kofIndexP1, 2);
        let idx2 = Math.min(kofIndexP2, 2);

        // 如果隊員名字還是 1 或 選手一 等預設名，直接展示標準角色 (先鋒 / 中堅 / 大將)
        let rawP1 = (roster.t1 && roster.t1[idx1]) ? roster.t1[idx1] : '';
        let rawP2 = (roster.t2 && roster.t2[idx2]) ? roster.t2[idx2] : '';

        let isDefault1 = (!rawP1 || rawP1 === '1' || rawP1 === '2' || rawP1 === '3' || rawP1.startsWith('選手'));
        let isDefault2 = (!rawP2 || rawP2 === 'A' || rawP2 === 'B' || rawP2 === 'C' || rawP2.startsWith('選手'));

        let p1Display = isDefault1 ? (currentLang === 'zh' ? rolesZh[idx1] : rolesEn[idx1]) : rawP1;
        let p2Display = isDefault2 ? (currentLang === 'zh' ? rolesZh[idx2] : rolesEn[idx2]) : rawP2;
        
        if (p1Title) p1Title.value = `${p1Display} (${t1Name})`;
        if (p2Title) p2Title.value = `${p2Display} (${t2Name})`;
    } else if (matchMode === '3v3' || matchMode === 'std') {
        let rawP1 = (roster.t1 && roster.t1[0]) ? roster.t1[0] : (roster.t1Name || '');
        let rawP2 = (roster.t2 && roster.t2[0]) ? roster.t2[0] : (roster.t2Name || '');

        if (p1Title) p1Title.value = (rawP1 && rawP1 !== '1') ? rawP1 : defP1;
        if (p2Title) p2Title.value = (rawP2 && rawP2 !== 'A') ? rawP2 : defP2;
    } else if (matchMode === 'p3') {
        let rawP1 = (roster.t1 && roster.t1[0]) ? roster.t1[0] : (roster.t1Name || '');
        let rawP2 = (roster.t2 && roster.t2[0]) ? roster.t2[0] : (roster.t2Name || '');

        if (p1Title) p1Title.value = (rawP1 && rawP1 !== '1') ? rawP1 : defP1;
        if (p2Title) p2Title.value = (rawP2 && rawP2 !== 'A') ? rawP2 : defP2;
        if (p3Title) p3Title.value = roster.t3Name || defP3;
    }
}

function handleManualNameChange(slot) {
    if (slot === 1) {
        let val = document.getElementById('p1-title').value;
        roster.t1Name = val;
        roster.t1[0] = val;
    } else if (slot === 2) {
        let val = document.getElementById('p2-title').value;
        roster.t2Name = val;
        roster.t2[0] = val;
    } else if (slot === 3) {
        let val = document.getElementById('p3-title').value;
        roster.t3Name = val;
    }
    saveState();
    broadcastCurrentState();
}

function triggerVersusAnimation(p1, p2) {
    safeSetText('vs-player-names', `${p1} VS ${p2}`);
    safeSetDisplay('versus-modal', 'flex');
    playBeep(700, 'triangle', 0.2);
}
function closeVersusModal() { safeSetDisplay('versus-modal', 'none'); }

function openRosterModal() { 
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('roster-t1-name', roster.t1Name || '');
    setVal('roster-t1-p1', (roster.t1 && roster.t1[0]) || '');
    setVal('roster-t1-p2', (roster.t1 && roster.t1[1]) || '');
    setVal('roster-t1-p3', (roster.t1 && roster.t1[2]) || '');

    setVal('roster-t2-name', roster.t2Name || '');
    setVal('roster-t2-p1', (roster.t2 && roster.t2[0]) || '');
    setVal('roster-t2-p2', (roster.t2 && roster.t2[1]) || '');
    setVal('roster-t2-p3', (roster.t2 && roster.t2[2]) || '');

    safeSetDisplay('roster-modal', 'flex'); 
}
function closeRosterModal() { safeSetDisplay('roster-modal', 'none'); }

function moveRosterItem(teamKey, fromIdx, toIndex) {
    let p1 = document.getElementById(`roster-${teamKey}-p1`);
    let p2 = document.getElementById(`roster-${teamKey}-p2`);
    let p3 = document.getElementById(`roster-${teamKey}-p3`);
    if (!p1 || !p2 || !p3) return;

    let list = [p1.value, p2.value, p3.value];
    let temp = list[fromIdx];
    list[fromIdx] = list[toIndex];
    list[toIndex] = temp;

    p1.value = list[0];
    p2.value = list[1];
    p3.value = list[2];
}

function saveRoster() {
    const getVal = (id, def) => { const el = document.getElementById(id); return el && el.value.trim() ? el.value.trim() : def; };
    roster.t1Name = getVal('roster-t1-name', currentLang === 'zh' ? '隊伍 A' : 'Team A');
    roster.t1[0] = getVal('roster-t1-p1', currentLang === 'zh' ? '先鋒' : '1st Vanguard');
    roster.t1[1] = getVal('roster-t1-p2', currentLang === 'zh' ? '中堅' : '2nd Middle');
    roster.t1[2] = getVal('roster-t1-p3', currentLang === 'zh' ? '大將' : '3rd General');

    roster.t2Name = getVal('roster-t2-name', currentLang === 'zh' ? '隊伍 B' : 'Team B');
    roster.t2[0] = getVal('roster-t2-p1', currentLang === 'zh' ? '先鋒' : '1st Vanguard');
    roster.t2[1] = getVal('roster-t2-p2', currentLang === 'zh' ? '中堅' : '2nd Middle');
    roster.t2[2] = getVal('roster-t2-p3', currentLang === 'zh' ? '大將' : '3rd General');

    kofIndexP1 = 0;
    kofIndexP2 = 0;
    isFinalTeamWinActive = false;

    closeRosterModal();
    setMatchMode('team', false);
    
    let p1Show = `${roster.t1[0]} (${roster.t1Name})`;
    let p2Show = `${roster.t2[0]} (${roster.t2Name})`;
    triggerVersusAnimation(p1Show, p2Show);

    broadcastCurrentState();
}

function broadcastCurrentState() {
    if (typeof broadcastToClients === 'function') {
        broadcastToClients({
            type: 'STATE_SYNC',
            isMatchLocked: typeof isMatchLocked !== 'undefined' ? isMatchLocked : false,
            roster: roster,
            scoreP1, scoreP2, scoreP3,
            foulsP1, foulsP2, foulsP3,
            teamWinsP1, teamWinsP2, kofIndexP1, kofIndexP2,
            battleCount, matchMode,
            logs: logs
        });
    }
}

function addScore(player, pts, typeName) {
    if (scoreP1 >= targetScore || scoreP2 >= targetScore || (matchMode === 'p3' && scoreP3 >= targetScore) || isFinalTeamWinActive) return;

    playBeep(600, 'square', 0.08);

    history.push({
        p1: scoreP1, p2: scoreP2, p3: scoreP3,
        f1: foulsP1, f2: foulsP2, f3: foulsP3,
        teamP1: teamWinsP1, teamP2: teamWinsP2, k1: kofIndexP1, k2: kofIndexP2,
        battle: battleCount, logs: [...logs]
    });

    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    let name1 = getVal('p1-title');
    let name2 = getVal('p2-title');
    let name3 = getVal('p3-title');

    let pName = player === 1 ? name1 : (player === 2 ? name2 : name3);
    let displayType = typeName;
    if (currentLang === 'zh') {
        if (typeName === 'Xtreme') displayType = '極限終結';
        else if (typeName === 'Over') displayType = '擊出終結';
        else if (typeName === 'Burst') displayType = '爆裂終結';
        else if (typeName === 'Spin') displayType = '迴轉勝利';
    }

    logs.unshift(`Round ${battleCount}: ${pName} +${pts} (${displayType})`);

    if (player === 1) scoreP1 += pts;
    else if (player === 2) scoreP2 += pts;
    else if (player === 3) scoreP3 += pts;

    foulsP1 = 0; foulsP2 = 0; foulsP3 = 0;

    battleCount++;
    updateDisplay();
    saveState();
    broadcastCurrentState();

    if (checkWinner()) return;

    if (matchMode === '3v3' && (battleCount - 1) % 3 === 0) {
        if (scoreP1 < 4 && scoreP2 < 4) {
            setTimeout(() => {
                alert(i18n[currentLang].reorderMsg);
                battleCount = 1;
                updateDisplay();
                saveState();
                broadcastCurrentState();
            }, 100);
        }
    }
}

function addFoul(player) {
    if (scoreP1 >= targetScore || scoreP2 >= targetScore || (matchMode === 'p3' && scoreP3 >= targetScore) || isFinalTeamWinActive) return;

    playBeep(350, 'sawtooth', 0.12);

    history.push({
        p1: scoreP1, p2: scoreP2, p3: scoreP3,
        f1: foulsP1, f2: foulsP2, f3: foulsP3,
        teamP1: teamWinsP1, teamP2: teamWinsP2, k1: kofIndexP1, k2: kofIndexP2,
        battle: battleCount, logs: [...logs]
    });

    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    let name1 = getVal('p1-title');
    let name2 = getVal('p2-title');
    let name3 = getVal('p3-title');
    let offenderName = player === 1 ? name1 : (player === 2 ? name2 : name3);

    if (player === 1) foulsP1++;
    else if (player === 2) foulsP2++;
    else if (player === 3) foulsP3++;

    let currentFouls = player === 1 ? foulsP1 : (player === 2 ? foulsP2 : foulsP3);

    if (currentFouls === 1) {
        let txt = currentLang === 'zh' ? '發射失誤' : 'Shooting Error';
        logs.unshift(`Round ${battleCount}: ${offenderName} ${txt} (1/2)`);
    } else if (currentFouls >= 2) {
        if (player === 1) foulsP1 = 0;
        else if (player === 2) foulsP2 = 0;
        else if (player === 3) foulsP3 = 0;

        let txt = currentLang === 'zh' ? '累積2次失誤 ➔ 對手 +1 分' : '2 Errors ➔ Opponent +1 pt';
        logs.unshift(`Round ${battleCount}: ${offenderName} ${txt}`);

        if (matchMode === 'p3') {
            if (player !== 1) scoreP1 += 1;
            if (player !== 2) scoreP2 += 1;
            if (player !== 3) scoreP3 += 1;
        } else {
            if (player === 1) scoreP2 += 1;
            else scoreP1 += 1;
        }
        battleCount++;
    }

    updateDisplay();
    saveState();
    broadcastCurrentState();
    checkWinner();
}

function addDraw() {
    playBeep(300, 'sine', 0.1);
    history.push({
        p1: scoreP1, p2: scoreP2, p3: scoreP3,
        f1: foulsP1, f2: foulsP2, f3: foulsP3,
        teamP1: teamWinsP1, teamP2: teamWinsP2, k1: kofIndexP1, k2: kofIndexP2,
        battle: battleCount, logs: [...logs]
    });
    let txt = currentLang === 'zh' ? '平手重賽' : 'DRAW (Replay)';
    logs.unshift(`Round ${battleCount}: ${txt}`);
    battleCount++;
    updateDisplay();
    saveState();
    broadcastCurrentState();
}

function nextKOFRound() {
    if (isFinalTeamWinActive) return;

    if (scoreP1 >= targetScore) {
        kofIndexP2++;
    } else if (scoreP2 >= targetScore) {
        kofIndexP1++;
    }

    if (kofIndexP1 >= 3) {
        let winnerTeam = roster.t2Name || (currentLang === 'zh' ? '隊伍 B' : 'Team B');
        showWinModal(winnerTeam, true);
        return;
    } else if (kofIndexP2 >= 3) {
        let winnerTeam = roster.t1Name || (currentLang === 'zh' ? '隊伍 A' : 'Team A');
        showWinModal(winnerTeam, true);
        return;
    }

    updatePlayerNamesForMode();

    scoreP1 = 0; scoreP2 = 0; scoreP3 = 0;
    foulsP1 = 0; foulsP2 = 0; foulsP3 = 0;
    battleCount = 1;

    updateDisplay();
    saveState();
    broadcastCurrentState();
    triggerVersusAnimation(document.getElementById('p1-title').value, document.getElementById('p2-title').value);
}

function resetBattleCounter() {
    if (matchMode === '3v3') {
        battleCount = 1;
        updateDisplay();
        saveState();
        broadcastCurrentState();
    }
}

function undo() {
    if (history.length > 0) {
        playBeep(300, 'sine', 0.1);
        const last = history.pop();
        scoreP1 = last.p1; scoreP2 = last.p2; scoreP3 = last.p3 || 0;
        foulsP1 = last.f1 || 0; foulsP2 = last.f2 || 0; foulsP3 = last.f3 || 0;
        teamWinsP1 = last.teamP1; teamWinsP2 = last.teamP2;
        kofIndexP1 = last.k1 || 0; kofIndexP2 = last.k2 || 0;
        battleCount = last.battle; logs = last.logs;
        isFinalTeamWinActive = false;

        safeSetDisplay('win-modal', 'none');
        if (typeof broadcastToClients === 'function') {
            broadcastToClients({ type: 'CLOSE_WIN_SYNC' });
        }

        updatePlayerNamesForMode();
        updateDisplay();
        saveState();
        broadcastCurrentState();
    }
}

function resetMatch(askConfirm = true) {
    if (!askConfirm || confirm(currentLang === 'zh' ? "確定重置賽事？" : "Reset entire match/scores?")) {
        scoreP1 = 0; scoreP2 = 0; scoreP3 = 0;
        foulsP1 = 0; foulsP2 = 0; foulsP3 = 0;
        teamWinsP1 = 0; teamWinsP2 = 0;
        kofIndexP1 = 0; kofIndexP2 = 0;
        battleCount = 1;
        history = []; logs = [];
        isFinalTeamWinActive = false;
        
        occupiedSlots = { slot1: false, slot2: false, slot3: false };
        if (typeof isMatchLocked !== 'undefined') isMatchLocked = false;

        localStorage.removeItem('bx_score_state');
        updatePlayerNamesForMode();
        updateDisplay();
        saveState();
        applyLanguage();
        broadcastCurrentState();
    }
}

function updateDisplay() {
    safeSetText('score-p1', scoreP1);
    safeSetText('score-p2', scoreP2);
    safeSetText('score-p3', scoreP3);

    safeSetText('foul-badge-p1', `${foulsP1}/2`);
    safeSetText('foul-badge-p2', `${foulsP2}/2`);
    safeSetText('foul-badge-p3', `${foulsP3}/2`);

    const f1 = document.getElementById('btn-foul-p1'); if (f1) f1.classList.toggle('active-foul', foulsP1 > 0);
    const f2 = document.getElementById('btn-foul-p2'); if (f2) f2.classList.toggle('active-foul', foulsP2 > 0);
    const f3 = document.getElementById('btn-foul-p3'); if (f3) f3.classList.toggle('active-foul', foulsP3 > 0);

    if (matchMode === '3v3') {
        let currentBeyNum = ((battleCount - 1) % 3) + 1;
        safeSetText('deck-status', `ITEM #${currentBeyNum}`);
    }

    if (matchMode === 'team') {
        let t1Label = roster.t1Name || (currentLang === 'zh' ? '隊伍 A' : 'Team A');
        let t2Label = roster.t2Name || (currentLang === 'zh' ? '隊伍 B' : 'Team B');
        safeSetText('team-wins-p1', `${t1Label}: ${teamWinsP1}`);
        safeSetText('team-wins-p2', `${t2Label}: ${teamWinsP2}`);
    }

    const logList = document.getElementById('log-list');
    if (logList) {
        logList.innerHTML = '';
        logs.forEach(l => {
            const li = document.createElement('li');
            li.className = 'log-item';
            li.textContent = l;
            logList.appendChild(li);
        });
        logList.scrollTop = 0;
    }
}

function checkWinner() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    let name1 = getVal('p1-title');
    let name2 = getVal('p2-title');
    let name3 = getVal('p3-title');

    if (scoreP1 >= targetScore) {
        if (matchMode === 'team') teamWinsP1++;
        playBeep(880, 'triangle', 0.3);
        let isFinal = matchMode !== 'team'; 
        showWinModal(name1, isFinal);
        if (typeof broadcastToClients === 'function') {
            broadcastToClients({ type: 'WIN_SYNC', winner: name1, isFinalTeamWin: isFinal });
        }
        return true;
    } else if (scoreP2 >= targetScore) {
        if (matchMode === 'team') teamWinsP2++;
        playBeep(880, 'triangle', 0.3);
        let isFinal = matchMode !== 'team'; 
        showWinModal(name2, isFinal);
        if (typeof broadcastToClients === 'function') {
            broadcastToClients({ type: 'WIN_SYNC', winner: name2, isFinalTeamWin: isFinal });
        }
        return true;
    } else if (matchMode === 'p3' && scoreP3 >= targetScore) {
        playBeep(880, 'triangle', 0.3);
        showWinModal(name3, true);
        if (typeof broadcastToClients === 'function') {
            broadcastToClients({ type: 'WIN_SYNC', winner: name3, isFinalTeamWin: true });
        }
        return true;
    }
    return false;
}

function showWinModal(winner, isFinalTeamWin = false) {
    safeSetText('winner-name', winner);
    const modalIcon = document.querySelector('#win-modal div[style*="font-size: 3rem;"]');

    if (isFinalTeamWin) {
        isFinalTeamWinActive = true;
        if (modalIcon) modalIcon.innerText = "🏆";
        safeSetText('win-msg', i18n[currentLang].teamFinalWinMsg);
    } else {
        if (modalIcon) modalIcon.innerText = "⚡";
        safeSetText('win-msg', matchMode === 'team' ? i18n[currentLang].teamWinMsg : i18n[currentLang].winMsg);
    }
    safeSetDisplay('win-modal', 'flex');
}

function closeWinModal() {
    safeSetDisplay('win-modal', 'none');
    
    if (typeof broadcastToClients === 'function') {
        broadcastToClients({ type: 'CLOSE_WIN_SYNC' });
    }

    if (matchMode === 'team') {
        if (isFinalTeamWinActive) {
            kofIndexP1 = 0;
            kofIndexP2 = 0;
        } else {
            nextKOFRound();
        }
    }
}

function openRules() { 
    applyLanguage();
    safeSetDisplay('rules-modal', 'flex'); 
}
function closeRules() { safeSetDisplay('rules-modal', 'none'); }

function toggleLanguage() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    applyLanguage();
    saveState();
}

function applyLanguage() {
    const lang = i18n[currentLang];

    safeSetText('rules-tag', lang.rulesTag);
    safeSetText('btn-rules-txt', lang.rulesBtn);
    safeSetText('btn-roster-txt', lang.rosterBtn);
    safeSetText('btn-refresh-txt', lang.refreshBtn);
    safeSetText('lang-btn', currentLang === 'zh' ? 'EN' : '中文');
    safeSetText('btn-undo', lang.undo);
    safeSetText('btn-draw', lang.drawBtn);
    safeSetText('btn-reset', lang.reset);
    safeSetText('next-kof-btn', lang.nextKof);
    safeSetText('reorder-btn', lang.reorderBtn);
    safeSetText('log-title', lang.logTitle);
    safeSetText('disclaimer', lang.disclaimer);
    safeSetText('privacy-notice', lang.privacyNotice);
    safeSetText('modal-title', lang.modalTitle);
    
    const modalBody = document.getElementById('modal-body');
    if (modalBody) modalBody.innerHTML = lang.rulesBody;

    safeSetText('roster-modal-title', lang.rosterModalTitle);
    safeSetText('btn-save-roster', lang.saveRosterBtn);
    safeSetText('vs-sub-msg', lang.vsSubMsg);
    safeSetText('btn-start-vs', lang.btnStartVs);

    /* 🌐 P2P Modal 雙語 */
    safeSetText('p2p-modal-title', lang.p2pTitle);
    safeSetText('btn-create-host', lang.btnCreateHost);
    safeSetText('txt-host-desc', lang.txtHostDesc);
    safeSetText('btn-join-player', lang.btnJoinPlayer);
    safeSetText('btn-join-spectator', lang.btnJoinSpectator);
    safeSetText('lbl-submit-title', lang.lblSubmitTitle);
    safeSetText('lbl-select-mode', lang.lblSelectMode);
    safeSetText('btn-submit-deck', lang.btnSubmitDeck);
    safeSetText('btn-leave-p2p', lang.btnLeaveP2P);
    safeSetText('btn-open-lobby', lang.btnOpenLobby);
    safeSetText('p2p-lbl-room', lang.lblRoom);
    safeSetText('p2p-lbl-connected', lang.lblConnected);

    /* 🏟️ Lobby 雙語 */
    safeSetText('lbl-lobby-title', lang.lobbyTitle);
    safeSetText('lbl-lobby-room-tip', lang.lobbyRoomTip);
    safeSetText('lbl-lobby-select-mode', lang.lobbySelectMode);
    safeSetText('lbl-lobby-slots-tip', lang.lobbySlotsTip);
    safeSetText('lbl-lobby-p1', lang.lblLobbyP1);
    safeSetText('lbl-lobby-p2', lang.lblLobbyP2);
    safeSetText('lbl-lobby-p3', lang.lblLobbyP3);
    safeSetText('btn-lobby-start', lang.btnLobbyStart);
    safeSetText('lbl-auto-assign-tip', lang.lblAutoAssignTip);
    safeSetText('btn-auto-accept', lang.btnAutoAccept);
    safeSetText('txt-spectator-waiting', lang.spectatorWaiting);

    const guideBox = document.getElementById('p2p-guide-box');
    if (guideBox) guideBox.innerHTML = lang.p2pGuide;

    document.querySelectorAll('.txt-xtreme').forEach(el => el.innerText = lang.xtreme);
    document.querySelectorAll('.txt-over').forEach(el => el.innerText = lang.over);
    document.querySelectorAll('.txt-burst').forEach(el => el.innerText = lang.burst);
    document.querySelectorAll('.txt-spin').forEach(el => el.innerText = lang.spin);

    safeSetText('txt-foul-p1', lang.foulTxt);
    safeSetText('txt-foul-p2', lang.foulTxt);
    safeSetText('txt-foul-p3', lang.foulTxt);

    safeSetInputPlaceholder('p2p-input-room', currentLang === 'zh' ? '輸入 8 位數房間 ID' : 'Enter 8-digit Room ID');
}

const i18n = {
    zh: {
        rulesTag: "《爆旋陀螺X規則（亞洲版）》第 12 版",
        rulesBtn: "規則",
        rosterBtn: "隊伍排陣",
        refreshBtn: "更新",
        modalTitle: "《爆旋陀螺X規則（亞洲版）》第 12 版要點",
        rosterModalTitle: "👥 隊伍名單與對戰排序",
        saveRosterBtn: "儲存排陣名單",
        xtreme: "極限終結", over: "擊出終結", burst: "爆裂終結", spin: "迴轉勝利", foulTxt: "發射失誤",
        undo: "復原", drawBtn: "平手重賽", reset: "重置賽事", nextKof: "下一局換人", reorderBtn: "重置順序",
        logTitle: "⚡ 對局紀錄", winMsg: "率先達到目標分數，獲得本局勝利！",
        teamWinMsg: "拿下本局！敗方請更換下一位隊員登場（比分重置為 0-0）。",
        teamFinalWinMsg: "擊敗對手全體隊員，獲得整場團隊賽事總勝利！",
        reorderMsg: "已打完 3 戰未滿 4 分！請雙方重新排列組合順序，從 1 號開始繼續比賽。",
        disclaimer: "本工具為非官方社群對戰計分器，依據《爆旋陀螺X規則（亞洲版）》第 12 版製作。",
        privacyNotice: "本應用程式為純前端工具，不會收集或上傳任何個人資料，所有數據僅保留於你的瀏覽器內。",
        vsSubMsg: "對決準備！",
        btnStartVs: "開始對戰",
        p2pTitle: "🌐 WebRTC P2P 跨機連線",
        btnCreateHost: "👑 建立對戰房間 (裁判主機)",
        txtHostDesc: "建立房間後，將 8 位數 ID 告知對手與現場觀眾。",
        btnJoinPlayer: "🎮 選手連線",
        btnJoinSpectator: "👁️ 觀眾觀戰",
        lblSubmitTitle: "📩 提交個人 / 隊伍排陣名單",
        lblSelectMode: "選擇欲提交的賽制模式：",
        btnSubmitDeck: "🔒 私密送出給裁判審核",
        btnLeaveP2P: "🚪 離開房間",
        btnOpenLobby: "🏟️ 等候大廳",
        lblRoom: "房間 ID",
        lblConnected: "已連線設備",
        lobbyTitle: "🏟️ 裁判等候大廳 (Host Lobby)",
        lobbyRoomTip: "請告知選手與觀眾輸入此 8 位數房間 ID：",
        lobbySelectMode: "👑 選擇本局賽事模式：",
        lobbySlotsTip: "選手連線送出後將自動填入，裁判亦可直接手動修改：",
        lblLobbyP1: "👈 左邊 (選手一 / 隊伍 A)",
        lblLobbyP2: "👉 右邊 (選手二 / 隊伍 B)",
        lblLobbyP3: "👆 中間 (選手三)",
        btnLobbyStart: "🔒 鎖定排陣並邀請全場開賽！",
        lblAutoAssignTip: "請裁判審核此排陣：",
        btnAutoAccept: "✅ 接收並放入大廳",
        spectatorWaiting: "⏳ 裁判正在大廳排陣準備中，請稍候...",
        p2pGuide: `
            <div style="color:var(--neon-blue); font-weight:bold; margin-bottom:4px;">📖 連線玩法指南 (上限 28 人)：</div>
            <div style="margin-bottom:3px;">• <b>👑 裁判端</b>：建立房間後 Code 全天有效！可看剩餘名額倒數，一鍵全場開賽。</div>
            <div style="margin-bottom:3px;">• <b>🎮 選手端</b>：輸入房間 ID 私密填寫陀螺/隊員送出，開賽後自動鎖定。</div>
            <div>• <b>👁️ 觀眾端</b>：輸入一次 ID 即可全程即時同步比分、獲勝彈窗與對局紀錄！</div>
        `,
        rulesBody: `
            <div style="margin-bottom:12px;">
                <h3 style="color:var(--neon-blue); margin-bottom:4px;">1. 得分與判定機制</h3>
                <ul style="padding-left:20px; font-size:0.85rem; color:#cbd5e1;">
                    <li><b>極限終結 (Xtreme Finish) - 3分</b>：完全進入極限區且無法返回。</li>
                    <li><b>擊出終結 (Over Finish) - 2分</b>：完全進入超區且無法返回。</li>
                    <li><b>爆裂終結 (Burst Finish) - 2分</b>：對手陀螺部件先行分離。</li>
                    <li><b>迴轉勝利 (Spin Finish) - 1分</b>：對手陀螺先行停止旋轉。</li>
                    <li><b>同時發生/平手 (Draw)</b>：雙方同時 Finish 視為 Draw，無人得分並重賽。</li>
                    <li><b>發射失誤/罰分</b>：同一局累積 2 次失誤，對手直接獲得 1 分並重賽。正式得分後失誤自動清零。</li>
                </ul>
            </div>
        `
    },
    en: {
        rulesTag: "BEYBLADE X Regulations (Asia Version) 12th Ed",
        rulesBtn: "Rules",
        rosterBtn: "Roster",
        refreshBtn: "Refresh",
        modalTitle: "BEYBLADE X Regulations (Asia Version) 12th Ed Summary",
        rosterModalTitle: "👥 Team Roster & Order Setup",
        saveRosterBtn: "Save Roster",
        xtreme: "Xtreme Finish", over: "Over Finish", burst: "Burst Finish", spin: "Spin Finish", foulTxt: "Shooting Error",
        undo: "Undo", drawBtn: "Draw", reset: "Reset Match", nextKof: "Next Round", reorderBtn: "Reset Order",
        logTitle: "⚡ BATTLE LOG", winMsg: "Reached target score and wins the match!",
        teamWinMsg: "Round won! Losing side replaces player (Score resets to 0-0).",
        teamFinalWinMsg: "Defeated all opponent team members and won the Team Match!",
        reorderMsg: "3 battles completed without reaching 4 pts. Rearrange order and restart from item #1!",
        disclaimer: "Unofficial fan-made score keeper tool based on BEYBLADE X Regulations (Asia Version) 12th Edition.",
        privacyNotice: "Privacy by Design: No backend, no cookies, no personal data collected. All data stays local.",
        vsSubMsg: "READY TO BATTLE!",
        btnStartVs: "START BATTLE",
        p2pTitle: "🌐 WebRTC P2P Multi-Device Hub",
        btnCreateHost: "👑 Host Room (Referee)",
        txtHostDesc: "Create room and share the 8-digit ID with players & spectators.",
        btnJoinPlayer: "🎮 Join as Player",
        btnJoinSpectator: "👁️ Join as Spectator",
        lblSubmitTitle: "📩 Submit Player / Team Roster",
        lblSelectMode: "Select Match Mode:",
        btnSubmitDeck: "🔒 Submit Privately to Referee",
        btnLeaveP2P: "🚪 Leave Room",
        btnOpenLobby: "🏟️ Host Lobby",
        lblRoom: "Room ID",
        lblConnected: "Devices",
        lobbyTitle: "🏟️ Referee Host Lobby",
        lobbyRoomTip: "Share this 8-digit Room ID with players & spectators:",
        lobbySelectMode: "👑 Select Match Mode:",
        lobbySlotsTip: "Rosters auto-fill upon submission, referee can also tweak manually:",
        lblLobbyP1: "👈 Left Side (Player 1 / Team A)",
        lblLobbyP2: "👉 Right Side (Player 2 / Team B)",
        lblLobbyP3: "👆 Middle (Player 3)",
        btnLobbyStart: "🔒 Lock Rosters & Start Match (All Screens)!",
        lblAutoAssignTip: "Please review submitted roster:",
        btnAutoAccept: "✅ Accept & Place in Lobby",
        spectatorWaiting: "⏳ Referee is setting up next match in Lobby, please wait...",
        p2pGuide: `
            <div style="color:var(--neon-blue); font-weight:bold; margin-bottom:4px;">📖 Connection Guide (Max 28 Devices):</div>
            <div style="margin-bottom:3px;">• <b>👑 Referee (Host)</b>: Create room once! Manage lobby, view capacity countdown, and start match.</div>
            <div style="margin-bottom:3px;">• <b>🎮 Player</b>: Enter Room ID & click 'Join as Player', submit secret deck to referee.</div>
            <div>• <b>👁️ Spectator</b>: Enter Room ID once to enjoy live sync scores, popups & battle logs!</div>
        `,
        rulesBody: `
            <div style="margin-bottom:12px;">
                <h3 style="color:var(--neon-blue); margin-bottom:4px;">1. Scoring Systems</h3>
                <ul style="padding-left:20px; font-size:0.85rem; color:#cbd5e1;">
                    <li><b>Xtreme Finish (3 pts)</b>: Bey completely enters Xtreme Zone.</li>
                    <li><b>Over Finish (2 pts)</b>: Bey completely enters Over Zone.</li>
                    <li><b>Burst Finish (2 pts)</b>: Opponent's Bey parts detach first.</li>
                    <li><b>Spin Finish (1 pt)</b>: Opponent's Bey stops spinning first.</li>
                </ul>
            </div>
        `
    }
};

function saveState() {
    const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    const state = {
        scoreP1, scoreP2, scoreP3,
        foulsP1, foulsP2, foulsP3,
        teamWinsP1, teamWinsP2, kofIndexP1, kofIndexP2,
        battleCount, matchMode, roster, isFinalTeamWinActive,
        p1Name: getVal('p1-title'),
        p2Name: getVal('p2-title'),
        p3Name: getVal('p3-title'),
        logs, currentLang
    };
    localStorage.setItem('bx_score_state', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('bx_score_state');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            scoreP1 = state.scoreP1 || 0;
            scoreP2 = state.scoreP2 || 0;
            scoreP3 = state.scoreP3 || 0;
            foulsP1 = state.foulsP1 || 0;
            foulsP2 = state.foulsP2 || 0;
            foulsP3 = state.foulsP3 || 0;
            teamWinsP1 = state.teamWinsP1 || 0;
            teamWinsP2 = state.teamWinsP2 || 0;
            kofIndexP1 = state.k1 || 0;
            kofIndexP2 = state.k2 || 0;
            isFinalTeamWinActive = state.isFinalTeamWinActive || false;
            battleCount = state.battleCount || 1;
            matchMode = state.matchMode || 'std';
            logs = Array.isArray(state.logs) ? state.logs : [];
            currentLang = state.currentLang || 'zh';

            if (state.roster) roster = state.roster;

            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            if (state.p1Name) setVal('p1-title', state.p1Name);
            if (state.p2Name) setVal('p2-title', state.p2Name);
            if (state.p3Name) setVal('p3-title', state.p3Name);

            setMatchMode(matchMode, false);
        } catch(e) {
            console.error("State restore failed:", e);
        }
    }
    applyLanguage();
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
}

loadState();
