# Moyeniz — Wealth Portfolio & Debt Tracker

https://dpnkrpl.github.io/moyeniz/

<img width="1915" height="911" alt="image" src="https://github.com/user-attachments/assets/07fdbd7b-3ee0-403e-bc95-3a604acb6bba" />

---

Moyeniz is a feature-rich, high-performance, and **100% client-side** wealth and liability tracking dashboard. It helps you manage your investments, track personal loans, schedule debt/EMIs, and log borrow/lent histories in a single visual interface without sacrificing data privacy.

---

## 🔒 Privacy-First Design

Your financial data is personal, and Moyeniz respects that. The app is built on a **Zero-Server Architecture**:
* **Local Storage Cache**: All portfolio data, configurations, and transaction logs are processed and saved solely inside your browser's local storage.
* **No Server Connections**: Moyeniz makes no network calls to store or sync your data. It runs entirely in your sandbox environment.
* **Full Data Ownership**: You can export, restore, or completely wipe your data at any time.

---

## 🚀 Features

### 1. Unified Dashboard
* **Dynamic Asset Allocation Doughnut Chart**: Interactive chart representing the breakdown of your portfolio across stocks, mutual funds, gold, fixed deposits, and other assets.
* **Profit & Loss Metrics**: Instantly calculate current asset valuation against cost basis.
* **Net Worth Calculator**: Evaluates your true balance using the formula:
  $$\text{Net Worth} = \text{Current Assets Value} + \text{Total Lent} - \text{Total Liabilities} - \text{Total Borrowed}$$

### 2. Assets & Investments Tracker
* Add, edit, delete, and filter assets: *Indian Stocks, US Stocks, Mutual Funds, Fixed Deposits, Gold, Bonds, EPFO, and Savings Accounts*.
* Search and categorize items in real-time.

### 3. Liabilities & EMI Ledger
* Track home, car, education, personal, or custom loans.
* View progress bar visuals showing remaining tenure against the total repayment schedule.
* **Smart Repayment Trigger**: Increment paid EMIs via a `+1 Paid` button to instantly recalculate reduced outstanding balances and remaining tenure.
* Keep track of last-paid EMI timestamps.

### 4. Borrow & Lent ledger (Cashflow)
* Manage personal informal cash flows: track what friends or family owe you (Lent) versus what you owe them (Borrowed).
* Supports **partial payment/collection tracking** with comments and dates.
* Collapsible drawer history logs showing previous payments.
* Instantly clear transactions using the **Mark as Paid** action.

### 5. Setup & Data Control
* **Flexible Initialization**: Start on a clean slate, load rich sample data, or drag-and-drop your `moyeniz.json` backup directly into the file dropper.
* **Backup Exports**: Export your entire asset base and debt history to a `moyeniz.json` file for offline storage and restoration.
* **Cache Management**: Instantly clear all browser cached data with a secure wipe button in the settings menu.

---

## ☁️ Deploy to Vercel

Moyeniz is 100% static and zero-dependency, ready for 1-click deployment on [Vercel](https://vercel.com).

### Option A: Import via Vercel Dashboard (Recommended)
1. Push your repository to GitHub / GitLab / Bitbucket.
2. Go to [vercel.com/new](https://vercel.com/new) and import your repository.
3. Keep default settings (Framework Preset: **Other**) and click **Deploy**.

### Option B: Deploy using Vercel CLI
1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```
2. Run in the root directory:
   ```bash
   vercel
   ```

---

## 🔄 Google Account & Automatic Periodic Sync

Moyeniz supports seamless cloud synchronization using Google Drive's hidden **App Data Folder** (`drive.appdata` scope).

* **100% Private**: Syncs directly between your browser and your private Google Drive account. No intermediate database or third-party server.
* **Periodic Auto-Sync**: Automatically synchronizes data every 5, 15, 30, or 60 minutes, or debounced on every change.
* **Custom Google OAuth Client ID**: If hosting on a custom Vercel domain (`your-app.vercel.app`), simply create an OAuth 2.0 Web Client ID in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) with your Vercel URL added under **Authorized JavaScript origins**, and enter your Client ID under **Settings > Custom Google OAuth Client ID**.

---

## 🛠️ How to Run Locally

Since Moyeniz contains no external compilation dependencies, you can launch it using any lightweight static web server.

### Using Node.js (npx)
```bash
npx serve .
```
or
```bash
npx http-server -p 8000 -a 127.0.0.1
```

### Using Python (Quickest)
```bash
python -m http.server 8000 --bind 127.0.0.1
```
Open `http://127.0.0.1:8000/` in your browser.

---

