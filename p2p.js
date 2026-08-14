/* =========================================================================
 * 🌐 p2p.js - WebRTC PeerJS Multi-Device Sync (Max 28 Devices)
 * ========================================================================= */

const MAX_DEVICES = 28;

let peer = null;
let p2pConnMap = {}; 
let hostConn = null;  
let myPeerRole = 'none'; // 'host', 'player', 'spectator'
let currentRoomId = '';
let pendingClientData = null;
let occupiedSlots = { slot1: false, slot2: false, slot3: false };
let isMatchLocked = false;
let heartbeatTimer = null;

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
        if (nameInput) nameInput.placeholder = currentLang === 'zh' ? '選手姓名 (例如 BB)' : 'Player Name (e.g. BB)';
    } else if (mode === '3v3') {
        if (extraBox) extraBox.style.display = 'block';
        if (nameInput) nameInput.placeholder = currentLang === 'zh' ? '選手姓名 (例如 BB)' : 'Player Name (e.g. BB)';
        safeSetInputPlaceholder('p2p-item-1', currentLang === 'zh' ? '陀螺 1 號 (ITEM #1)' : 'Bey #1 (ITEM #1)');
        safeSetInputPlaceholder('p2p-item-2', currentLang === 'zh' ? '陀螺 2 號 (ITEM #2)' : 'Bey #2 (ITEM #2)');
        safeSetInputPlaceholder('p2p-item-3', currentLang === 'zh' ? '陀螺 3 號 (ITEM #3)' : 'Bey #3 (ITEM #3)');
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

    peer = new Peer(currentRoomId);
    
    peer.on('open', (id) => {
        myPeerRole = 'host';
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

    peer.on('connection', (conn) => {
        let currentCount = Object.keys(p2pConnMap).length;

        if (currentCount >= MAX_DEVICES) {
            conn.on('open', () => {
                conn.send({ type: 'ROOM_CAPACITY_FULL' });
                setTimeout(() => conn.close(), 500);
            });
            return;
        }

        p2pConnMap[conn.peer] = conn;
        updateConnectedCount();

        conn.on('open', () => {
            conn.send({
                type: 'INIT_SYNC',
                isMatchLocked: isMatchLocked,
                roster: roster,
                scoreP1, scoreP2, scoreP3,
                foulsP1, foulsP2, foulsP3,
                teamWinsP1, teamWinsP2, kofIndexP1, kofIndexP2,
                battleCount, matchMode,
                logs: logs,
                connectedCount: Object.keys(p2pConnMap).length
            });
            broadcastDeviceCount();
        });

        conn.on('data', (data) => {
            if (data.type === 'PING') {
                conn.send({ type: 'PONG' });
                return;
            }
            handleHostReceivedData(data, conn);
        });

        conn.on('close', () => {
            delete p2pConnMap[conn.peer];
            updateConnectedCount();
            broadcastDeviceCount();
        });
    });

    peer.on('error', (err) => {
        alert("Peer Error: " + err.type);
    });
}

function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
        if (myPeerRole === 'host') {
            broadcastToClients({ type: 'PING' });
        } else if (hostConn && hostConn.open) {
            hostConn.send({ type: 'PING' });
        }
    }, 5000);
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
    broadcastToClients({ type: 'DEVICE_COUNT_SYNC', count });
}

/* 🎯 進入等候大廳：保證賽制下拉選單與裁判當前模式 100% 同步 */
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
    broadcastToClients({ type: 'LOBBY_WAITING' });
}

function closeLobbyModal() { safeSetDisplay('lobby-modal', 'none'); }

