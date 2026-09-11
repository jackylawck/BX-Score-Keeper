/* =========================================================================
 * 🌐 p2p.js - WebRTC PeerJS Module (Production-Ready Tournament Edition)
 * ========================================================================= */

const MAX_DEVICES = 15;
const PROTOCOL_VERSION = 1;

// 🎯 掛載至 window，全域統一常數
window.P2P_EVENTS = {
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
let pendingSubmissionQueue = []; // 🎯 排陣佇列，避免並發提交互相覆蓋
let occupiedSlots = { slot1: false, slot2: false, slot3: false };
let isMatchLocked = false;
let heartbeatTimer = null;
let connectTimeoutTimer = null;
let lastHostMessageAt = Date.now();
let isDisconnecting = false; // 🎯 斷線守衛，防止雙重彈窗

// 🌐 強化版 STUN 伺服器池
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

// 🎯 手機切回前景時更新時間戳，防止被誤判逾時踢除
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        lastHostMessageAt = Date.now();
    }
});

function isEventType(data, eventKey) {
    if (!data || !data.type) return false;
    return data.type === window.P2P_EVENTS[eventKey] || data.type === eventKey;
}

function getLang() {
    return (typeof currentLang !== 'undefined') ? currentLang : 'zh';
}

function notifyUser(msgZh, msgEn) {
    let msg = getLang() === 'zh' ? msgZh : msgEn;
    if (typeof showToast === 'function') {
        showToast(msg);
    } else {
        alert(msg);
    }
}

function openP2PModal() { 
    if (typeof applyLanguage === 'function') applyLanguage();
    safeSetDisplay('p2p-modal', 'flex'); 
}
function closeP2PModal() { safeSetDisplay('p2p-modal', 'none'); }

