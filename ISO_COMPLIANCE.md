# ISO 國際標準治理合規聲明 / ISO Standards Compliance Statement

**對標標準 / Target Standards:**  
- ISO/IEC 27001:2022 (Information Security Management Systems)  
- ISO/IEC 27701:2019 (Privacy Information Management Systems)  
- ISO/IEC 42001:2023 (Artificial Intelligence Management Systems)  

**最後更新 / Last Updated:** 2026-08-20

---

## 繁體中文

### 1. ISO/IEC 27001:2022 資訊安全控制 (Information Security)
* **零伺服器攻擊面 (Zero-Backend Architecture)：** 專案採用 100% 客戶端運算架構（純前端 PWA），不設遠端資料庫與帳號登入系統，從架構層面根除集中式資料外洩及未授權存取風險。
* **點對點安全傳輸 (P2P In-Transit Encryption)：** 跨裝置即時同步採用 WebRTC DataChannel，以 DTLS 端對端加密進行點對點傳輸，計分訊號不經由任何第三方伺服器儲存或中轉。
* **安全交付與完整性 (Static Integrity & CSP)：** 全站託管於 GitHub Pages 靜態環境並強制啟用 HTTPS，透過嚴格之內容安全策略（CSP）防範 XSS 腳本注入與非法外部資料外聯。

### 2. ISO/IEC 27701:2019 隱私資訊管理 (Privacy Information)
* **預設隱私與資料最小化 (Privacy by Design & Data Minimization)：** 遵循嚴格的資料最小化原則，全系統不收集、不記錄、不處理任何個人識別資訊（PII）、追蹤 Cookies 或用戶遙測行為。
* **本機資料主權 (Data Subject Control & Local Storage)：** 裁判計分歷史、3on3 陣容選定與自訂設定純粹留存於瀏覽器本機記憶體與 `localStorage`，使用者具備 100% 控制權，可隨時一鍵重設或抹除。

### 3. ISO/IEC 42001:2023 人工智慧管理 (AI Management)
* **確定性規則基準 (Deterministic Rule Engine)：** 系統核心計分邏輯、犯規扣分與晉級判決嚴格遵循《亞洲版官方錦標賽規則》（第 12 版），為 100% 確定性代碼，具備完全之可重複性、公正性與可解釋性（Explainability）。
* **AI 治理與透明度 (AIMS Transparency & Human-in-the-Loop)：** 裁判執法堅持「人機協同（Human-in-the-Loop）」原則。未來若引進陀螺轉速音訊估算或相機自動計分輔助模組，將維持嚴格之演算法透明度，並杜絕未經授權之即時影像與聲音數據回傳訓練。

---

## English

### 1. ISO/IEC 27001:2022 Information Security Controls
* **Zero-Backend Attack Surface:** Built as a 100% client-side Progressive Web App (PWA), the system eliminates remote databases and user credential systems, fundamentally mitigating server compromise and data breach risks.
* **P2P In-Transit Encryption:** Multi-device synchronization is powered by WebRTC DataChannels secured with end-to-end DTLS encryption, ensuring match signals are transmitted directly peer-to-peer without routing through intermediary servers.
* **Secure Delivery & Integrity:** Hosted via static GitHub Pages under mandatory HTTPS enforcement, utilizing strict Content Security Policies (CSP) to block Cross-Site Scripting (XSS) and unauthorized external telemetry.

### 2. ISO/IEC 27701:2019 Privacy Information Controls
* **Privacy by Design & Data Minimization:** Enforcing a strict zero-knowledge architecture, the system inherently prohibits the harvesting, tracking, or transmission of Personally Identifiable Information (PII), tracking cookies, or behavioral logs.
* **Data Subject Sovereignty:** Match scores, 3on3 deck selections, and referee configurations reside strictly within the client browser's memory and `localStorage`, granting users full autonomy to inspect or purge records at will.

### 3. ISO/IEC 42001:2023 AI Management Controls
* **Deterministic Rule Baseline & Explainability:** Match scoring, foul penalty deductions, and tournament progression strictly adhere to the Official Asian Tournament Regulations (12th Edition), guaranteeing 100% deterministic, auditable, and mathematically explainable rule execution.
* **AIMS Governance & Human-in-the-Loop:** Upholds the Human-in-the-Loop principle for all refereeing decisions. Should computer vision or acoustic RPM estimation modules be introduced in the future, they will maintain full transparency and strictly prohibit outbound streaming of sensor data for model training.
