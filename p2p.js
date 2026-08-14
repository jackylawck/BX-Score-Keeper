/* =========================================================================
 * 🌐 p2p.js - WebRTC PeerJS Module (Rock-Solid Live Sync Fix)
 * ========================================================================= */

const MAX_DEVICES = 15;

const P2P_EVENTS = {
    PING: 'PING',
    PONG: 'PONG',
    REQUEST_SYNC: 'REQUEST_SYNC',
    INIT_SYNC: 'INIT_SYNC',
    STATE_SYNC: 'STATE_SYNC',
    MATCH_START_SYNC: 'MATCH_START_SYNC',
    WIN_SYNC: 'WIN_SYNC',
    CLOSE_WIN_SYNC: 'CLOSE_WIN_SYNC',
    MODE_SYNC: 'MODE_SYNC',
    SUBMIT_DECK: 'SUBMIT_DECK',
    LOBBY_WAITING: 'LOBBY_WAITING',
    REJECT_FULL: 'REJECT_FULL',
    ROOM_CAPACITY_FULL: 'ROOM_CAPACITY_FULL',
    DEVICE_COUNT_SYNC: 'DEVICE_COUNT_SYNC'
};

let peer = null;
let p2pConnMap = {}; 
let hostConn = null;  
let myPeerRole = 'none'; // 'host', 'player', 'spectator'
let currentRoomId = '';
let pendingClientData = null;
let occupiedSlots = { slot1: false, slot2: false, slot3: false };
let isMatchLocked = false;
let heartbeatTimer = null;
let connectTimeoutTimer = null;

// 🌐 強化版 STUN 伺服器池（專門穿透 5G / 家居 WiFi）
const PEER_CONFIG = {
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' }
        ],
        iceCandidatePoolSize: 10
    }
};

function openP2PModal() { 
    applyLanguage();
    safeSetDisplay('p2p-modal', 'flex'); 
}
function closeP2PModal() { safeSetDisplay('p2p-modal', 'none'); }

function updateP2PFormFields() {
    let mode = document.getElementById('p2p-form-type').value;
    let extraBox = document.getElementById('p2p-extra-items');
    let nameInput = document.getElementById('p2p-player-name');

    if (mode === 'std') {
        if (extraBox) extraBox.style.display = 'none';
        if (nameInput) nameInput.placeholder = currentLang === 'zh' ? '選手姓名 (例如 BB)' : 'Player Name (e.g. BB)';
    } else if (mode === 'p3') {
        if (extraBox) extraBox.style.display = 'none';
        if (nameInput) nameInput.placeholder = currentLang === 'zh' ? '選手姓名 (例如 嚟沒火)' : 'Player Name (e.g. Player 3)';
    } else if (mode === '3v3') {
        if (extraBox) extraBox.style.display = 'block';
        if (nameInput) nameInput.placeholder = currentLang === 'zh' ? '選手姓名 (例如 BB)' : 'Player Name (e.g. BB)';
        safeSetInputPlaceholder('p2p-item-1', currentLang === 'zh' ? '陀螺 1 號' : 'Bey #1');
        safeSetInputPlaceholder('p2p-item-2', currentLang === 'zh' ? '陀螺 2 號' : 'Bey #2');
        safeSetInputPlaceholder('p2p-item-3', currentLang === 'zh' ? '陀螺 3 號' : 'Bey #3');
    } else if (mode === 'team') {
        if (extraBox) extraBox.style.display = 'block';
        if (nameInput) nameInput.placeholder = currentLang === 'zh' ? '隊伍名稱 (例如 Daddy)' : 'Team Name (e.g. Daddy)';
        safeSetInputPlaceholder('p2p-item-1', currentLang === 'zh' ? '先鋒 1 號' : '1st Vanguard');
        safeSetInputPlaceholder('p2p-item-2', currentLang === 'zh' ? '中堅 2 號' : '2nd Middle');
        safeSetInputPlaceholder('p2p-item-3', currentLang === 'zh' ? '大將 3 號' : '3rd General');
    }
}