function updateP2PFormFields() {
    let mode = document.getElementById('p2p-form-type').value;
    let extraBox = document.getElementById('p2p-extra-items');
    let nameInput = document.getElementById('p2p-player-name');
    let lang = getLang();

    if (mode === 'std') {
        if (extraBox) extraBox.style.display = 'none';
        if (nameInput) nameInput.placeholder = lang === 'zh' ? '選手姓名 (例如 假面S)' : 'Player Name (e.g. Mask S)';
    } else if (mode === 'p3') {
        if (extraBox) extraBox.style.display = 'none';
        if (nameInput) nameInput.placeholder = lang === 'zh' ? '選手姓名 (例如 嚟沒火)' : 'Player Name (e.g. Player 3)';
    } else if (mode === '3v3') {
        if (extraBox) extraBox.style.display = 'block';
        if (nameInput) nameInput.placeholder = lang === 'zh' ? '選手姓名 (例如 BB)' : 'Player Name (e.g. BB)';
        safeSetInputPlaceholder('p2p-item-1', lang === 'zh' ? '陀螺 1 號' : 'Bey #1');
        safeSetInputPlaceholder('p2p-item-2', lang === 'zh' ? '陀螺 2 號' : 'Bey #2');
        safeSetInputPlaceholder('p2p-item-3', lang === 'zh' ? '陀螺 3 號' : 'Bey #3');
    } else if (mode === 'team') {
        if (extraBox) extraBox.style.display = 'block';
        if (nameInput) nameInput.placeholder = lang === 'zh' ? '隊伍名稱 (例如 Daddy)' : 'Team Name (e.g. Daddy)';
        safeSetInputPlaceholder('p2p-item-1', lang === 'zh' ? '先鋒 1 號' : '1st Vanguard');
        safeSetInputPlaceholder('p2p-item-2', lang === 'zh' ? '中堅 2 號' : '2nd Middle');
        safeSetInputPlaceholder('p2p-item-3', lang === 'zh' ? '大將 3 號' : '3rd General');
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
        pendingSubmissionQueue = [];
        pendingClientData = null;
        occupiedSlots = { slot1: false, slot2: false, slot3: false };
        isMatchLocked = false;
        setUIPermissions();
        
        safeSetDisplay('p2p-status-bar', 'block');
        safeSetText('p2p-role-badge', getLang() === 'zh' ? 'HOST (裁判)' : 'HOST (Referee)');
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

function handleNewHostConnection(conn) {
    let isRegistered = false;

    const registerConnection = () => {
        if (isRegistered) return;
        isRegistered = true;

        if (getActiveConnectionCount() >= MAX_DEVICES) {
            try { conn.send({ type: window.P2P_EVENTS.ROOM_CAPACITY_FULL, _v: PROTOCOL_VERSION }); } catch(e) {}
            setTimeout(() => conn.close(), 500);
            return;
        }

        p2pConnMap[conn.peer] = conn;
        updateConnectedCount();

        try {
            conn.send({
                type: window.P2P_EVENTS.INIT_SYNC,
                _v: PROTOCOL_VERSION,
                ...getFullState(),
                connectedCount: getActiveConnectionCount()
            });
        } catch(e) {}

        broadcastDeviceCount();
    };

    if (conn.open) {
        registerConnection();
    } else {
        conn.on('open', registerConnection);
    }

    conn.on('data', (data) => {
        if (!isRegistered) {
            registerConnection();
        }

        if (data && data._v && data._v !== PROTOCOL_VERSION) {
            try { conn.close(); } catch(e) {}
            return;
        }

        if (isEventType(data, 'PING')) {
            try { conn.send({ type: window.P2P_EVENTS.PONG, _v: PROTOCOL_VERSION }); } catch(e) {}
            return;
        }
        if (isEventType(data, 'REQUEST_SYNC')) {
            try {
                conn.send({
                    type: window.P2P_EVENTS.STATE_SYNC,
                    _v: PROTOCOL_VERSION,
                    ...getFullState(),
                    connectedCount: getActiveConnectionCount()
                });
            } catch(e) {}
            return;
        }
        handleHostReceivedData(data, conn);
    });

    const handleClose = () => {
        if (p2pConnMap[conn.peer]) {
            delete p2pConnMap[conn.peer];
            updateConnectedCount();
            broadcastDeviceCount();
        }
    };

    conn.on('close', handleClose);
    conn.on('error', (err) => {
        console.error(`Peer connection error [${conn.peer}]:`, err);
        handleClose();
    });
}

function cleanDeadConnections() {
    Object.keys(p2pConnMap).forEach(key => {
        let c = p2pConnMap[key];
        if (!c || !c.open) {
            delete p2pConnMap[key];
        }
    });
}

function getActiveConnectionCount() {
    cleanDeadConnections();
    return Object.keys(p2pConnMap).length;
}

function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    lastHostMessageAt = Date.now();

    heartbeatTimer = setInterval(() => {
        if (myPeerRole === 'host') {
            cleanDeadConnections();
            broadcastToClients({ type: window.P2P_EVENTS.PING });
        } else if (hostConn && hostConn.open) {
            if (Date.now() - lastHostMessageAt > 15000) {
                console.warn("Host silent > 15s, closing connection...");
                if (heartbeatTimer) {
                    clearInterval(heartbeatTimer);
                    heartbeatTimer = null;
                }
                hostConn.close();
            }
        }
    }, 3000);
}

function updateConnectedCount(overrideCount = null) {
    let count = overrideCount !== null ? overrideCount : getActiveConnectionCount();
    let remaining = Math.max(0, MAX_DEVICES - count);
    let lang = getLang();
    let displayTxt = `${count} / ${MAX_DEVICES} (${lang === 'zh' ? '名額剩餘' : 'Left'}: ${remaining})`;
    
    safeSetText('p2p-connected-count', displayTxt);
    safeSetText('lobby-connected-count', displayTxt);
}

function broadcastDeviceCount() {
    let count = getActiveConnectionCount();
    broadcastToClients({ type: window.P2P_EVENTS.DEVICE_COUNT_SYNC, count });
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
    broadcastToClients({ type: window.P2P_EVENTS.LOBBY_WAITING });
}

function closeLobbyModal() { safeSetDisplay('lobby-modal', 'none'); }

function handleLobbyModeChange() {
    let newMode = document.getElementById('lobby-match-mode').value;
    setMatchMode(newMode, false, false);
    applyLobbyLayout();
    broadcastToClients({ type: window.P2P_EVENTS.MODE_SYNC, mode: newMode });
}

function applyLobbyLayout() {
    let is3v3OrTeam = (matchMode === '3v3' || matchMode === 'team');
    let isP3 = (matchMode === 'p3');
    let lang = getLang();

    safeSetDisplay('lobby-p1-deck-box', is3v3OrTeam ? 'block' : 'none');
    safeSetDisplay('lobby-p2-deck-box', is3v3OrTeam ? 'block' : 'none');
    safeSetDisplay('lobby-p3-box', isP3 ? 'block' : 'none');

    const swapBtn = document.getElementById('btn-swap-sides');
    if (swapBtn) {
        if (isP3) {
            swapBtn.innerText = lang === 'zh' ? '🔄 三人輪調 (1➔2➔3)' : '🔄 Rotate (1➔2➔3)';
        } else {
            swapBtn.innerText = lang === 'zh' ? '⇄ 左右對調' : '⇄ Swap Sides';
        }
    }
}

function syncRosterToLobbyUI() {
    let lang = getLang();
    let defP1 = lang === 'zh' ? '選手一' : 'Player 1';
    let defP2 = lang === 'zh' ? '選手二' : 'Player 2';
    let defP3 = lang === 'zh' ? '選手三' : 'Player 3';
    let defT1 = lang === 'zh' ? '隊伍 A' : 'Team A';
    let defT2 = lang === 'zh' ? '隊伍 B' : 'Team B';

    let defD1 = matchMode === 'team' ? (lang === 'zh' ? '先鋒' : '1st Vanguard') : (lang === 'zh' ? '陀螺 1號' : 'Bey 1');
    let defD2 = matchMode === 'team' ? (lang === 'zh' ? '中堅' : '2nd Middle') : (lang === 'zh' ? '陀螺 2號' : 'Bey 2');
    let defD3 = matchMode === 'team' ? (lang === 'zh' ? '大將' : '3rd General') : (lang === 'zh' ? '陀螺 3號' : 'Bey 3');

    if (matchMode === 'team') {
        safeSetInputValue('lobby-p1-name', !isDefaultVal(roster.t1Name) ? roster.t1Name : defT1);
        safeSetInputValue('lobby-p2-name', !isDefaultVal(roster.t2Name) ? roster.t2Name : defT2);
    } else {
        safeSetInputValue('lobby-p1-name', !isDefaultVal(roster.t1Name) ? roster.t1Name : ((roster.t1 && !isDefaultVal(roster.t1[0])) ? roster.t1[0] : defP1));
        safeSetInputValue('lobby-p2-name', !isDefaultVal(roster.t2Name) ? roster.t2Name : ((roster.t2 && !isDefaultVal(roster.t2[0])) ? roster.t2[0] : defP2));
    }
    safeSetInputValue('lobby-p3-name', !isDefaultVal(roster.t3Name) ? roster.t3Name : defP3);

    safeSetInputValue('lobby-p1-d1', (roster.t1 && !isDefaultVal(roster.t1[0])) ? roster.t1[0] : defD1);
    safeSetInputValue('lobby-p1-d2', (roster.t1 && !isDefaultVal(roster.t1[1])) ? roster.t1[1] : defD2);
    safeSetInputValue('lobby-p1-d3', (roster.t1 && !isDefaultVal(roster.t1[2])) ? roster.t1[2] : defD3);

    safeSetInputValue('lobby-p2-d1', (roster.t2 && !isDefaultVal(roster.t2[0])) ? roster.t2[0] : defD1);
    safeSetInputValue('lobby-p2-d2', (roster.t2 && !isDefaultVal(roster.t2[1])) ? roster.t2[1] : defD2);
    safeSetInputValue('lobby-p2-d3', (roster.t2 && !isDefaultVal(roster.t2[2])) ? roster.t2[2] : defD3);
}

function clearLobbySlot(slotNum) {
    let lang = getLang();
    let defP1 = lang === 'zh' ? '選手一' : 'Player 1';
    let defP2 = lang === 'zh' ? '選手二' : 'Player 2';
    let defP3 = lang === 'zh' ? '選手三' : 'Player 3';
    let defT1 = lang === 'zh' ? '隊伍 A' : 'Team A';
    let defT2 = lang === 'zh' ? '隊伍 B' : 'Team B';

    let defD1 = matchMode === 'team' ? (lang === 'zh' ? '先鋒' : '1st Vanguard') : (lang === 'zh' ? '陀螺 1號' : 'Bey 1');
    let defD2 = matchMode === 'team' ? (lang === 'zh' ? '中堅' : '2nd Middle') : (lang === 'zh' ? '陀螺 2號' : 'Bey 2');
    let defD3 = matchMode === 'team' ? (lang === 'zh' ? '大將' : '3rd General') : (lang === 'zh' ? '陀螺 3號' : 'Bey 3');

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
    broadcastToClients({ type: window.P2P_EVENTS.LOBBY_WAITING });
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
    pendingSubmissionQueue = [];
    pendingClientData = null;
    safeSetDisplay('p2p-confirm-modal', 'none');

    let lang = getLang();
    let defP1 = lang === 'zh' ? '選手一' : 'Player 1';
    let defP2 = lang === 'zh' ? '選手二' : 'Player 2';
    let defP3 = lang === 'zh' ? '選手三' : 'Player 3';

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
        type: window.P2P_EVENTS.MATCH_START_SYNC,
        ...getFullState(),
        p1Show, p2Show, p3Show
    });

    triggerVersusAnimation(p1Show, p2Show, p3Show);
}

