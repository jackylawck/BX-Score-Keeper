# 🤖 AI & Algorithmic Governance Statement | AI 與演算法治理聲明

**Compliance Baseline / 合規參考標準**: EU AI Act (Risk Tier Assessment), ISO/IEC 42001 (AIMS), NIST AI RMF.

---

## 🌐 English (EN)

### 1. AI Risk Tier Classification (EU AI Act)
* **Minimal / Low Risk Classification**: BX Score Keeper is classified under the **Minimal / Zero Risk** category under the EU AI Act.
* The system does **NOT** deploy generative LLMs, biometric categorization, social scoring, or high-risk autonomous decision-making algorithms.

### 2. Client-Side Speech Synthesis (Transparency & Explainability)
* The automated countdown engine (`3, 2, 1, Go Shoot!`) relies entirely on the client-side **W3C Web Speech API (SpeechSynthesisUtterance)** native to the user's browser/operating system.
* No audio is transmitted to external generative AI services or cloud processing endpoints.

### 3. Algorithmic Fairness & Rule Determinism (ISO/IEC 42001 Aligned)
* All scoring resolution, point threshold checks (4-pt / 2-pt / 5-pt), and KOF rotation logic are governed by **deterministic, audited state-machine algorithms**, preventing bias, hallucination, or non-deterministic judgment errors.

---

## 🇭🇰 繁體中文 (ZH)

### 1. AI 風險分級判定（歐盟 AI 法案標準）
* **最低風險級別（Minimal Risk）**：本應用程式依據歐盟《人工智慧法案》（EU AI Act）評估屬於最低/無風險類別。
* 系統**不包含**任何生成式黑箱模型、生物特徵識別、社會評分或高風險自主決策演算法。

### 2. 瀏覽器端語音合成（透明度與可解釋性）
* 倒數語音指令（`3, 2, 1, Go Shoot!`）完全使用裝置瀏覽器內建之 **W3C Web Speech API** 原生語音引擎合成。
* 所有音訊處理均在本地端即時完成，絕不傳輸至任何雲端 AI 伺服器。

### 3. 演算法公正性與確定性（符合 ISO/IEC 42001 管理原則）
* 所有勝負清算、雙黃牌失誤罰分及 KOF 隊伍輪替機制均採用**100% 確定性狀態機（Deterministic State Machine）**程式碼執行，確保裁判與選手獲得公開、透明、可重現且無演算法偏見之公正判定。