function initP2PHost() {
    if (peer && !peer.destroyed) {
        openLobbyModal();
        return;
    }
    
    let randomNum = Math.floor(10000000 + Math.random() * 90000000).toString();
    currentRoomId = `bx-${randomNum}`;

    peer = new Peer(currentRoomId, PEER_CONFIG);
    
    peer.on('open', (id) => {
        myPeerRole = 'host';
        p2pConnMap = {};
        occupiedSlots = { slot1: false, slot2: false, slot3: false };
        isMatchLocked = false;
        setUIPermissions();
        
        safeSetDisplay('p2p-status-bar', 'block');
        safeSetText('p2p-role-badge', currentLang === 'zh' ? 'HOST (裁判)' : 'HOST (Referee)');
        safeSetText('p2p-current-room', randomNum);
        updateConnectedCount();

        startHeartbeat();
        closeP2PModal();
        openLobbyModal();
    });

    peer.on('connection', (conn) => handleNewHostConnection(conn));

    peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            initP2PHost();
        } else {
            console.error("Peer Host Error:", err);
        }
    });
}

/* 🎯 關鍵修復：嚴謹處理連線握手，絕不提前誤刪有效連線 */
function handleNewHostConnection(conn) {
    const handleOpen = () => {
        if (Object.keys(p2pConnMap).length >= MAX_DEVICES) {
            conn.send({ type: P2P_EVENTS.ROOM_CAPACITY_FULL });
            setTimeout(() => conn.close(), 500);
            return;
        }

        p2pConnMap[conn.peer] = conn;
        updateConnectedCount();

        // 立即向客戶端發送最新完整比分與紀錄
        conn.send({
            type: P2P_EVENTS.INIT_SYNC,
            ...getFullState(),
            connectedCount: Object.keys(p2pConnMap).length
        });

        broadcastDeviceCount();
    };

    if (conn.open) {
        handleOpen();
    } else {
        conn.on('open', handleOpen);
    }

    conn.on('data', (data) => {
        if (data.type === P2P_EVENTS.PING) {
            try { conn.send({ type: P2P_EVENTS.PONG }); } catch(e) {}
            return;
        }
        if (data.type === P2P_EVENTS.REQUEST_SYNC) {
            try {
                conn.send({
                    type: P2P_EVENTS.INIT_SYNC,
                    ...getFullState(),
                    connectedCount: Object.keys(p2pConnMap).length
                });
            } catch(e) {}
            return;
        }
        handleHostReceivedData(data, conn);
    });

    const handleClose = () => {
        delete p2pConnMap[conn.peer];
        updateConnectedCount();
        broadcastDeviceCount();
    };

    conn.on('close', handleClose);
    conn.on('error', handleClose);
}

function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        if (myPeerRole === 'host') {
            broadcastToClients({ type: P2P_EVENTS.PING });
        } else if (hostConn && hostConn.open) {
            try { hostConn.send({ type: P2P_EVENTS.PING }); } catch(e) {}
        }
    }, 4000);
}

function updateConnectedCount(overrideCount = null) {
    let count = overrideCount !== null ? overrideCount : Object.keys(p2pConnMap).length;
    let remaining = Math.max(0, MAX_DEVICES - count);
    let displayTxt = `${count} / ${MAX_DEVICES} (${currentLang === 'zh' ? '名額剩餘' : 'Left'}: ${remaining})`;
    
    safeSetText('p2p-connected-count', displayTxt);
    safeSetText('lobby-connected-count', displayTxt);
}

function broadcastDeviceCount() {
    let count = Object.keys(p2pConnMap).length;
    broadcastToClients({ type: P2P_EVENTS.DEVICE_COUNT_SYNC, count });
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

    isMatchLocked = false;
    broadcastToClients({ type: P2P_EVENTS.LOBBY_WAITING });
}

function closeLobbyModal() { safeSetDisplay('lobby-modal', 'none'); }

function handleLobbyModeChange() {
    let newMode = document.getElementById('lobby-match-mode').value;
    setMatchMode(newMode, false, false);
    applyLobbyLayout();
    broadcastToClients({ type: P2P_EVENTS.MODE_SYNC, mode: newMode });
}

