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
    t1Name: 'Team A', t1: ['1', '2', '3'],
    t2Name: 'Team B', t2: ['A', 'B', 'C'],
    t3Name: 'PLAYER 3'
};

/* 🌐 WebRTC P2P 全局變數 */
let peer = null;
let p2pConnMap = {}; 
let hostConn = null;  
let myPeerRole = 'none'; // 'host', 'player', 'spectator'
let currentRoomId = '';
let pendingClientData = null;
let occupiedSlots = { slot1: false, slot2: false, slot3: false };

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

/* 🌐 WebRTC P2P 邏輯實作 */
function openP2PModal() { 
    applyLanguage();
    safeSetDisplay('p2p-modal', 'flex'); 
}
function closeP2PModal() { safeSetDisplay('p2p-modal', 'none'); }

function updateP2PFormFields() {
    let mode = document.getElementById('p2p-form-type').value;
    let extraBox = document.getElementById('p2p-extra-items');
    let nameInput = document.getElementById('p2p-player-name');

    if (mode === 'std' || mode === 'p3') {
        if (extraBox) extraBox.style.display = 'none';
        if (nameInput) nameInput.placeholder = currentLang === 'zh' ? '選手姓名 (例如 Daddy)' : 'Player Name (e.g. Daddy)';
    } else if (mode === '3v3') {
        if (extraBox) extraBox.style.display = 'block';
        if (nameInput) nameInput.placeholder = currentLang === 'zh' ? '選手姓名 (例如 Daddy)' : 'Player Name (e.g. Daddy)';
        safeSetInputPlaceholder('p2p-item-1', currentLang === 'zh' ? '陀螺 1 號 (ITEM #1)' : 'Bey #1 (ITEM #1)');
        safeSetInputPlaceholder('p2p-item-2', currentLang === 'zh' ? '陀螺 2 號 (ITEM #2)' : 'Bey #2 (ITEM #2)');
        safeSetInputPlaceholder('p2p-item-3', currentLang === 'zh' ? '陀螺 3 號 (ITEM #3)' : 'Bey #3 (ITEM #3)');
    } else if (mode === 'team') {
        if (extraBox) extraBox.style.display = 'block';
        if (nameInput) nameInput.placeholder = currentLang === 'zh' ? '隊伍名稱 (例如 Team A)' : 'Team Name (e.g. Team A)';
        safeSetInputPlaceholder('p2p-item-1', currentLang === 'zh' ? '先鋒 1 號' : '1st Vanguard');
        safeSetInputPlaceholder('p2p-item-2', currentLang === 'zh' ? '中堅 2 號' : '2nd Middle');
        safeSetInputPlaceholder('p2p-item-3', currentLang === 'zh' ? '大將 3 號' : '3rd General');
    }
}

function safeSetInputPlaceholder(id, txt) {
    const el = document.getElementById(id);
    if (el) el.placeholder = txt;
}

/* 👑 裁判建立房間 ➔ 直接進入【🏟️ 裁判等候大廳】 */
function initP2PHost() {
    if (peer) peer.destroy();
    
    let randomNum = Math.floor(10000000 + Math.random() * 90000000).toString();
    currentRoomId = `bx-${randomNum}`;

    peer = new Peer(currentRoomId);
    
    peer.on('open', (id) => {
        myPeerRole = 'host';
        occupiedSlots = { slot1: false, slot2: false, slot3: false };
        setUIPermissions();
        
        safeSetDisplay('p2p-status-bar', 'block');
        safeSetText('p2p-role-badge', currentLang === 'zh' ? 'HOST (裁判)' : 'HOST (Referee)');
        safeSetText('p2p-current-room', randomNum);
        safeSetText('p2p-connected-count', '0');

        closeP2PModal();
        openLobbyModal();
    });

    peer.on('connection', (conn) => {
        p2pConnMap[conn.peer] = conn;
        updateConnectedCount();

        conn.on('data', (data) => {
            handleHostReceivedData(data, conn);
        });

        conn.on('close', () => {
            delete p2pConnMap[conn.peer];
            updateConnectedCount();
        });
    });

    peer.on('error', (err) => {
        alert("Peer Error: " + err.type);
    });
}

function updateConnectedCount() {
    let count = Object.keys(p2pConnMap).length;
    safeSetText('p2p-connected-count', count);
    safeSetText('lobby-connected-count', count);
}

