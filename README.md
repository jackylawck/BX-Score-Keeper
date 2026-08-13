# ⚡ BX Score Keeper | 《爆旋陀螺X》對戰計分器

[English](#english) | [繁體中文](#繁體中文)

---

<a name="繁體中文"></a>
## 📖 關於本專案 (About This Project)

本專案是為我和兒子共渡美好時光而開發的非商業個人專案！特別打造了這個計分工具，讓每一次對戰都更流暢、更有儀式感，並完美貼合官方賽事標準。誠摯邀請所有大朋友和小朋友一起使用，享受公平對戰的樂趣，共創無價的親子回憶！

### ✨ 核心功能
* **完美對應官方第 12 版規則**：
  * 🔴 **極致收尾 (Xtreme Finish)**：+3 分
  * 🟠 **完工 / 超區 (Over Finish)**：+2 分
  * 🟡 **爆裂終結 (Burst Finish)**：+2 分
  * 🟢 **旋轉收尾 (Spin Finish)**：+1 分
* **多種賽事模式支援**：
  * ⚔️ **1v1 Standard**：經典 4 分獲勝制。
  * 🛡️ **3on3 Battle**：自動追蹤 3 陀螺 Deck 順序（ITEM #1 ~ #3）；打完 3 場若未滿 4 分，自動提示並重置出場順序（保留比分）。
  * 👥 **Team Battle (KOF 模式)**：每局 2 分制，勝方留場、敗方換人，自動重置局比分（0-0）並累計團隊總勝場。
* **PWA & Offline-First (離線優先)**：可直接加至手機主畫面當作原生 App 使用，無網路環境亦可順暢運作。
* **賽事輔助工具**：
  * 🔊 **Web Audio 聲效**：加分與勝利時播放科技感音效。
  * 📜 **實時對局紀錄 (Battle Log)** 與 **Undo (復原)** 功能。
  * 💾 **LocalStorage 自動儲存**：防止意外重新整理掉資料。
  * 📖 **內建雙語規則摘要彈窗**。

---

<a name="english"></a>
## 📖 About This Project

This repository is a non-commercial personal project created to capture precious bonding moments between my son and me! Driven by a shared passion for top-tier competitive play, we built this scorekeeper to make every battle seamless, engaging, and fully aligned with official tournament standards. We warmly invite parents, kids, and players of all ages to use it, enjoy fair battles, and create unforgettable family memories together!

### ✨ Features
* **Official 12th Edition Scoring Alignment**:
  * 🔴 **Xtreme Finish**: +3 pts
  * 🟠 **Over Finish**: +2 pts
  * 🟡 **Burst Finish**: +2 pts
  * 🟢 **Spin Finish**: +1 pt
* **Multiple Tournament Formats**:
  * ⚔️ **1v1 Standard**: First to 4 points.
  * 🛡️ **3on3 Battle**: Tracks 3-Bey Deck order (ITEM #1 ~ #3). Automatically prompts for order re-arrangement after 3 rounds if no player reaches 4 points (scores retained).
  * 👥 **Team Battle (KOF Format)**: First to 2 points per individual battle. Winner stays, loser rotates out. Resets round scores to 0-0 while tracking cumulative team wins.
* **PWA & Offline-First**: Installable directly to your mobile home screen. Fully functional without an internet connection.
* **Tournament Utilities**:
  * 🔊 **Web Audio Sound Effects**: Instant sound feedback for scoring and match victory.
  * 📜 **Real-time Battle Log** and **Undo** support.
  * 💾 **State Persistence**: Auto-saves current score state to `localStorage` to prevent data loss.
  * 📖 **Built-in Bilingual Rules Summary Modal**.

---

### 🛡️ Privacy & Security / 私隱聲明
* **Zero-Backend (純前端)**：不設後端伺服器，不使用 Cookie，不收集任何個人可識別資料 (PII)。
* **Privacy by Design**：所有對戰比分與選手自訂名稱僅儲存於使用者本地瀏覽器 (`localStorage`) 中。

---

### 📄 Disclaimer / 免責聲明
This is an unofficial fan-made tool created for scoring purposes only, based on BEYBLADE X Regulations (Asia Version) 12th Edition. All product names and trademarks belong to their respective owners.
本工具為玩家自製非官方社群對戰計分器，依據《爆旋陀螺X規則（亞洲版）》第 12 版製作。