function applyLobbyLayout() {
    let is3v3OrTeam = (matchMode === '3v3' || matchMode === 'team');
    let isP3 = (matchMode === 'p3');

    safeSetDisplay('lobby-p1-deck-box', is3v3OrTeam ? 'block' : 'none');
    safeSetDisplay('lobby-p2-deck-box', is3v3OrTeam ? 'block' : 'none');
    safeSetDisplay('lobby-p3-box', isP3 ? 'block' : 'none');

    const swapBtn = document.getElementById('btn-swap-sides');
    if (swapBtn) {
        if (isP3) {
            swapBtn.innerText = currentLang === 'zh' ? '🔄 三人輪調 (1➔2➔3)' : '🔄 Rotate (1➔2➔3)';
        } else {
            swapBtn.innerText = currentLang === 'zh' ? '⇄ 左右對調' : '⇄ Swap Sides';
        }
    }
}

function isRealCustomName(val) {
    const defaults = [
        '1','2','3','A','B','C',
        '選手一','選手二','選手三','Player 1','Player 2','Player 3',
        '隊伍 A','隊伍 B','Team A','Team B',
        '先鋒','中堅','大將'
    ];
    return val && !defaults.includes(val.trim()) && !val.includes('Vanguard') && !val.includes('Middle') && !val.includes('General');
}

function syncRosterToLobbyUI() {
    let defP1 = currentLang === 'zh' ? '選手一' : 'Player 1';
    let defP2 = currentLang === 'zh' ? '選手二' : 'Player 2';
    let defP3 = currentLang === 'zh' ? '選手三' : 'Player 3';
    let defT1 = currentLang === 'zh' ? '隊伍 A' : 'Team A';
    let defT2 = currentLang === 'zh' ? '隊伍 B' : 'Team B';

    let defD1 = matchMode === 'team' ? (currentLang === 'zh' ? '先鋒' : '1st Vanguard') : (currentLang === 'zh' ? '陀螺 1號' : 'Bey 1');
    let defD2 = matchMode === 'team' ? (currentLang === 'zh' ? '中堅' : '2nd Middle') : (currentLang === 'zh' ? '陀螺 2號' : 'Bey 2');
    let defD3 = matchMode === 'team' ? (currentLang === 'zh' ? '大將' : '3rd General') : (currentLang === 'zh' ? '陀螺 3號' : 'Bey 3');

    if (matchMode === 'team') {
        safeSetInputValue('lobby-p1-name', isRealCustomName(roster.t1Name) ? roster.t1Name : defT1);
        safeSetInputValue('lobby-p2-name', isRealCustomName(roster.t2Name) ? roster.t2Name : defT2);
    } else {
        safeSetInputValue('lobby-p1-name', isRealCustomName(roster.t1Name) ? roster.t1Name : ((roster.t1 && isRealCustomName(roster.t1[0])) ? roster.t1[0] : defP1));
        safeSetInputValue('lobby-p2-name', isRealCustomName(roster.t2Name) ? roster.t2Name : ((roster.t2 && isRealCustomName(roster.t2[0])) ? roster.t2[0] : defP2));
    }
    safeSetInputValue('lobby-p3-name', isRealCustomName(roster.t3Name) ? roster.t3Name : defP3);

    safeSetInputValue('lobby-p1-d1', (roster.t1 && isRealCustomName(roster.t1[0])) ? roster.t1[0] : defD1);
    safeSetInputValue('lobby-p1-d2', (roster.t1 && isRealCustomName(roster.t1[1])) ? roster.t1[1] : defD2);
    safeSetInputValue('lobby-p1-d3', (roster.t1 && isRealCustomName(roster.t1[2])) ? roster.t1[2] : defD3);

    safeSetInputValue('lobby-p2-d1', (roster.t2 && isRealCustomName(roster.t2[0])) ? roster.t2[0] : defD1);
    safeSetInputValue('lobby-p2-d2', (roster.t2 && isRealCustomName(roster.t2[1])) ? roster.t2[1] : defD2);
    safeSetInputValue('lobby-p2-d3', (roster.t2 && isRealCustomName(roster.t2[2])) ? roster.t2[2] : defD3);
}