/* 🏟️ 裁判等候大廳 (Lobby) 邏輯 */
function openLobbyModal() {
    if (myPeerRole !== 'host') return;
    
    let rawRoomNum = currentRoomId.replace('bx-', '');
    safeSetText('lobby-display-room', rawRoomNum);
    updateConnectedCount();

    const modeSelect = document.getElementById('lobby-match-mode');
    if (modeSelect) modeSelect.value = matchMode;

    syncRosterToLobbyUI();
    applyLobbyLayout();
    safeSetDisplay('lobby-modal', 'flex');
}

function closeLobbyModal() { safeSetDisplay('lobby-modal', 'none'); }

function handleLobbyModeChange() {
    let newMode = document.getElementById('lobby-match-mode').value;
    setMatchMode(newMode);
    applyLobbyLayout();
    broadcastToClients({ type: 'MODE_SYNC', mode: newMode });
}

function applyLobbyLayout() {
    let is3v3OrTeam = (matchMode === '3v3' || matchMode === 'team');
    safeSetDisplay('lobby-p1-deck-box', is3v3OrTeam ? 'block' : 'none');
    safeSetDisplay('lobby-p2-deck-box', is3v3OrTeam ? 'block' : 'none');
    safeSetDisplay('lobby-p3-box', (matchMode === 'p3') ? 'block' : 'none');
}

function syncRosterToLobbyUI() {
    safeSetInputValue('lobby-p1-name', (roster.t1 && roster.t1[0]) ? roster.t1[0] : (matchMode === 'team' ? roster.t1Name : '1'));
    safeSetInputValue('lobby-p2-name', (roster.t2 && roster.t2[0]) ? roster.t2[0] : (matchMode === 'team' ? roster.t2Name : 'A'));
    safeSetInputValue('lobby-p3-name', roster.t3Name || 'PLAYER 3');

    safeSetInputValue('lobby-p1-d1', (roster.t1 && roster.t1[0]) || '1');
    safeSetInputValue('lobby-p1-d2', (roster.t1 && roster.t1[1]) || '2');
    safeSetInputValue('lobby-p1-d3', (roster.t1 && roster.t1[2]) || '3');

    safeSetInputValue('lobby-p2-d1', (roster.t2 && roster.t2[0]) || 'A');
    safeSetInputValue('lobby-p2-d2', (roster.t2 && roster.t2[1]) || 'B');
    safeSetInputValue('lobby-p2-d3', (roster.t2 && roster.t2[2]) || 'C');
}

/* 裁判在等候大廳按下「🔒 鎖定排陣並邀請全場開賽！」 */
function startMatchFromLobby() {
    let p1Val = document.getElementById('lobby-p1-name').value.trim() || '1';
    let p2Val = document.getElementById('lobby-p2-name').value.trim() || 'A';
    let p3Val = document.getElementById('lobby-p3-name').value.trim() || 'PLAYER 3';

    roster.t1Name = p1Val;
    roster.t2Name = p2Val;
    roster.t3Name = p3Val;

    if (matchMode === '3v3' || matchMode === 'team') {
        roster.t1 = [
            document.getElementById('lobby-p1-d1').value.trim() || '1',
            document.getElementById('lobby-p1-d2').value.trim() || '2',
            document.getElementById('lobby-p1-d3').value.trim() || '3'
        ];
        roster.t2 = [
            document.getElementById('lobby-p2-d1').value.trim() || 'A',
            document.getElementById('lobby-p2-d2').value.trim() || 'B',
            document.getElementById('lobby-p2-d3').value.trim() || 'C'
        ];
    } else {
        roster.t1[0] = p1Val;
        roster.t2[0] = p2Val;
    }

    occupiedSlots.slot1 = true;
    occupiedSlots.slot2 = true;
    if (matchMode === 'p3') occupiedSlots.slot3 = true;

    closeLobbyModal();

    updatePlayerNamesForMode();
    saveState();
    updateDisplay();

    let p1Show = document.getElementById('p1-title').value;
    let p2Show = document.getElementById('p2-title').value;

    broadcastToClients({
        type: 'MATCH_START_SYNC',
        roster: roster,
        scoreP1, scoreP2, scoreP3,
        battleCount, matchMode,
        p1Show, p2Show
    });

    triggerVersusAnimation(p1Show, p2Show);
}

