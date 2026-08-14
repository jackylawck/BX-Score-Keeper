/* =========================================================================
 * 🌐 p2p.js - WebRTC PeerJS Multi-Device Sync & Lobby Module
 * ========================================================================= */

let peer = null;
let p2pConnMap = {}; 
let hostConn = null;  
let myPeerRole = 'none'; // 'host', 'player', 'spectator'
let currentRoomId = '';
let pendingClientData = null;
let occupiedSlots = { slot1: false, slot2: false, slot3: false };

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
        if (nameInput) nameInput.placeholder = currentLang === 'zh' ? '選手姓名 (例如 選手一)' : 'Player Name (e.g. Player 1)';
    } else if (mode === '3v3') {
        if (extraBox) extraBox.style.display = 'block';
        if (nameInput) nameInput.placeholder = currentLang === 'zh' ? '選手姓名 (例如 選手一)' : 'Player Name (e.g. Player 1)';
        safeSetInputPlaceholder('p2p-item-1', currentLang === 'zh' ? '陀螺 1 號 (ITEM #1)' : 'Bey #1 (ITEM #1)');
        safeSetInputPlaceholder('p2p-item-2', currentLang === 'zh' ? '陀螺 2 號 (ITEM #2)' : 'Bey #2 (ITEM #2)');
        safeSetInputPlaceholder('p2p-item-3', currentLang === 'zh' ? '陀螺 3 號 (ITEM #3)' : 'Bey #3 (ITEM #3)');
    } else if (mode === 'team') {
        if (extraBox) extraBox.style.display = 'block';
        if (nameInput) nameInput.placeholder = currentLang === 'zh' ? '隊伍名稱 (例如 隊伍 A)' : 'Team Name (e.g. Team A)';
        safeSetInputPlaceholder('p2p-item-1', currentLang === 'zh' ? '先鋒 1 號' : '1st Vanguard');
        safeSetInputPlaceholder('p2p-item-2', currentLang === 'zh' ? '中堅 2 號' : '2nd Middle');
        safeSetInputPlaceholder('p2p-item-3', currentLang === 'zh' ? '大將 3 號' : '3rd General');
    }
}

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

        // 🎯 關鍵修復 1：新設備連線進來，裁判立刻補發最新狀態（包含 Log 與名字）
        conn.on('open', () => {
            conn.send({
                type: 'STATE_SYNC',
                roster: roster,
                scoreP1, scoreP2, scoreP3,
                foulsP1, foulsP2, foulsP3,
                teamWinsP1, teamWinsP2, kofIndexP1, kofIndexP2,
                battleCount, matchMode,
                logs: logs
            });
        });

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
    let defP1 = currentLang === 'zh' ? '選手一' : 'Player 1';
    let defP2 = currentLang === 'zh' ? '選手二' : 'Player 2';
    let defP3 = currentLang === 'zh' ? '選手三' : 'Player 3';

    safeSetInputValue('lobby-p1-name', (roster.t1 && roster.t1[0]) ? roster.t1[0] : (matchMode === 'team' ? roster.t1Name : defP1));
    safeSetInputValue('lobby-p2-name', (roster.t2 && roster.t2[0]) ? roster.t2[0] : (matchMode === 'team' ? roster.t2Name : defP2));
    safeSetInputValue('lobby-p3-name', roster.t3Name || defP3);

    safeSetInputValue('lobby-p1-d1', (roster.t1 && roster.t1[0]) || (currentLang === 'zh' ? '陀螺一' : 'Bey 1'));
    safeSetInputValue('lobby-p1-d2', (roster.t1 && roster.t1[1]) || (currentLang === 'zh' ? '陀螺二' : 'Bey 2'));
    safeSetInputValue('lobby-p1-d3', (roster.t1 && roster.t1[2]) || (currentLang === 'zh' ? '陀螺三' : 'Bey 3'));

    safeSetInputValue('lobby-p2-d1', (roster.t2 && roster.t2[0]) || (currentLang === 'zh' ? '陀螺一' : 'Bey 1'));
    safeSetInputValue('lobby-p2-d2', (roster.t2 && roster.t2[1]) || (currentLang === 'zh' ? '陀螺二' : 'Bey 2'));
    safeSetInputValue('lobby-p2-d3', (roster.t2 && roster.t2[2]) || (currentLang === 'zh' ? '陀螺三' : 'Bey 3'));
}