function clearLobbySlot(slotNum) {
    let defP1 = currentLang === 'zh' ? '選手一' : 'Player 1';
    let defP2 = currentLang === 'zh' ? '選手二' : 'Player 2';
    let defP3 = currentLang === 'zh' ? '選手三' : 'Player 3';
    let defT1 = currentLang === 'zh' ? '隊伍 A' : 'Team A';
    let defT2 = currentLang === 'zh' ? '隊伍 B' : 'Team B';

    let defD1 = matchMode === 'team' ? (currentLang === 'zh' ? '先鋒' : '1st Vanguard') : (currentLang === 'zh' ? '陀螺 1號' : 'Bey 1');
    let defD2 = matchMode === 'team' ? (currentLang === 'zh' ? '中堅' : '2nd Middle') : (currentLang === 'zh' ? '陀螺 2號' : 'Bey 2');
    let defD3 = matchMode === 'team' ? (currentLang === 'zh' ? '大將' : '3rd General') : (currentLang === 'zh' ? '陀螺 3號' : 'Bey 3');

    if (slotNum === 1) {
        occupiedSlots.slot1 = false;
        roster.t1Name = matchMode === 'team' ? defT1 : defP1;
        roster.t1 = [defD1, defD2, defD3];
        safeSetInputValue('lobby-p1-name', roster.t1Name);
        safeSetInputValue('lobby-p1-d1', defD1);
        safeSetInputValue('lobby-p1-d2', defD2);
        safeSetInputValue('lobby-p1-d3', defD3);
    } else if (slotNum === 2) {
        occupiedSlots.slot2 = false;
        roster.t2Name = matchMode === 'team' ? defT2 : defP2;
        roster.t2 = [defD1, defD2, defD3];
        safeSetInputValue('lobby-p2-name', roster.t2Name);
        safeSetInputValue('lobby-p2-d1', defD1);
        safeSetInputValue('lobby-p2-d2', defD2);
        safeSetInputValue('lobby-p2-d3', defD3);
    } else if (slotNum === 3) {
        occupiedSlots.slot3 = false;
        roster.t3Name = defP3;
        safeSetInputValue('lobby-p3-name', defP3);
    }

    isMatchLocked = false;
    broadcastToClients({ type: P2P_EVENTS.LOBBY_WAITING });
}

function swapLobbySides() {
    let p1Name = document.getElementById('lobby-p1-name').value;
    let p2Name = document.getElementById('lobby-p2-name').value;
    let p3Name = document.getElementById('lobby-p3-name').value;

    if (matchMode === 'p3') {
        document.getElementById('lobby-p1-name').value = p3Name;
        document.getElementById('lobby-p2-name').value = p1Name;
        document.getElementById('lobby-p3-name').value = p2Name;

        let tempOcc = occupiedSlots.slot3;
        occupiedSlots.slot3 = occupiedSlots.slot2;
        occupiedSlots.slot2 = occupiedSlots.slot1;
        occupiedSlots.slot1 = tempOcc;
    } else {
        document.getElementById('lobby-p1-name').value = p2Name;
        document.getElementById('lobby-p2-name').value = p1Name;

        let p1d1 = document.getElementById('lobby-p1-d1').value;
        let p1d2 = document.getElementById('lobby-p1-d2').value;
        let p1d3 = document.getElementById('lobby-p1-d3').value;

        let p2d1 = document.getElementById('lobby-p2-d1').value;
        let p2d2 = document.getElementById('lobby-p2-d2').value;
        let p2d3 = document.getElementById('lobby-p2-d3').value;

        document.getElementById('lobby-p1-d1').value = p2d1;
        document.getElementById('lobby-p1-d2').value = p2d2;
        document.getElementById('lobby-p1-d3').value = p2d3;

        document.getElementById('lobby-p2-d1').value = p1d1;
        document.getElementById('lobby-p2-d2').value = p1d2;
        document.getElementById('lobby-p2-d3').value = p1d3;

        let tempOcc = occupiedSlots.slot1;
        occupiedSlots.slot1 = occupiedSlots.slot2;
        occupiedSlots.slot2 = tempOcc;
    }
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
    
    isMatchLocked = true;

    scoreP1 = 0; scoreP2 = 0; scoreP3 = 0;
    foulsP1 = 0; foulsP2 = 0; foulsP3 = 0;
    teamWinsP1 = 0; teamWinsP2 = 0;
    kofIndexP1 = 0; kofIndexP2 = 0;
    battleCount = 1;
    history = []; logs = [];
    isFinalTeamWinActive = false;

    closeLobbyModal();

    updatePlayerNamesForMode();
    saveState();
    updateDisplay();

    let p1Show = document.getElementById('p1-title').value;
    let p2Show = document.getElementById('p2-title').value;
    let p3Show = document.getElementById('p3-title') ? document.getElementById('p3-title').value : '';

    broadcastToClients({
        type: P2P_EVENTS.MATCH_START_SYNC,
        ...getFullState(),
        p1Show, p2Show, p3Show
    });

    triggerVersusAnimation(p1Show, p2Show, p3Show);
}