function joinP2PRoom(roleType) {
    let inputId = document.getElementById('p2p-input-room').value.trim();
    if (!inputId || inputId.length < 8) {
        alert(currentLang === 'zh' ? "請輸入正確的 8 位數房間 ID！" : "Please enter a valid 8-digit Room ID!");
        return;
    }

    if (peer) peer.destroy();
    peer = new Peer();

    peer.on('open', () => {
        myPeerRole = roleType;
        let targetPeerId = `bx-${inputId}`;
        hostConn = peer.connect(targetPeerId);

        hostConn.on('open', () => {
            currentRoomId = inputId;
            safeSetDisplay('p2p-status-bar', 'block');
            safeSetDisplay('btn-open-lobby', 'none'); // 選手和觀眾不顯示等候大廳按鈕
            
            if (roleType === 'spectator') {
                safeSetText('p2p-role-badge', currentLang === 'zh' ? '👁️ SPECTATOR (觀眾)' : '👁️ SPECTATOR');
                safeSetDisplay('p2p-client-submit-box', 'none');
                closeP2PModal();
                alert(currentLang === 'zh' ? "已成功連線至裁判房間！你正處於【觀眾直播模式】。" : "Connected to Referee! You are in Spectator Live mode.");
            } else {
                safeSetText('p2p-role-badge', currentLang === 'zh' ? '🎮 PLAYER (選手)' : '🎮 PLAYER');
                safeSetDisplay('p2p-client-submit-box', 'block');
                updateP2PFormFields();
                alert(currentLang === 'zh' ? "已成功連線至裁判房間！請填寫資料並送出。" : "Connected! Please fill in your roster and submit.");
            }

            setUIPermissions();
            safeSetText('p2p-current-room', inputId);
            safeSetText('p2p-connected-count', currentLang === 'zh' ? '已連線' : 'Connected');
        });

        hostConn.on('data', (data) => {
            handleClientReceivedData(data);
        });

        hostConn.on('error', (err) => {
            if (err.type === 'peer-unavailable') {
                alert(currentLang === 'zh' ? "⚠️ 連線失敗：找不到此對戰房間！請確認裁判已建立房間且 8 位數 ID 正確。" : "⚠️ Connection Failed: Room not found! Please check Room ID.");
            } else {
                alert("Connection Error: " + err.type);
            }
        });
    });
}

function leaveP2PRoom() {
    let confirmMsg = currentLang === 'zh' ? "確定要離開目前的對戰房間嗎？" : "Are you sure you want to leave the room?";
    if (confirm(confirmMsg)) {
        if (peer) peer.destroy();
        peer = null;
        hostConn = null;
        p2pConnMap = {};
        myPeerRole = 'none';
        
        safeSetDisplay('p2p-status-bar', 'none');
        setUIPermissions();
        alert(currentLang === 'zh' ? "已離開房間，恢復單機計分模式。" : "Left room. Returned to offline mode.");
    }
}

function setUIPermissions() {
    const isReadOnly = (myPeerRole === 'spectator');
    
    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.style.pointerEvents = isReadOnly ? 'none' : 'auto';
        btn.style.opacity = isReadOnly ? '0.6' : '1';
    });

    const mainControls = document.getElementById('main-controls');
    if (mainControls) mainControls.style.display = isReadOnly ? 'none' : 'flex';
}

function sendClientDeckToHost() {
    if (!hostConn || !hostConn.open) {
        alert(currentLang === 'zh' ? "未連線至裁判端！" : "Not connected to Referee!");
        return;
    }

    let mode = document.getElementById('p2p-form-type').value;
    let name = document.getElementById('p2p-player-name').value.trim() || (currentLang === 'zh' ? '選手' : 'Player');
    let item1 = document.getElementById('p2p-item-1').value.trim() || '1';
    let item2 = document.getElementById('p2p-item-2').value.trim() || '2';
    let item3 = document.getElementById('p2p-item-3').value.trim() || '3';

    let payload = {
        type: 'SUBMIT_DECK',
        formMode: mode,
        name: name,
        items: [item1, item2, item3]
    };

    hostConn.send(payload);
    alert(currentLang === 'zh' ? "已送出給裁判，等待裁判審核並排入大廳！" : "Submitted! Waiting for Referee approval.");
}