function startMatchFromLobby() {
    let defP1 = currentLang === 'zh' ? '選手一' : 'Player 1';
    let defP2 = currentLang === 'zh' ? '選手二' : 'Player 2';
    let defP3 = currentLang === 'zh' ? '選手三' : 'Player 3';

    let p1Val = document.getElementById('lobby-p1-name').value.trim() || defP1;
    let p2Val = document.getElementById('lobby-p2-name').value.trim() || defP2;
    let p3Val = document.getElementById('lobby-p3-name').value.trim() || defP3;

    roster.t1Name = p1Val;
    roster.t2Name = p2Val;
    roster.t3Name = p3Val;

    if (matchMode === '3v3' || matchMode === 'team') {
        roster.t1 = [
            document.getElementById('lobby-p1-d1').value.trim() || (currentLang === 'zh' ? '陀螺一' : 'Bey 1'),
            document.getElementById('lobby-p1-d2').value.trim() || (currentLang === 'zh' ? '陀螺二' : 'Bey 2'),
            document.getElementById('lobby-p1-d3').value.trim() || (currentLang === 'zh' ? '陀螺三' : 'Bey 3')
        ];
        roster.t2 = [
            document.getElementById('lobby-p2-d1').value.trim() || (currentLang === 'zh' ? '陀螺一' : 'Bey 1'),
            document.getElementById('lobby-p2-d2').value.trim() || (currentLang === 'zh' ? '陀螺二' : 'Bey 2'),
            document.getElementById('lobby-p2-d3').value.trim() || (currentLang === 'zh' ? '陀螺三' : 'Bey 3')
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
        foulsP1, foulsP2, foulsP3,
        teamWinsP1, teamWinsP2, kofIndexP1, kofIndexP2,
        battleCount, matchMode,
        p1Show, p2Show,
        logs: logs
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
            safeSetDisplay('btn-open-lobby', 'none');
            
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
    let defName = currentLang === 'zh' ? '選手一' : 'Player 1';
    let name = document.getElementById('p2p-player-name').value.trim() || defName;
    let item1 = document.getElementById('p2p-item-1').value.trim() || (currentLang === 'zh' ? '陀螺一' : 'Bey 1');
    let item2 = document.getElementById('p2p-item-2').value.trim() || (currentLang === 'zh' ? '陀螺二' : 'Bey 2');
    let item3 = document.getElementById('p2p-item-3').value.trim() || (currentLang === 'zh' ? '陀螺三' : 'Bey 3');

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

/* 🎯 關鍵修復 2：完整解析全量同步封包，包含 Log、姓名與 KOF 輪替狀態 */
function handleClientReceivedData(data) {
    if (data.type === 'REJECT_FULL') {
        alert(currentLang === 'zh' ? "⚠️ 本局對戰名額已滿並由裁判鎖定！系統已自動將你切換為【觀眾觀戰】模式。" : "⚠️ Match slots are full! Switched to Spectator mode.");
        myPeerRole = 'spectator';
        safeSetText('p2p-role-badge', currentLang === 'zh' ? '👁️ SPECTATOR (觀眾)' : '👁️ SPECTATOR');
        safeSetDisplay('p2p-client-submit-box', 'none');
        closeP2PModal();
        setUIPermissions();
    } else if (data.type === 'STATE_SYNC' || data.type === 'MATCH_START_SYNC') {
        if (data.roster) roster = data.roster;
        scoreP1 = data.scoreP1 || 0;
        scoreP2 = data.scoreP2 || 0;
        scoreP3 = data.scoreP3 || 0;
        foulsP1 = data.foulsP1 || 0;
        foulsP2 = data.foulsP2 || 0;
        foulsP3 = data.foulsP3 || 0;
        teamWinsP1 = data.teamWinsP1 || 0;
        teamWinsP2 = data.teamWinsP2 || 0;
        kofIndexP1 = data.kofIndexP1 || 0;
        kofIndexP2 = data.kofIndexP2 || 0;
        battleCount = data.battleCount || 1;
        if (data.matchMode) matchMode = data.matchMode;
        if (Array.isArray(data.logs)) logs = data.logs;

        updatePlayerNamesForMode();
        updateDisplay();

        if (data.type === 'MATCH_START_SYNC') {
            triggerVersusAnimation(data.p1Show, data.p2Show);
        }
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