/* 🎯 關鍵修復：客戶端連線成功後發送 REQUEST_SYNC 要求比分同步 */
function joinP2PRoom(roleType) {
    let inputId = document.getElementById('p2p-input-room').value.trim();
    if (!inputId || inputId.length < 8) {
        alert(currentLang === 'zh' ? "請輸入正確的 8 位數房間 ID！" : "Please enter a valid 8-digit Room ID!");
        return;
    }

    const btnJoin = document.getElementById(roleType === 'player' ? 'btn-join-player' : 'btn-join-spectator');
    const origBtnText = btnJoin ? btnJoin.innerText : '';
    if (btnJoin) {
        btnJoin.innerText = currentLang === 'zh' ? '⏳ 連線中...' : '⏳ Connecting...';
        btnJoin.disabled = true;
    }

    const resetButtons = () => {
        if (btnJoin) {
            btnJoin.innerText = origBtnText;
            btnJoin.disabled = false;
        }
        if (connectTimeoutTimer) {
            clearTimeout(connectTimeoutTimer);
            connectTimeoutTimer = null;
        }
    };

    if (peer) peer.destroy();
    peer = new Peer(PEER_CONFIG);

    connectTimeoutTimer = setTimeout(() => {
        resetButtons();
        if (peer) {
            peer.destroy();
            peer = null;
        }
        alert(currentLang === 'zh' ? "⚠️ 連線超時：請確認裁判手機處於【等候大廳】或計分畫面，且 8 位數 ID 正確。" : "⚠️ Connection Timeout: Please check Room ID and retry.");
    }, 8000);

    peer.on('open', () => {
        myPeerRole = roleType;
        let targetPeerId = `bx-${inputId}`;
        hostConn = peer.connect(targetPeerId);

        hostConn.on('open', () => {
            resetButtons();
            currentRoomId = inputId;
            safeSetDisplay('p2p-status-bar', 'block');
            safeSetDisplay('btn-open-lobby', 'none');
            
            if (roleType === 'spectator') {
                safeSetText('p2p-role-badge', currentLang === 'zh' ? '👁️ SPECTATOR (觀眾)' : '👁️ SPECTATOR');
                safeSetDisplay('p2p-client-submit-box', 'none');
                closeP2PModal();
            } else {
                safeSetText('p2p-role-badge', currentLang === 'zh' ? '🎮 PLAYER (選手)' : '🎮 PLAYER');
                safeSetDisplay('p2p-client-submit-box', 'block');
                updateP2PFormFields();
            }

            // 📢 客戶端主動要求裁判傳送當前最新狀態（雙保險）
            try { hostConn.send({ type: P2P_EVENTS.REQUEST_SYNC }); } catch(e) {}

            startHeartbeat();
            setUIPermissions();
            safeSetText('p2p-current-room', inputId);
        });

        hostConn.on('data', (data) => {
            if (data.type === P2P_EVENTS.PING) {
                try { hostConn.send({ type: P2P_EVENTS.PONG }); } catch(e) {}
                return;
            }
            handleClientReceivedData(data);
        });

        hostConn.on('error', (err) => {
            resetButtons();
            console.error("Client HostConn Error:", err);
        });
    });

    peer.on('error', (err) => {
        resetButtons();
        if (err.type === 'peer-unavailable') {
            alert(currentLang === 'zh' ? "⚠️ 連線失敗：找不到此房間！請確認裁判已建立房間且 8 位數 ID 正確。" : "⚠️ Connection Failed: Room not found! Please check Room ID.");
        } else {
            console.error("Client Peer Error:", err);
        }
    });
}