function handleClientDisconnect(reasonZh = '⚠️ 與裁判端連線已中斷！已切回單機模式。', reasonEn = '⚠️ Connection lost! Switched to offline mode.') {
    if (isDisconnecting) return;
    isDisconnecting = true;

    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    if (connectTimeoutTimer) {
        clearTimeout(connectTimeoutTimer);
        connectTimeoutTimer = null;
    }

    if (hostConn) {
        try {
            if (typeof hostConn.removeAllListeners === 'function') {
                hostConn.removeAllListeners('close');
                hostConn.removeAllListeners('data');
                hostConn.removeAllListeners('error');
            }
        } catch (e) {}
    }
    if (peer && !peer.destroyed) {
        try { peer.destroy(); } catch (e) {}
    }

    peer = null;
    hostConn = null;
    myPeerRole = 'none';
    lastHostMessageAt = Date.now();

    safeSetDisplay('p2p-status-bar', 'none');
    safeSetDisplay('spectator-waiting-overlay', 'none');
    setUIPermissions();

    setTimeout(() => {
        notifyUser(reasonZh, reasonEn);
        isDisconnecting = false;
    }, 100);
}

function joinP2PRoom(roleType) {
    let inputId = document.getElementById('p2p-input-room').value.trim();
    let lang = getLang();
    if (!inputId || inputId.length < 8) {
        notifyUser("請輸入正確的 8 位數房間 ID！", "Please enter a valid 8-digit Room ID!");
        return;
    }

    const btnJoin = document.getElementById(roleType === 'player' ? 'btn-join-player' : 'btn-join-spectator');
    const origBtnText = btnJoin ? btnJoin.innerText : '';
    if (btnJoin) {
        btnJoin.innerText = lang === 'zh' ? '⏳ 連線中...' : '⏳ Connecting...';
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
        notifyUser("⚠️ 連線超時：請確認裁判手機處於【等候大廳】或計分畫面，且 8 位數 ID 正確。", "⚠️ Connection Timeout: Please check Room ID and retry.");
    }, 8000);

    peer.on('open', () => {
        myPeerRole = roleType;
        let targetPeerId = `bx-${inputId}`;
        hostConn = peer.connect(targetPeerId);

        hostConn.on('open', () => {
            isDisconnecting = false;
            resetButtons();
            currentRoomId = inputId;
            safeSetDisplay('p2p-status-bar', 'block');
            safeSetDisplay('btn-open-lobby', 'none');
            
            let curLang = getLang();
            if (roleType === 'spectator') {
                safeSetText('p2p-role-badge', curLang === 'zh' ? '👁️ SPECTATOR (觀眾)' : '👁️ SPECTATOR');
                safeSetDisplay('p2p-client-submit-box', 'none');
                closeP2PModal();
            } else {
                safeSetText('p2p-role-badge', curLang === 'zh' ? '🎮 PLAYER (選手)' : '🎮 PLAYER');
                safeSetDisplay('p2p-client-submit-box', 'block');
                updateP2PFormFields();
            }

            try { hostConn.send({ type: window.P2P_EVENTS.REQUEST_SYNC, _v: PROTOCOL_VERSION }); } catch(e) {}

            startHeartbeat();
            setUIPermissions();
            safeSetText('p2p-current-room', inputId);
        });

        hostConn.on('data', (data) => {
            lastHostMessageAt = Date.now();

            if (data && data._v && data._v !== PROTOCOL_VERSION) {
                handleClientDisconnect('⚠️ 程式版本不一致，請重新整理！', '⚠️ Version mismatch! Please refresh.');
                return;
            }

            if (isEventType(data, 'PING')) {
                try { hostConn.send({ type: window.P2P_EVENTS.PONG, _v: PROTOCOL_VERSION }); } catch(e) {}
                return;
            }
            handleClientReceivedData(data);
        });

        hostConn.on('close', () => {
            handleClientDisconnect();
        });

        hostConn.on('error', (err) => {
            resetButtons();
            console.error("Client HostConn Error:", err);
            handleClientDisconnect('⚠️ 連線發生錯誤，已斷開。', '⚠️ Connection error, disconnected.');
        });
    });

    peer.on('error', (err) => {
        resetButtons();
        if (err.type === 'peer-unavailable') {
            notifyUser("⚠️ 連線失敗：找不到此房間！請確認裁判已建立房間且 8 位數 ID 正確。", "⚠️ Connection Failed: Room not found! Please check Room ID.");
        } else {
            console.error("Client Peer Error:", err);
        }
    });
}