function handleHostReceivedData(data, conn) {
    if (data.type === 'SUBMIT_DECK') {
        let isFull = (matchMode === 'p3') 
            ? (occupiedSlots.slot1 && occupiedSlots.slot2 && occupiedSlots.slot3)
            : (occupiedSlots.slot1 && occupiedSlots.slot2);

        if (isFull) {
            conn.send({ type: 'REJECT_FULL' });
            return;
        }

        pendingClientData = data;
        safeSetText('p2p-request-title', currentLang === 'zh' ? `收到 [ ${data.name} ] 的排陣提交` : `Received Roster from [ ${data.name} ]`);
        
        let modeLabel = data.formMode === '3v3' ? '3on3' : (data.formMode === 'team' ? 'Team' : '1v1 / 3-Player');
        let bodyHtml = `
            <b>${currentLang === 'zh' ? '賽制類型' : 'Mode'}:</b> ${modeLabel}<br>
            <b>${currentLang === 'zh' ? '名稱' : 'Name'}:</b> ${data.name}<br>
        `;
        if (data.formMode === '3v3' || data.formMode === 'team') {
            bodyHtml += `
                <b>#1:</b> ${data.items[0]}<br>
                <b>#2:</b> ${data.items[1]}<br>
                <b>#3:</b> ${data.items[2]}
            `;
        }
        const modalBody = document.getElementById('p2p-request-body');
        if (modalBody) modalBody.innerHTML = bodyHtml;

        safeSetDisplay('p2p-slot3-btn', data.formMode === 'p3' || matchMode === 'p3' ? 'inline-block' : 'none');
        safeSetDisplay('p2p-confirm-modal', 'flex');
    }
}

/* 裁判將選手提交分配到 Slot 1 / 2 / 3 ➔ 自動帶入等候大廳 */
function acceptClientSubmission(targetSlot) {
    if (!pendingClientData) return;

    let data = pendingClientData;
    setMatchMode(data.formMode);

    if (targetSlot === 1) {
        roster.t1Name = data.name;
        roster.t1[0] = data.name;
        if (data.items && data.items.length) roster.t1 = [...data.items];
        occupiedSlots.slot1 = true;
    } else if (targetSlot === 2) {
        roster.t2Name = data.name;
        roster.t2[0] = data.name;
        if (data.items && data.items.length) roster.t2 = [...data.items];
        occupiedSlots.slot2 = true;
    } else if (targetSlot === 3) {
        roster.t3Name = data.name;
        occupiedSlots.slot3 = true;
    }

    safeSetDisplay('p2p-confirm-modal', 'none');
    openLobbyModal();
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
    if (myPeerRole === 'host') {
        broadcastToClients({ type: 'STATE_SYNC', roster, scoreP1, scoreP2, scoreP3, battleCount, matchMode });
    }
}

function safeSetInputValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function handleClientReceivedData(data) {
    if (data.type === 'REJECT_FULL') {
        alert(currentLang === 'zh' ? "⚠️ 本局對戰名額已滿並由裁判鎖定！系統已自動將你切換為【觀眾觀戰】模式。" : "⚠️ Match slots are full! Switched to Spectator mode.");
        myPeerRole = 'spectator';
        safeSetText('p2p-role-badge', currentLang === 'zh' ? '👁️ SPECTATOR (觀眾)' : '👁️ SPECTATOR');
        safeSetDisplay('p2p-client-submit-box', 'none');
        closeP2PModal();
        setUIPermissions();
    } else if (data.type === 'STATE_SYNC') {
        roster = data.roster;
        scoreP1 = data.scoreP1;
        scoreP2 = data.scoreP2;
        scoreP3 = data.scoreP3;
        battleCount = data.battleCount;
        matchMode = data.matchMode;

        updatePlayerNamesForMode();
        updateDisplay();
    } else if (data.type === 'MATCH_START_SYNC') {
        roster = data.roster;
        scoreP1 = data.scoreP1;
        scoreP2 = data.scoreP2;
        scoreP3 = data.scoreP3;
        battleCount = data.battleCount;
        matchMode = data.matchMode;

        updatePlayerNamesForMode();
        updateDisplay();
        triggerVersusAnimation(data.p1Show, data.p2Show);
    } else if (data.type === 'MODE_SYNC') {
        setMatchMode(data.mode);
    }
}