function handleLobbyModeChange() {
    let newMode = document.getElementById('lobby-match-mode').value;
    setMatchMode(newMode, false);
    applyLobbyLayout();
    broadcastToClients({ type: 'MODE_SYNC', mode: newMode });
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

/* 🎯 關鍵修復：正確將收到的 Daddy / BB 隊名同步到大廳輸入框 */
function syncRosterToLobbyUI() {
    let defP1 = currentLang === 'zh' ? '選手一' : 'Player 1';
    let defP2 = currentLang === 'zh' ? '選手二' : 'Player 2';
    let defP3 = currentLang === 'zh' ? '選手三' : 'Player 3';

    if (matchMode === 'team') {
        safeSetInputValue('lobby-p1-name', roster.t1Name || defP1);
        safeSetInputValue('lobby-p2-name', roster.t2Name || defP2);
    } else {
        safeSetInputValue('lobby-p1-name', (roster.t1 && roster.t1[0]) ? roster.t1[0] : (roster.t1Name || defP1));
        safeSetInputValue('lobby-p2-name', (roster.t2 && roster.t2[0]) ? roster.t2[0] : (roster.t2Name || defP2));
    }
    safeSetInputValue('lobby-p3-name', roster.t3Name || defP3);

    safeSetInputValue('lobby-p1-d1', (roster.t1 && roster.t1[0]) || '1');
    safeSetInputValue('lobby-p1-d2', (roster.t1 && roster.t1[1]) || '2');
    safeSetInputValue('lobby-p1-d3', (roster.t1 && roster.t1[2]) || '3');

    safeSetInputValue('lobby-p2-d1', (roster.t2 && roster.t2[0]) || 'A');
    safeSetInputValue('lobby-p2-d2', (roster.t2 && roster.t2[1]) || 'B');
    safeSetInputValue('lobby-p2-d3', (roster.t2 && roster.t2[2]) || 'C');
}

function clearLobbySlot(slotNum) {
    let defP1 = currentLang === 'zh' ? '選手一' : 'Player 1';
    let defP2 = currentLang === 'zh' ? '選手二' : 'Player 2';
    let defP3 = currentLang === 'zh' ? '選手三' : 'Player 3';

    if (slotNum === 1) {
        occupiedSlots.slot1 = false;
        roster.t1Name = defP1;
        roster.t1 = ['1', '2', '3'];
        safeSetInputValue('lobby-p1-name', defP1);
        safeSetInputValue('lobby-p1-d1', '1');
        safeSetInputValue('lobby-p1-d2', '2');
        safeSetInputValue('lobby-p1-d3', '3');
    } else if (slotNum === 2) {
        occupiedSlots.slot2 = false;
        roster.t2Name = defP2;
        roster.t2 = ['A', 'B', 'C'];
        safeSetInputValue('lobby-p2-name', defP2);
        safeSetInputValue('lobby-p2-d1', 'A');
        safeSetInputValue('lobby-p2-d2', 'B');
        safeSetInputValue('lobby-p2-d3', 'C');
    } else if (slotNum === 3) {
        occupiedSlots.slot3 = false;
        roster.t3Name = defP3;
        safeSetInputValue('lobby-p3-name', defP3);
    }

    isMatchLocked = false;
    broadcastToClients({ type: 'LOBBY_WAITING' });
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

    broadcastToClients({
        type: 'MATCH_START_SYNC',
        isMatchLocked: true,
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
            }

            startHeartbeat();
            setUIPermissions();
            safeSetText('p2p-current-room', inputId);
        });

        hostConn.on('data', (data) => {
            if (data.type === 'PING') {
                hostConn.send({ type: 'PONG' });
                return;
            }
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
        alert(currentLang === 'zh' ? "未連線至裁判端！" : "Not connected to Referee!");
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
        if (isMatchLocked) {
            conn.send({ type: 'REJECT_FULL' });
            return;
        }

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

        safeSetDisplay('p2p-confirm-modal', 'flex');
    }
}

/* 🎯 關鍵修復：自動分配進 Slot 時，確實把隊伍名存入 roster.t1Name 或 roster.t2Name */
function autoAcceptClientSubmission() {
    if (!pendingClientData) return;

    let data = pendingClientData;

    let targetSlot = 1;
    if (!occupiedSlots.slot1) {
        targetSlot = 1;
    } else if (!occupiedSlots.slot2) {
        targetSlot = 2;
    } else if (matchMode === 'p3' && !occupiedSlots.slot3) {
        targetSlot = 3;
    } else {
        targetSlot = 1;
    }

    if (targetSlot === 1) {
        roster.t1Name = data.name;
        roster.t1 = (data.items && data.items.length) ? [...data.items] : [data.name, '2', '3'];
        occupiedSlots.slot1 = true;
    } else if (targetSlot === 2) {
        roster.t2Name = data.name;
        roster.t2 = (data.items && data.items.length) ? [...data.items] : [data.name, 'B', 'C'];
        occupiedSlots.slot2 = true;
    } else if (targetSlot === 3) {
        roster.t3Name = data.name;
        occupiedSlots.slot3 = true;
    }

    safeSetDisplay('p2p-confirm-modal', 'none');
    openLobbyModal();
}

function rejectClientSubmission() {
    pendingClientData = null;
    safeSetDisplay('p2p-confirm-modal', 'none');
}

function handleClientReceivedData(data) {
    if (data.type === 'ROOM_CAPACITY_FULL') {
        alert(currentLang === 'zh' ? "⚠️ 本房間人數已達 28 人上限！無法加入。" : "⚠️ Room capacity reached (28/28 max)!");
        leaveP2PRoom();
    } else if (data.type === 'DEVICE_COUNT_SYNC') {
        updateConnectedCount(data.count);
    } else if (data.type === 'INIT_SYNC') {
        isMatchLocked = data.isMatchLocked || false;
        if (isMatchLocked && myPeerRole === 'player') {
            myPeerRole = 'spectator';
            safeSetText('p2p-role-badge', currentLang === 'zh' ? '👁️ SPECTATOR (觀眾)' : '👁️ SPECTATOR');
            safeSetDisplay('p2p-client-submit-box', 'none');
            closeP2PModal();
            setUIPermissions();
            alert(currentLang === 'zh' ? "⚠️ 本局對戰已鎖定開賽！您已自動轉為【觀眾直播】模式。" : "⚠️ Match is in progress! Automatically switched to Spectator mode.");
        } else if (myPeerRole === 'player' && !isMatchLocked) {
            alert(currentLang === 'zh' ? "已成功連線至裁判房間！請填寫資料並送出。" : "Connected! Please fill in your roster and submit.");
        }
        if (data.connectedCount) updateConnectedCount(data.connectedCount);
        applyStateSync(data);
    } else if (data.type === 'LOBBY_WAITING') {
        safeSetDisplay('win-modal', 'none');
        if (myPeerRole === 'player') {
            safeSetDisplay('p2p-client-submit-box', 'block');
            safeSetDisplay('spectator-waiting-overlay', 'none');
        } else {
            safeSetDisplay('spectator-waiting-overlay', 'flex');
        }
    } else if (data.type === 'REJECT_FULL') {
        alert(currentLang === 'zh' ? "⚠️ 本局對戰名額已滿並由裁判鎖定！系統已自動將你切換為【觀眾觀戰】模式。" : "⚠️ Match slots are full! Switched to Spectator mode.");
        myPeerRole = 'spectator';
        safeSetText('p2p-role-badge', currentLang === 'zh' ? '👁️ SPECTATOR (觀眾)' : '👁️ SPECTATOR');
        safeSetDisplay('p2p-client-submit-box', 'none');
        closeP2PModal();
        setUIPermissions();
    } else if (data.type === 'STATE_SYNC' || data.type === 'MATCH_START_SYNC') {
        safeSetDisplay('spectator-waiting-overlay', 'none');
        if (data.isMatchLocked !== undefined) isMatchLocked = data.isMatchLocked;
        applyStateSync(data);

        if (data.type === 'MATCH_START_SYNC') {
            triggerVersusAnimation(data.p1Show, data.p2Show);
        }
    } else if (data.type === 'WIN_SYNC') {
        showWinModal(data.winner, data.isFinalTeamWin);
    } else if (data.type === 'CLOSE_WIN_SYNC') {
        safeSetDisplay('win-modal', 'none');
    } else if (data.type === 'MODE_SYNC') {
        setMatchMode(data.mode, false);
    }
}

function applyStateSync(data) {
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
}

function broadcastToClients(payload) {
    if (myPeerRole !== 'host') return;
    Object.values(p2pConnMap).forEach(conn => {
        if (conn && conn.open) {
            conn.send(payload);
        }
    });
}