function leaveP2PRoom() {
    let lang = getLang();
    let confirmMsg = lang === 'zh' ? "確定要離開目前的對戰房間嗎？" : "Are you sure you want to leave the room?";
    if (confirm(confirmMsg)) {
        handleClientDisconnect('已離開房間，恢復單機計分模式。', 'Left room. Returned to offline mode.');
    }
}

function setUIPermissions() {
    const isReadOnly = (myPeerRole === 'spectator' || myPeerRole === 'player');
    
    document.querySelectorAll('.score-btn').forEach(btn => {
        btn.style.pointerEvents = isReadOnly ? 'none' : 'auto';
        btn.style.opacity = isReadOnly ? '0.7' : '1';
    });

    const mainControls = document.getElementById('main-controls');
    if (mainControls) mainControls.style.display = isReadOnly ? 'none' : 'flex';

    const p1Title = document.getElementById('p1-title');
    const p2Title = document.getElementById('p2-title');
    const p3Title = document.getElementById('p3-title');
    if (p1Title) p1Title.readOnly = isReadOnly;
    if (p2Title) p2Title.readOnly = isReadOnly;
    if (p3Title) p3Title.readOnly = isReadOnly;
}

function sendClientDeckToHost() {
    if (!hostConn || !hostConn.open) {
        notifyUser("未連線至裁判端！請重新點擊「選手連線」。", "Not connected to Referee! Please re-click 'Join as Player'.");
        return;
    }

    if (isMatchLocked) {
        notifyUser("⚠️ 本局比賽已鎖定開賽！無法再提交排陣。", "⚠️ Match already started! Cannot submit roster.");
        return;
    }

    let mode = document.getElementById('p2p-form-type').value;
    let lang = getLang();
    let defName = lang === 'zh' ? '選手一' : 'Player 1';
    let name = document.getElementById('p2p-player-name').value.trim() || defName;
    let item1 = document.getElementById('p2p-item-1').value.trim() || '1';
    let item2 = document.getElementById('p2p-item-2').value.trim() || '2';
    let item3 = document.getElementById('p2p-item-3').value.trim() || '3';

    let payload = {
        type: window.P2P_EVENTS.SUBMIT_DECK,
        _v: PROTOCOL_VERSION,
        formMode: mode,
        name: name,
        items: [item1, item2, item3]
    };

    hostConn.send(payload);
    closeP2PModal();
    notifyUser("已送出給裁判，等待裁判審核並排入大廳！", "Submitted! Waiting for Referee approval.");
}

