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

let roster = {
    t1Name: '', t1: ['', '', ''],
    t2Name: '', t2: ['', '', '']
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

/* 安全設定元素樣式 */
function safeSetDisplay(id, val) {
    const el = document.getElementById(id);
    if (el) el.style.display = val;
}

/* 安全設定元素文字 */
function safeSetText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

function setMatchMode(mode) {
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

    resetMatch(false);

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
}

function updatePlayerNamesForMode() {
    const p1Title = document.getElementById('p1-title');
    const p2Title = document.getElementById('p2-title');
    const p3Title = document.getElementById('p3-title');

    if (matchMode === 'team') {
        let t1Name = roster.t1Name || 'Team A';
        let t2Name = roster.t2Name || 'Team B';
        let idx1 = Math.min(kofIndexP1, 2);
        let idx2 = Math.min(kofIndexP2, 2);
        let p1Name = roster.t1[idx1] || `${idx1 + 1}`;
        let p2Name = roster.t2[idx2] || `${String.fromCharCode(65 + idx2)}`;
        
        if (p1Title) p1Title.value = `${p1Name} (${t1Name})`;
        if (p2Title) p2Title.value = `${p2Name} (${t2Name})`;
    } else if (matchMode === '3v3' || matchMode === 'std') {
        if (p1Title) p1Title.value = roster.t1[0] || '1';
        if (p2Title) p2Title.value = roster.t2[0] || 'A';
    } else if (matchMode === 'p3') {
        if (p1Title) p1Title.value = roster.t1[0] || '1';
        if (p2Title) p2Title.value = roster.t2[0] || 'A';
        if (p3Title) p3Title.value = 'PLAYER 3';
    }
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
    setVal('roster-t1-p1', roster.t1[0] || '');
    setVal('roster-t1-p2', roster.t1[1] || '');
    setVal('roster-t1-p3', roster.t1[2] || '');

    setVal('roster-t2-name', roster.t2Name || '');
    setVal('roster-t2-p1', roster.t2[0] || '');
    setVal('roster-t2-p2', roster.t2[1] || '');
    setVal('roster-t2-p3', roster.t2[2] || '');

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
    roster.t1Name = getVal('roster-t1-name', 'Team A');
    roster.t1[0] = getVal('roster-t1-p1', '1');
    roster.t1[1] = getVal('roster-t1-p2', '2');
    roster.t1[2] = getVal('roster-t1-p3', '3');

    roster.t2Name = getVal('roster-t2-name', 'Team B');
    roster.t2[0] = getVal('roster-t2-p1', 'A');
    roster.t2[1] = getVal('roster-t2-p2', 'B');
    roster.t2[2] = getVal('roster-t2-p3', 'C');

    kofIndexP1 = 0;
    kofIndexP2 = 0;
    isFinalTeamWinActive = false;

    closeRosterModal();
    setMatchMode('team');
    
    let p1Show = `${roster.t1[0]} (${roster.t1Name})`;
    let p2Show = `${roster.t2[0]} (${roster.t2Name})`;
    triggerVersusAnimation(p1Show, p2Show);
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

    if (checkWinner()) return;

    if (matchMode === '3v3' && (battleCount - 1) % 3 === 0) {
        if (scoreP1 < 4 && scoreP2 < 4) {
            setTimeout(() => {
                alert(i18n[currentLang].reorderMsg);
                battleCount = 1;
                updateDisplay();
                saveState();
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
}

function nextKOFRound() {
    if (isFinalTeamWinActive) return;

    if (scoreP1 >= targetScore) {
        kofIndexP2++;
    } else if (scoreP2 >= targetScore) {
        kofIndexP1++;
    }

    if (kofIndexP1 >= 3) {
        let winnerTeam = roster.t2Name || 'Team B';
        showWinModal(winnerTeam, true);
        return;
    } else if (kofIndexP2 >= 3) {
        let winnerTeam = roster.t1Name || 'Team A';
        showWinModal(winnerTeam, true);
        return;
    }

    updatePlayerNamesForMode();

    scoreP1 = 0; scoreP2 = 0; scoreP3 = 0;
    foulsP1 = 0; foulsP2 = 0; foulsP3 = 0;
    battleCount = 1;

    updateDisplay();
    saveState();
    triggerVersusAnimation(document.getElementById('p1-title').value, document.getElementById('p2-title').value);
}

function resetBattleCounter() {
    if (matchMode === '3v3') {
        battleCount = 1;
        updateDisplay();
        saveState();
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

        updatePlayerNamesForMode();

        updateDisplay();
        saveState();
    }
}

function resetMatch(askConfirm = true) {
    if (!askConfirm || confirm("Reset entire match/scores? / 確定重置賽事？")) {
        scoreP1 = 0; scoreP2 = 0; scoreP3 = 0;
        foulsP1 = 0; foulsP2 = 0; foulsP3 = 0;
        teamWinsP1 = 0; teamWinsP2 = 0;
        kofIndexP1 = 0; kofIndexP2 = 0;
        battleCount = 1;
        history = []; logs = [];
        isFinalTeamWinActive = false;
        localStorage.removeItem('bx_score_state');
        updatePlayerNamesForMode();
        updateDisplay();
        saveState();
        applyLanguage();
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
        let t1Label = roster.t1Name || 'Team A';
        let t2Label = roster.t2Name || 'Team B';
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
        return true;
    } else if (scoreP2 >= targetScore) {
        if (matchMode === 'team') teamWinsP2++;
        playBeep(880, 'triangle', 0.3);
        let isFinal = matchMode !== 'team';
        showWinModal(name2, isFinal);
        return true;
    } else if (matchMode === 'p3' && scoreP3 >= targetScore) {
        playBeep(880, 'triangle', 0.3);
        showWinModal(name3, true);
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

    document.querySelectorAll('.txt-xtreme').forEach(el => el.innerText = lang.xtreme);
    document.querySelectorAll('.txt-over').forEach(el => el.innerText = lang.over);
    document.querySelectorAll('.txt-burst').forEach(el => el.innerText = lang.burst);
    document.querySelectorAll('.txt-spin').forEach(el => el.innerText = lang.spin);

    safeSetText('txt-foul-p1', lang.foulTxt);
    safeSetText('txt-foul-p2', lang.foulTxt);
    safeSetText('txt-foul-p3', lang.foulTxt);
}

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

            setMatchMode(matchMode);
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
