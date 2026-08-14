# ⚡ BX Score Keeper 爆旋計分器

[English](#english) | [繁體中文](#繁體中文)

---

<a name="繁體中文"></a>
## 📖 關於本專案 (About This Project)

本專案是為我和兒子共渡美好時光而開發的非商業個人專案！我們特別打造了這個專業計分工具，讓每一次陀螺對戰都更流暢、更有儀式感，並完美貼合亞洲官方賽事標準。誠摯邀請所有大朋友和小朋友一起使用，享受公平對戰的樂趣，共創無價的回憶！

---

### ✨ 核心功能
* **完美對應《爆旋陀螺X規則（亞洲版）》第 12 版官方標準**：
  * 🔴 **極限終結 (Xtreme Finish)**：+3 分
  * 🟠 **擊出終結 (Over Finish)**：+2 分
  * 🟡 **爆裂終結 (Burst Finish)**：+2 分
  * 🟢 **迴轉勝利 (Spin Finish)**：+1 分
  * 🟣 **發射失誤/罰分 (Shooting Error / Foul)**：同一局累積 2 次失誤，對手自動獲得 +1 分。
* **🌐 WebRTC P2P 跨機連線與裁判等候大廳 (全新重大功能)**：
  * 👑 **裁判主機 (Host Lobby)**：建立全天通用 8 位數房間，自由審核、清空、一鍵左右/三人輪調並鎖定全場開賽。
  * 🎮 **選手私密提交 (Player)**：選手在自己手機填寫陀螺/隊伍排陣，私密送出給裁判審核。
  * 👁️ **現場觀眾同步直播 (Spectator)**：最多支援 15 部設備同時在線，比分、登場動畫、對局紀錄（Log）與金光勝利彈窗 100% 秒速同步！
  * 💓 **心跳防休眠 (Keepalive)**：每 5 秒 Ping/Pong 保持連線，徹底防止手機背景休眠斷線。
* **全賽事模式支援**：
  * ⚔️ **1v1 Standard**：經典單人 4 分獲勝制。
  * 🛡️ **3on3 Battle**：支援 3 隻陀螺排陣對決，打完 3 戰未滿 4 分自動提示重新組合順序。
  * 👥 **Team Battle (KOF 模式)**：每局 2 分制，先鋒 ➔ 中堅 ➔ 大將輪替登場，勝方留場、敗方換人，自動累計團隊總勝場。
  * 🌀 **3-Player Battle (三人亂鬥 5分制)**：官方 3 人大亂鬥專用！率先累積 5 分者獲勝，支援三方登場動畫（XX VS YY VS ZZ）。
* **賽事輔助與視覺特效**：
  * 📢 **官方語音發射倒數**：內建「3, 2, 1, Go Shoot!」語音與音頻倒數提示。
  * 📱 **手機橫屏滿版 (Landscape)**：手機一打橫自動隱藏贅餘頂格顯示，兩張卡片左右滿版排開。
  * ⚡ **動漫風登場與獲勝動畫**：開賽 Versus 動畫與勝利金光彈窗全場同步。
  * 🤝 **平手機制 (Draw)**：一鍵記錄同分重賽。
  * 📜 **實時對局紀錄 (Battle Log)** 與 **Undo (復原)** 功能。
  * 💾 **LocalStorage 自動儲存**：防止意外重新整理掉資料。
  * 🌐 **100% 完整雙語切換**：繁體中文與亞洲官方英文一鍵無縫切換。
* **PWA & Offline-First (離線優先)**：可直接加至手機主畫面當作原生 App 使用，無網路環境亦可順暢單機計分。

---

### 📲 如何安裝與使用 (Installation & Setup)

#### 1. 手機端即開即用（推薦：PWA 捷徑安裝）
本專案支援 PWA（漸進式 Web 應用），**毋須經由 App Store / Google Play 下載**即可享受原生 App 體驗：
* **iOS (iPhone / iPad)**：
  1. 使用 **Safari** 瀏覽器開啟專案網址。
  2. 點擊底部工具列的 **「分享」** 圖示（帶箭頭的方框）。
  3. 向下捲動並選擇 **「加入主畫面」 (Add to Home Screen)**。
* **Android (Chrome)**：
  1. 使用 **Chrome** 瀏覽器開啟專案網址。
  2. 點擊右上角 **選單**（三個點）。
  3. 選擇 **「安裝應用程式」** 或 **「加至主螢幕」 (Install App / Add to Home screen)**。

#### 2. 本機開發與部署 (Local Development)
如果您想在電腦運行或自行調整功能：
```bash
# 1. 複製專案庫 (Clone repository)
git clone [https://github.com/your-username/bx-score-keeper.git](https://github.com/your-username/bx-score-keeper.git)

# 2. 進入專案資料夾
cd bx-score-keeper

# 3. 安裝相依套件 (Install dependencies)
npm install

# 4. 啟動本機開發伺服器 (Start local server)
npm run dev

```
<a name="english"></a>
## 📖 About This Project
This repository is a non-commercial personal project created to capture precious bonding moments between my son and me! Driven by our shared passion for competitive play, we built this tool to make every battle seamless, engaging, and fully aligned with official tournament standards across Asia. We warmly invite parents, kids, and bladers of all ages to use it, enjoy fair battles, and create unforgettable memories together!
### ✨ Features
 * **Official 12th Edition Scoring Alignment (Asia Version)**:
   * 🔴 **Xtreme Finish**: +3 pts
   * 🟠 **Over Finish**: +2 pts
   * 🟡 **Burst Finish**: +2 pts
   * 🟢 **Spin Finish**: +1 pt
   * 🟣 **Shooting Error / Foul Penalty**: 2 fouls in a single battle automatically award +1 pt to the opponent.
 * **🌐 WebRTC P2P Multi-Device Live Hub (Major Feature)**:
   * 👑 **Referee Host Lobby**: Host persistent all-day rooms, review secret rosters, clear/swap slots, and start matches simultaneously.
   * 🎮 **Player Secret Submission**: Players privately enter Beyblade deck / team member lineups and submit directly to the referee.
   * 👁️ **Spectator Live Sync**: Supports up to 15 concurrent devices! Scoreboard, Versus animations, Battle Logs, and Victory Popups sync seamlessly in real time.
   * 💓 **Heartbeat Keepalive**: Auto-pings every 5 seconds to prevent mobile browser background sleep/disconnects.
 * **Multiple Tournament Formats**:
   * ⚔️ **1v1 Standard**: Classic first-to-4 points format.
   * 🛡️ **3on3 Battle**: 3-Bey deck battle format with auto prompt for order re-arrangement after 3 battles if under 4 points.
   * 👥 **Team Battle (KOF Format)**: First to 2 points per individual battle. 1st Vanguard ➔ 2nd Middle ➔ 3rd General rotation. Winner stays, loser rotates out.
   * 🌀 **3-Player Battle (5-pt System)**: Official 3-blader battle royale format! First to 5 points wins. Features 3-way Versus animation (XX VS YY VS ZZ).
 * **Tournament Utilities & Visual Enhancements**:
   * 📢 **Voice Countdown**: Built-in "3, 2, 1, Go Shoot!" vocal and audio tone countdown.
   * 📱 **Mobile Landscape Fullscreen**: Rotating your phone horizontally maximizes the scoreboard into a clean, fullscreen dual-card layout.
   * ⚡ **Versus & Victory Popups**: Anime-styled Versus intro and winner celebration modals synchronized across all screens.
   * 🤝 **Draw Support**: One-tap draw recording for simultaneous finishes.
   * 📜 **Real-time Battle Log** and **Undo** support.
   * 💾 **State Persistence**: Auto-saves current score state to localStorage.
   * 🌐 **100% Bilingual Support**: Instant toggle between Traditional Chinese and International English.
 * **PWA & Offline-First**: Installable directly to your mobile home screen. Fully functional for offline single-device scoring without internet access.
### 📲 How to Install & Run
#### 1. Instant Mobile Setup (Recommended: PWA)
This project is built as a Progressive Web App (PWA) — **no App Store / Google Play download required**:
 * **iOS (Safari)**:
   1. Open the web link in **Safari**.
   2. Tap the **Share** button at the bottom.
   3. Scroll down and tap **"Add to Home Screen"**.
 * **Android (Chrome)**:
   1. Open the web link in **Chrome**.
   2. Tap the top-right menu (three dots).
   3. Select **"Install app"** or **"Add to Home screen"**.
#### 2. Local Development & Hosting
To clone, run, or customize the project locally:
```bash
# 1. Clone the repository
git clone [https://github.com/your-username/bx-score-keeper.git](https://github.com/your-username/bx-score-keeper.git)

# 2. Navigate to project root
cd bx-score-keeper

# 3. Install dependencies
npm install

# 4. Start local development server
npm run dev

```
### 🛡️ Privacy & Security / 私隱聲明
 * **Zero-Backend (純前端架構)**：不設後端伺服器，不使用 Cookie，不收集任何個人可識別資料 (PII)。
 * **P2P Direct Connection (端對端直連)**：所有跨機數據透過 WebRTC Peer-to-Peer 於裝置間直連傳輸，不經由第三方伺服器儲存。
 * **Privacy by Design**：所有對戰數據僅儲存於使用者本地瀏覽器 (localStorage) 中。
### 📄 Disclaimer / 免責聲明
This is an unofficial fan-made tool created for scoring purposes only, based on BEYBLADE X Regulations (Asia Version) 12th Edition. All product names and trademarks belong to their respective owners.
本工具為玩家自製非官方社群對戰計分器，依據《爆旋陀螺X規則（亞洲版）》第 12 版製作。版權歸原著作權所有者所有。