function handleHostReceivedData(data, conn) {
    if (isEventType(data, 'SUBMIT_DECK')) {
        if (isMatchLocked) {
            try { conn.send({ type: window.P2P_EVENTS.REJECT_FULL, _v: PROTOCOL_VERSION }); } catch(e) {}
            return;
        }

        const maxSlots = (matchMode === 'p3') ? 3 : 2;
        const usedSlots = [occupiedSlots.slot1, occupiedSlots.slot2, occupiedSlots.slot3]
            .slice(0, maxSlots)
            .filter(Boolean).length;

        if (usedSlots >= maxSlots) {
            try { conn.send({ type: window.P2P_EVENTS.REJECT_FULL, _v: PROTOCOL_VERSION }); } catch(e) {}
            return;
        }

        const existingIdx = pendingSubmissionQueue.findIndex(item => item.connPeer === conn.peer);
        if (existingIdx !== -1) {
            pendingSubmissionQueue[existingIdx] = { data, connPeer: conn.peer };
            if (existingIdx === 0 && pendingClientData) {
                pendingClientData = data;
                renderSubmissionConfirmModal(data);
            }
        } else {
            pendingSubmissionQueue.push({ data, connPeer: conn.peer });
            if (pendingSubmissionQueue.length === 1 && !pendingClientData) {
                processNextSubmission();
            }
        }
    }
}