function leaveP2PRoom() {
    let confirmMsg = currentLang === 'zh' ? "確定要離開目前的對戰房間嗎？" : "Are you sure you want to leave the room?";
    if (confirm(confirmMsg)) {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (peer) peer.destroy();
        peer = null;
        hostConn = null;
        p2pConnMap = {};
        myPeerRole = 'none';
        
        safeSetDisplay('p2p-status-bar', 'none');
        safeSetDisplay('spectator-waiting-overlay', 'none');
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
        alert(currentLang === 'zh' ? "未連線至裁判端！請重新點擊「選手連線」。" : "Not connected to Referee! Please re-click 'Join as Player'.");
        return;
    }

    if (isMatchLocked) {
        alert(currentLang === 'zh' ? "⚠️ 本局比賽已鎖定開賽！無法再提交排陣。" : "⚠️ Match already started! Cannot submit roster.");
        return;
    }

    let mode = document.getElementById('p2p-form-type').value;
    let defName = currentLang === 'zh' ? '選手一' : 'Player 1';
    let name = document.getElementById('p2p-player-name').value.trim() || defName;
    let item1 = document.getElementById('p2p-item-1').value.trim() || '1';
    let item2 = document.getElementById('p2p-item-2').value.trim() || '2';
    let item3 = document.getElementById('p2p-item-3').value.trim() || '3';

    let payload = {
        type: P2P_EVENTS.SUBMIT_DECK,
        formMode: mode,
        name: name,
        items: [item1, item2, item3]
    };

    hostConn.send(payload);
    alert(currentLang === 'zh' ? "已送出給裁判，等待裁判審核並排入大廳！" : "Submitted! Waiting for Referee approval.");
}

function handleHostReceivedData(data, conn) {
    if (data.type === P2P_EVENTS.SUBMIT_DECK) {
        if (isMatchLocked) {
            try { conn.send({ type: P2P_EVENTS.REJECT_FULL }); } catch(e) {}
            return;
        }

        let isFull = (occupiedSlots.slot1 && occupiedSlots.slot2 && occupiedSlots.slot3);
        if (isFull) {
            try { conn.send({ type: P2P_EVENTS.REJECT_FULL }); } catch(e) {}
            return;
        }

        pendingClientData = data;
        safeSetText('p2p-request-title', currentLang === 'zh' ? `收到 [ ${data.name} ] 的排陣提交` : `Received Roster from [ ${data.name} ]`);
        
        let modeLabels = {
            'std': currentLang === 'zh' ? '1v1 Standard (1對1 單人對決)' : '1v1 Standard',
            '3v3': currentLang === 'zh' ? '3on3 Battle (3隻陀螺對決)' : '3on3 Battle',
            'team': currentLang === 'zh' ? 'Team Battle (3人 KOF 團隊戰)' : 'Team Battle',
            'p3': currentLang === 'zh' ? '3-Player (三人亂鬥 5分制)' : '3-Player Battle'
        };
        let modeLabel = modeLabels[data.formMode] || data.formMode;

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

        safeSetDisplay('p2p-confirm-modal', 'flex');
    }
}

function autoAcceptClientSubmission() {
    if (!pendingClientData) return;

    let data = pendingClientData;

    let targetSlot = 1;
    if (!occupiedSlots.slot1) {
        targetSlot = 1;
    } else if (!occupiedSlots.slot2) {
        targetSlot = 2;
    } else if (!occupiedSlots.slot3) {
        targetSlot = 3;
    } else {
        targetSlot = 1;
    }

    if (targetSlot === 1) {
        roster.t1Name = data.name;
        if (data.items && data.items.length) roster.t1 = [...data.items];
        else roster.t1 = [data.name, '2', '3'];
        occupiedSlots.slot1 = true;
        safeSetInputValue('lobby-p1-name', data.name);
    } else if (targetSlot === 2) {
        roster.t2Name = data.name;
        if (data.items && data.items.length) roster.t2 = [...data.items];
        else roster.t2 = [data.name, '2', '3'];
        occupiedSlots.slot2 = true;
        safeSetInputValue('lobby-p2-name', data.name);
    } else if (targetSlot === 3) {
        roster.t3Name = data.name;
        occupiedSlots.slot3 = true;
        safeSetInputValue('lobby-p3-name', data.name);
        
        if (matchMode !== 'p3') {
            handleLobbyModeChangeFromData('p3');
        }
    }

    safeSetDisplay('p2p-confirm-modal', 'none');
    openLobbyModal();
}

function handleLobbyModeChangeFromData(newMode) {
    const modeSelect = document.getElementById('lobby-match-mode');
    if (modeSelect) modeSelect.value = newMode;
    setMatchMode(newMode, false, false);
    applyLobbyLayout();
    broadcastToClients({ type: P2P_EVENTS.MODE_SYNC, mode: newMode });
}