function broadcastToClients(payload) {
    if (myPeerRole !== 'host') return;
    Object.values(p2pConnMap).forEach(conn => {
        if (conn && conn.open) {
            conn.send(payload);
        }
    });
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
        p2pTitle: "🌐 WebRTC P2P 跨機連線",
        btnCreateHost: "👑 建立對戰房間 (裁判主機)",
        txtHostDesc: "建立房間後，將 8 位數 ID 告知對手與現場觀眾。",
        btnJoinPlayer: "🎮 選手連線",
        btnJoinSpectator: "👁️ 觀眾觀戰",
        lblSubmitTitle: "📩 提交個人 / 隊伍排陣名單",
        lblSelectMode: "選擇欲提交的賽制模式：",
        btnSubmitDeck: "🔒 私密送出給裁判審核",
        lblChoosePos: "請選擇放入大廳的位置：",
        btnSlot1: "👈 放左邊 (Player 1)",
        btnSlot2: "👉 放右邊 (Player 2)",
        btnLeaveP2P: "🚪 離開房間",
        btnOpenLobby: "🏟️ 等候大廳",
        lblRoom: "房間 ID",
        lblConnected: "已連線設備",
        lobbyTitle: "🏟️ 裁判等候大廳 (Host Lobby)",
        lobbyRoomTip: "請告知選手與觀眾輸入此 8 位數房間 ID：",
        lobbySelectMode: "👑 選擇本局賽事模式：",
        lobbySlotsTip: "選手連線送出後將自動填入，裁判亦可直接手動修改：",
        btnLobbyStart: "🔒 鎖定排陣並邀請全場開賽！",
        p2pGuide: `
            <div style="color:var(--neon-blue); font-weight:bold; margin-bottom:4px;">📖 連線玩法指南：</div>
            <div style="margin-bottom:3px;">• <b>👑 裁判端</b>：點擊「建立對戰房間」，進入等候大廳，可選賽制、修改雙方排陣並一鍵全場開賽。</div>
            <div style="margin-bottom:3px;">• <b>🎮 選手端</b>：輸入房間 ID 點擊「選手連線」，在自己手機私密填寫陀螺/隊員送出。</div>
            <div>• <b>👁️ 觀眾端</b>：輸入房間 ID 點擊「觀眾觀戰」，畫面將即時同步大螢幕賽果與動畫！</div>
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
        lblChoosePos: "Assign player to Lobby slot:",
        btnSlot1: "👈 Place Left (Player 1)",
        btnSlot2: "👉 Place Right (Player 2)",
        btnLeaveP2P: "🚪 Leave Room",
        btnOpenLobby: "🏟️ Host Lobby",
        lblRoom: "Room ID",
        lblConnected: "Devices",
        lobbyTitle: "🏟️ Referee Host Lobby",
        lobbyRoomTip: "Share this 8-digit Room ID with players & spectators:",
        lobbySelectMode: "👑 Select Match Mode:",
        lobbySlotsTip: "Rosters auto-fill upon submission, referee can also tweak manually:",
        btnLobbyStart: "🔒 Lock Rosters & Start Match (All Screens)!",
        p2pGuide: `
            <div style="color:var(--neon-blue); font-weight:bold; margin-bottom:4px;">📖 Connection Guide:</div>
            <div style="margin-bottom:3px;">• <b>👑 Referee (Host)</b>: Create room, manage lobby, select mode, tweak rosters, and start match.</div>
            <div style="margin-bottom:3px;">• <b>🎮 Player</b>: Enter Room ID & click 'Join as Player', submit secret deck to referee.</div>
            <div>• <b>👁️ Spectator</b>: Enter Room ID & click 'Join as Spectator' for live sync scoreboard!</div>
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

function safeSetDisplay(id, val) { const el = document.getElementById(id); if (el) el.style.display = val; }
function safeSetText(id, val) { const el = document.getElementById(id); if (el) el.innerText = val; }

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

    if (myPeerRole === 'host') {
        broadcastToClients({ type: 'MODE_SYNC', mode });
    }
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
        let p1Name = (roster.t1 && roster.t1[idx1]) ? roster.t1[idx1] : `${idx1 + 1}`;
        let p2Name = (roster.t2 && roster.t2[idx2]) ? roster.t2[idx2] : `${String.fromCharCode(65 + idx2)}`;
        
        if (p1Title) p1Title.value = `${p1Name} (${t1Name})`;
        if (p2Title) p2Title.value = `${p2Name} (${t2Name})`;
    } else if (matchMode === '3v3' || matchMode === 'std') {
        if (p1Title && roster.t1[0]) p1Title.value = roster.t1[0];
        if (p2Title && roster.t2[0]) p2Title.value = roster.t2[0];
    } else if (matchMode === 'p3') {
        if (p1Title && roster.t1[0]) p1Title.value = roster.t1[0];
        if (p2Title && roster.t2[0]) p2Title.value = roster.t2[0];
        if (p3Title) p3Title.value = roster.t3Name || 'PLAYER 3';
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

    broadcastToClients({ type: 'STATE_SYNC', roster, scoreP1, scoreP2, scoreP3, battleCount, matchMode });
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
    broadcastToClients({ type: 'STATE_SYNC', roster, scoreP1, scoreP2, scoreP3, battleCount, matchMode });

    if (checkWinner()) return;

    if (matchMode === '3v3' && (battleCount - 1) % 3 === 0) {
        if (scoreP1 < 4 && scoreP2 < 4) {
            setTimeout(() => {
                alert(i18n[currentLang].reorderMsg);
                battleCount = 1;
                updateDisplay();
                saveState();
                broadcastToClients({ type: 'STATE_SYNC', roster, scoreP1, scoreP2, scoreP3, battleCount, matchMode });
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
    broadcastToClients({ type: 'STATE_SYNC', roster, scoreP1, scoreP2, scoreP3, battleCount, matchMode });
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
    broadcastToClients({ type: 'STATE_SYNC', roster, scoreP1, scoreP2, scoreP3, battleCount, matchMode });
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
    broadcastToClients({ type: 'STATE_SYNC', roster, scoreP1, scoreP2, scoreP3, battleCount, matchMode });
    triggerVersusAnimation(document.getElementById('p1-title').value, document.getElementById('p2-title').value);
}

function resetBattleCounter() {
    if (matchMode === '3v3') {
        battleCount = 1;
        updateDisplay();
        saveState();
        broadcastToClients({ type: 'STATE_SYNC', roster, scoreP1, scoreP2, scoreP3, battleCount, matchMode });
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
        broadcastToClients({ type: 'STATE_SYNC', roster, scoreP1, scoreP2, scoreP3, battleCount, matchMode });
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

        localStorage.removeItem('bx_score_state');
        updatePlayerNamesForMode();
        updateDisplay();
        saveState();
        applyLanguage();
        broadcastToClients({ type: 'STATE_SYNC', roster, scoreP1, scoreP2, scoreP3, battleCount, matchMode });
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

    /* 🌐 P2P Modal 雙語 */
    safeSetText('p2p-modal-title', lang.p2pTitle);
    safeSetText('btn-create-host', lang.btnCreateHost);
    safeSetText('txt-host-desc', lang.txtHostDesc);
    safeSetText('btn-join-player', lang.btnJoinPlayer);
    safeSetText('btn-join-spectator', lang.btnJoinSpectator);
    safeSetText('lbl-submit-title', lang.lblSubmitTitle);
    safeSetText('lbl-select-mode', lang.lblSelectMode);
    safeSetText('btn-submit-deck', lang.btnSubmitDeck);
    safeSetText('lbl-choose-pos', lang.lblChoosePos);
    safeSetText('btn-slot1', lang.btnSlot1);
    safeSetText('btn-slot2', lang.btnSlot2);
    safeSetText('btn-leave-p2p', lang.btnLeaveP2P);
    safeSetText('btn-open-lobby', lang.btnOpenLobby);
    safeSetText('p2p-lbl-room', lang.lblRoom);
    safeSetText('p2p-lbl-connected', lang.lblConnected);

    /* 🏟️ Lobby 雙語 */
    safeSetText('lbl-lobby-title', lang.lobbyTitle);
    safeSetText('lbl-lobby-room-tip', lang.lobbyRoomTip);
    safeSetText('lbl-lobby-select-mode', lang.lobbySelectMode);
    safeSetText('lbl-lobby-slots-tip', lang.lobbySlotsTip);
    safeSetText('btn-lobby-start', lang.btnLobbyStart);

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