function processNextSubmission() {
    if (pendingSubmissionQueue.length === 0) {
        pendingClientData = null;
        safeSetDisplay('p2p-confirm-modal', 'none');
        return;
    }

    pendingClientData = pendingSubmissionQueue[0].data;
    renderSubmissionConfirmModal(pendingClientData);
}

function renderSubmissionConfirmModal(data) {
    let lang = getLang();
    safeSetText('p2p-request-title', lang === 'zh' ? `收到 [ ${data.name} ] 的排陣提交` : `Received Roster from [ ${data.name} ]`);
    
    let modeLabels = {
        'std': lang === 'zh' ? '1v1 Standard (1對1 單人對決)' : '1v1 Standard',
        '3v3': lang === 'zh' ? '3on3 Battle (3隻陀螺對決)' : '3on3 Battle',
        'team': lang === 'zh' ? 'Team Battle (3人 KOF 團隊戰)' : 'Team Battle',
        'p3': lang === 'zh' ? '3-Player (三人亂鬥 5分制)' : '3-Player Battle'
    };
    let modeLabel = modeLabels[data.formMode] || data.formMode;

    let bodyHtml = `
        <b>${lang === 'zh' ? '賽制類型' : 'Mode'}:</b> ${modeLabel}<br>
        <b>${lang === 'zh' ? '名稱' : 'Name'}:</b> ${data.name}<br>
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

function applyDataToSlot(slot, data) {
    let defItems = [data.name, '2', '3'];

    if (slot === 1) {
        roster.t1Name = data.name;
        roster.t1 = (data.items && data.items.length) ? [...data.items] : defItems;
        occupiedSlots.slot1 = true;
        safeSetInputValue('lobby-p1-name', data.name);
        if (matchMode === '3v3' || matchMode === 'team') {
            safeSetInputValue('lobby-p1-d1', roster.t1[0]);
            safeSetInputValue('lobby-p1-d2', roster.t1[1]);
            safeSetInputValue('lobby-p1-d3', roster.t1[2]);
        }
    } else if (slot === 2) {
        roster.t2Name = data.name;
        roster.t2 = (data.items && data.items.length) ? [...data.items] : defItems;
        occupiedSlots.slot2 = true;
        safeSetInputValue('lobby-p2-name', data.name);
        if (matchMode === '3v3' || matchMode === 'team') {
            safeSetInputValue('lobby-p2-d1', roster.t2[0]);
            safeSetInputValue('lobby-p2-d2', roster.t2[1]);
            safeSetInputValue('lobby-p2-d3', roster.t2[2]);
        }
    } else if (slot === 3) {
        roster.t3Name = data.name;
        occupiedSlots.slot3 = true;
        safeSetInputValue('lobby-p3-name', data.name);
        if (matchMode !== 'p3') {
            handleLobbyModeChangeFromData('p3');
        }
    }
}

function autoAcceptClientSubmission() {
    if (!pendingClientData) return;

    const maxSlots = (matchMode === 'p3') ? 3 : 2;
    let targetSlot = 1;
    for (let i = 1; i <= maxSlots; i++) {
        if (!occupiedSlots['slot' + i]) { 
            targetSlot = i; 
            break; 
        }
    }

    applyDataToSlot(targetSlot, pendingClientData);

    pendingSubmissionQueue.shift();
    pendingClientData = null;
    safeSetDisplay('p2p-confirm-modal', 'none');

    if (pendingSubmissionQueue.length > 0) {
        processNextSubmission();
    } else {
        openLobbyModal();
    }
}

function handleLobbyModeChangeFromData(newMode) {
    const modeSelect = document.getElementById('lobby-match-mode');
    if (modeSelect) modeSelect.value = newMode;
    setMatchMode(newMode, false, false);
    applyLobbyLayout();
    broadcastToClients({ type: window.P2P_EVENTS.MODE_SYNC, mode: newMode });
}

function rejectClientSubmission() {
    pendingSubmissionQueue.shift();
    pendingClientData = null;
    safeSetDisplay('p2p-confirm-modal', 'none');

    if (pendingSubmissionQueue.length > 0) {
        processNextSubmission();
    } else {
        openLobbyModal();
    }
}

function handleClientReceivedData(data) {
    if (!data || !data.type) return;
    let lang = getLang();

    if (isEventType(data, 'ROOM_CAPACITY_FULL')) {
        notifyUser("⚠️ 本房間人數已達 15 人上限！無法加入。", "⚠️ Room capacity reached (15/15 max)!");
        handleClientDisconnect();
    } else if (isEventType(data, 'DEVICE_COUNT_SYNC')) {
        if (data.count !== undefined) updateConnectedCount(data.count);
    } else if (isEventType(data, 'INIT_SYNC')) {
        isMatchLocked = data.isMatchLocked || false;
        if (isMatchLocked && myPeerRole === 'player') {
            myPeerRole = 'spectator';
            safeSetText('p2p-role-badge', lang === 'zh' ? '👁️ SPECTATOR (觀眾)' : '👁️ SPECTATOR');
            safeSetDisplay('p2p-client-submit-box', 'none');
            closeP2PModal();
            setUIPermissions();
        }
        if (data.connectedCount !== undefined) updateConnectedCount(data.connectedCount);
        applyStateSync(data);
    } else if (isEventType(data, 'LOBBY_WAITING')) {
        safeSetDisplay('win-modal', 'none');
        if (myPeerRole === 'player') {
            safeSetDisplay('p2p-client-submit-box', 'block');
            safeSetDisplay('spectator-waiting-overlay', 'none');
        } else {
            safeSetDisplay('spectator-waiting-overlay', 'flex');
        }
    } else if (isEventType(data, 'REJECT_FULL')) {
        notifyUser("⚠️ 本局對戰名額已滿並由裁判鎖定！系統已自動將你切換為【觀眾觀戰】模式。", "⚠️ Match slots are full! Switched to Spectator mode.");
        myPeerRole = 'spectator';
        safeSetText('p2p-role-badge', lang === 'zh' ? '👁️ SPECTATOR (觀眾)' : '👁️ SPECTATOR');
        safeSetDisplay('p2p-client-submit-box', 'none');
        closeP2PModal();
        setUIPermissions();
    } else if (isEventType(data, 'STATE_SYNC') || isEventType(data, 'MATCH_START_SYNC')) {
        safeSetDisplay('spectator-waiting-overlay', 'none');
        applyStateSync(data);

        if (isEventType(data, 'MATCH_START_SYNC')) {
            triggerVersusAnimation(data.p1Show, data.p2Show, data.p3Show);
        }
    } else if (isEventType(data, 'WIN_SYNC')) {
        showWinModal(data.winner, data.isFinalTeamWin);
    } else if (isEventType(data, 'CLOSE_WIN_SYNC')) {
        safeSetDisplay('win-modal', 'none');
    } else if (isEventType(data, 'MODE_SYNC')) {
        setMatchMode(data.mode, false, false);
    }
}

// 🎯 修正點 1：收斂狀態同步，並調用 setMatchMode 保持 targetScore 一致
function applyStateSync(data) {
    if (data.scoreP1 !== undefined) scoreP1 = data.scoreP1;
    if (data.scoreP2 !== undefined) scoreP2 = data.scoreP2;
    if (data.scoreP3 !== undefined) scoreP3 = data.scoreP3;
    if (data.foulsP1 !== undefined) foulsP1 = data.foulsP1;
    if (data.foulsP2 !== undefined) foulsP2 = data.foulsP2;
    if (data.foulsP3 !== undefined) foulsP3 = data.foulsP3;
    if (data.teamWinsP1 !== undefined) teamWinsP1 = data.teamWinsP1;
    if (data.teamWinsP2 !== undefined) teamWinsP2 = data.teamWinsP2;
    if (data.kofIndexP1 !== undefined) kofIndexP1 = data.kofIndexP1;
    if (data.kofIndexP2 !== undefined) kofIndexP2 = data.kofIndexP2;
    if (data.battleCount !== undefined) battleCount = data.battleCount;

    if (data.roster) roster = data.roster;
    if (data.isMatchLocked !== undefined) isMatchLocked = data.isMatchLocked;
    if (Array.isArray(data.logs)) logs = [...data.logs];
    if (Array.isArray(data.history)) history = [...data.history];

    // ✅ 自動刷新目標分數 (targetScore) 與 UI 版型
    if (data.matchMode && typeof setMatchMode === 'function') {
        setMatchMode(data.matchMode, false, false);
    }

    updatePlayerNamesForMode();
    updateDisplay();
}

// 🎯 修正點 2：刪除重複的 getFullState()，直接使用 app.js 唯一權威版本

function broadcastToClients(payload) {
    if (myPeerRole !== 'host') return;
    cleanDeadConnections();
    payload._v = PROTOCOL_VERSION;
    Object.values(p2pConnMap).forEach(conn => {
        if (conn && conn.open) {
            try { conn.send(payload); } catch(e) {}
        }
    });
}