function rejectClientSubmission() {
    pendingClientData = null;
    safeSetDisplay('p2p-confirm-modal', 'none');
}

function handleClientReceivedData(data) {
    if (data.type === P2P_EVENTS.ROOM_CAPACITY_FULL) {
        alert(currentLang === 'zh' ? "⚠️ 本房間人數已達 15 人上限！無法加入。" : "⚠️ Room capacity reached (15/15 max)!");
        leaveP2PRoom();
    } else if (data.type === P2P_EVENTS.DEVICE_COUNT_SYNC) {
        updateConnectedCount(data.count);
    } else if (data.type === P2P_EVENTS.INIT_SYNC) {
        isMatchLocked = data.isMatchLocked || false;
        if (isMatchLocked && myPeerRole === 'player') {
            myPeerRole = 'spectator';
            safeSetText('p2p-role-badge', currentLang === 'zh' ? '👁️ SPECTATOR (觀眾)' : '👁️ SPECTATOR');
            safeSetDisplay('p2p-client-submit-box', 'none');
            closeP2PModal();
            setUIPermissions();
            alert(currentLang === 'zh' ? "⚠️ 本局對戰已鎖定開賽！您已自動轉為【觀眾直播】模式。" : "⚠️ Match is in progress! Automatically switched to Spectator mode.");
        }
        if (data.connectedCount) updateConnectedCount(data.connectedCount);
        applyStateSync(data);
    } else if (data.type === P2P_EVENTS.LOBBY_WAITING) {
        safeSetDisplay('win-modal', 'none');
        if (myPeerRole === 'player') {
            safeSetDisplay('p2p-client-submit-box', 'block');
            safeSetDisplay('spectator-waiting-overlay', 'none');
        } else {
            safeSetDisplay('spectator-waiting-overlay', 'flex');
        }
    } else if (data.type === P2P_EVENTS.REJECT_FULL) {
        alert(currentLang === 'zh' ? "⚠️ 本局對戰名額已滿並由裁判鎖定！系統已自動將你切換為【觀眾觀戰】模式。" : "⚠️ Match slots are full! Switched to Spectator mode.");
        myPeerRole = 'spectator';
        safeSetText('p2p-role-badge', currentLang === 'zh' ? '👁️ SPECTATOR (觀眾)' : '👁️ SPECTATOR');
        safeSetDisplay('p2p-client-submit-box', 'none');
        closeP2PModal();
        setUIPermissions();
    } else if (data.type === P2P_EVENTS.STATE_SYNC || data.type === P2P_EVENTS.MATCH_START_SYNC) {
        safeSetDisplay('spectator-waiting-overlay', 'none');
        applyStateSync(data);

        if (data.type === P2P_EVENTS.MATCH_START_SYNC) {
            triggerVersusAnimation(data.p1Show, data.p2Show, data.p3Show);
        }
    } else if (data.type === P2P_EVENTS.WIN_SYNC) {
        showWinModal(data.winner, data.isFinalTeamWin);
    } else if (data.type === P2P_EVENTS.CLOSE_WIN_SYNC) {
        safeSetDisplay('win-modal', 'none');
    } else if (data.type === P2P_EVENTS.MODE_SYNC) {
        setMatchMode(data.mode, false, false);
    }
}

/* 🎯 狀態套用並即時渲染至介面 */
function applyStateSync(data) {
    if (data.roster) roster = data.roster;
    if (data.isMatchLocked !== undefined) isMatchLocked = data.isMatchLocked;
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
    if (data.matchMode) {
        matchMode = data.matchMode;
        const scoreboard = document.getElementById('main-scoreboard');
        const p3Card = document.getElementById('p3-card');
        if (scoreboard) scoreboard.classList.toggle('p3-mode', matchMode === 'p3');
        if (p3Card) p3Card.style.display = (matchMode === 'p3') ? 'flex' : 'none';
    }
    if (Array.isArray(data.logs)) logs = data.logs;

    updatePlayerNamesForMode();
    updateDisplay();
}

function broadcastToClients(payload) {
    if (myPeerRole !== 'host') return;
    Object.values(p2pConnMap).forEach(conn => {
        if (conn && conn.open) {
            try { conn.send(payload); } catch(e) {}
        }
    });
}
