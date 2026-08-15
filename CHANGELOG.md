# 📋 Changelog | 版本更新紀錄

All notable changes to the **BX Score Keeper** project will be documented in this file.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

本專案遵循語意化版本（Semantic Versioning）與標準更新日誌規範。

---

## [1.0.0] - 2026-08-15 - *Official Production Release*

### 🚀 Highlights (核心亮點)
* **First Official Production Release**: Fully compliant with the official Asia Version 12th Edition Beyblade X tournament regulations.
* **WebRTC Live Sync Hub**: Zero-backend P2P synchronization supporting up to 15 concurrent devices (Referee Lobby, Secret Player Deck Submissions, Spectator Live Screens).
* **Zero-Install PWA**: Instant browser launch with offline-first caching capability.

### ✨ Added (新增功能)
* **WebRTC P2P Live Sync Hub (跨機連線中樞)**:
  * Persistent 8-digit Room ID for continuous matches without room recreation.
  * Secret blind deck submission for 3-Deck and Team orders to prevent counter-picking.
  * Multi-screen spectator live broadcasting (supporting up to 15 devices).
  * 3-second bidirectional heartbeat keepalive to prevent mobile browser sleep and auto-recover state.
* **4 Official Tournament Formats (四大官方賽制清算)**:
  * `1v1 Standard`: First to 4 points.
  * `3on3 Battle`: 3-Bey battle sequence with order reshuffle prompt after 3 battles if under 4 points.
  * `Team Battle (KOF 3v3)`: 2-point rounds with Vanguard, Middle, and General roster rotation (Winner stays, loser rotates).
  * `3-Player Battle`: 3-player battle royale (First to 5 points) with animated tri-party versus card (`P1 VS P2 VS P3`).
* **Official Voice & Audio Engine (官方倒數語音引擎)**:
  * Web Audio API synthesized voice countdown with steady定拍 `3... 2... 1...` and explosive `Go... Shoot!`.
* **Landscape Broadcast Mode (橫屏導播滿版模式)**:
  * Auto-fullscreen responsive layout in landscape orientation for OBS live streaming and spectators.
* **Full Bilingual Localization (中英雙語即時切換)**:
  * Dynamic header and interface switching between Traditional Chinese (Official Asian terminology) and Global English.

### 🐛 Fixed (問題修復)
* Fixed PeerJS `open` event missing on Android Chrome via proactive fallback registration.
* Fixed state synchronization mismatch between string literals and event constants in `p2p.js`.
* Fixed `loadState()` input setter/getter confusion to ensure player names are accurately restored after reload.
* Fixed dynamic application title switching (`爆旋計分器` ↔ `BX SCORE KEEPER`) linked to `id="app-main-title"`.

### ⚡ Optimized & Security (效能優化與防護)
* Read-only UI lock on Player and Spectator interfaces (`pointer-events: none`) to prevent accidental scoring conflicts.
* Service Worker upgraded to `bx-score-v67` with Network-First caching strategy and offline `404.html` fallback.
* Added `controllerchange` listener in `app.js` to prompt users upon new PWA version deployment.

### 🔄 Changed (變更)
* Standardized all P2P internal event constants onto `window.P2P_EVENTS`.

### 🗑️ Deprecated (已棄用)
* None.

### ❌ Removed (已移除)
* Removed legacy 5-second slow heartbeat in favor of 3-second responsive keepalive.

---

## [0.9.0] - 2026-08-10 - *Beta Testing & Protocol Validation*

### ✨ Added (新增功能)
* **Core Scoring Engine**: Xtreme (+3), Over (+2), Burst (+2), Spin (+1) scoring logic with real-time UI updates.
* **Foul System**: Shooting error tracking with 2-foul penalty (+1 to opponent) and auto-reset after scoring.
* **Local Storage Persistence**: Automatic save/restore of match state, player names, and battle logs.
* **Undo Mechanism**: Step-by-step history rollback for referee corrections.
* **Initial WebRTC Handshake**: Basic PeerJS connection establishment for 1v1 remote scoring.

### 🐛 Fixed (問題修復)
* Fixed mobile Safari connection drop issues during background switching.
* Fixed score display flickering during rapid consecutive button presses.

---

## 🔮 Upcoming Roadmap (v1.1.0 規劃)
* 🇯🇵 **Japanese (日本語)** & 🇰🇷 **Korean (한국어)** official terminology localization.
* 📊 **Tournament Match Report Export** (One-click CSV & text export for WhatsApp/Discord sharing).
* 🟢 **Live Connection Status Indicator** (Visual heartbeat pulse dot on status bar).
* 🌐 **Optional TURN Server Fallback** for strict corporate/school symmetric NAT firewalls.

---

## 👨‍💻 Maintainer & Authors
* **Jacky Law** ([@jackylawck](https://github.com/jackylawck)) & Son
* **License**: [MIT License](LICENSE)
