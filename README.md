# 🚀 DayTask — Daily Task Tracker & High Alert Reminder Engine

A modern, fast, and fully responsive **Daily Task Tracker** built with pure **HTML5, CSS3, Vanilla JavaScript** and a **zero-dependency Node.js sync server**. Designed for personal daily task management, dynamic deadline tracking, custom high-alert notification thresholds, and seamless mobile use.

---

## ✨ Features

### 1. 📅 Day-by-Day Task Management & History
- **Selected Date View**: Manage tasks day-by-day with full date navigation (`<` Previous, `Today`, `>` Next, Date Picker).
- **Interactive 7-Day Week Strip**: Quick-jump between days of the week with live progress dots.
- **Accurate Date-of-Completion Records**: Tasks completed on a given date are recorded and displayed under **that specific completion date's history**.
- **Consistent Calendar Dates**: Tasks are always stored under their calendar date (`YYYY-MM-DD`) so they appear on the exact day you created them on every device.

### 2. 📲 Cross-Device Cloud Sync (Phone ↔ Laptop ↔ Tablet)
- **One shared task list everywhere**: Add a task on your phone, open your laptop — it's there. No more per-device copies.
- **Powered by `server.js`**: A tiny, dependency-free Node server stores all data in a single `data.json` file and merges changes from every device safely.
- **Conflict-safe merging**: If two devices edit the same task, the newest change wins. Deleting a task on one device removes it on all devices.
- **Offline-friendly**: When the server is unreachable, your tasks are still saved on the device and sync automatically once you reconnect.
- **Live sync status**: The footer shows `✓ Cloud synced`, `↻ Syncing…` or `⚠ Offline` so you always know the state.

### 3. 🚨 End Date & Custom High Alert Reminders
- **Submission (End) Date Tracking**: Assign an End Date (Due Date) to any task.
- **Custom Manual Alert Threshold**: Set your own alert window (`1`, `2`, `3`, `4`, `5`... days before the End Date).
- **Standardized Badge Pattern**:
  - **Before Alert**: `📅 Due Aug 17 · Alert on Aug 15 (4 days left)`
  - **High Alert Active**: `🔥 HIGH ALERT! Due Aug 17 (2 days left ≤ 2d alert)`
  - **Submission Day**: `🔴 PRESENT DAY ALERT! Due Today (Aug 17)`
  - **Overdue**: `🚨 OVERDUE! Submission was Aug 17 (1d overdue)`
- **Alerts work for all upcoming days**: A task enters its high-alert window the configured number of days before its due date, every day until due.
- **Native push-style notifications**: Tap the 🔔 button to enable browser notifications. While a task is inside its alert window you'll get a notification once per day per task.

### 4. ⚡ Dynamic Priority Escalation
- **Auto-Escalate Mode**: Tasks automatically escalate to **URGENT** priority when they enter your custom High Alert threshold window.

### 5. 📱 100% Mobile Responsive Design
- **Touch-Optimized UI**: Fully responsive layout tailored for mobile phones (iOS Safari & Android Chrome) and tablets.
- **Mobile Touch Targets**: Large 40px+ touch buttons, smooth swipeable week strip, and auto-wrapping metadata badges.
- **No Page Zooming**: Input fields configured with `16px` font-size on mobile to prevent iOS Safari auto-zoom issues.

### 6. 🔄 Live Reactive Auto-Refresh (Zero Hard Refreshes Needed)
- **Instant UI Updates**: Adding, checking, editing, extending, or deleting tasks updates the view immediately.
- **Tab Focus Auto-Sync**: Switching tabs or focusing windows automatically re-calculates task urgency and progress bars without manual page reloads.
- **Cross-Tab Synchronization**: Data auto-syncs across multiple open tabs.

### 7. 🎨 Personalization & Utilities
- **Dark & Light Mode**: Toggle themes with automatic local persistence.
- **Quick Deadline Extension**: Extend deadlines (+1 Day, +2 Days, +3 Days, +1 Week, or custom date picker) with a single tap.
- **Confetti Celebration**: Triggers celebratory confetti when all daily tasks are completed.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom CSS variables), Vanilla JavaScript (ES6+)
- **Backend / Sync**: Node.js (built-in modules only — zero npm dependencies)
- **Data Persistence**: `data.json` on the server + `localStorage` cache on each device (works offline)

---

## 🚀 How to Run (Phone + Laptop Together)

### 1. Start the sync server on your computer
```bash
cd /path/to/taskanalyser
node server.js
```

You'll see the addresses to open:

```
  Local:   http://localhost:3000
  Network: http://192.168.x.x:3000   (open this on your phone)
```

### 2. Open the app on both devices
- **Laptop**: open `http://localhost:3000`
- **Phone**: open the **Network** address shown above (make sure the phone is on the same Wi-Fi)

Add a task on either device and it appears on the other within a second.

> Custom port: `PORT=8080 node server.js`

> **Tip**: If a task ever appears under the wrong date, make sure the clock and timezone are correct on all devices — dates are stored per calendar day.

### 3. (Optional) Enable alerts
Tap the 🔔 icon to allow notifications, then add a due date + alert days to a task. While the task is within its alert window you'll get a notification once per day.

---

## ☁️ Deploying to the Cloud (access from anywhere)

The project is a standard Node app, so you can deploy it to any Node host (Render, Railway, Fly.io, a VPS, etc.):

1. Push the project to a GitHub repository.
2. Create a new service on your host with **Build command**: `npm install` (no deps) and **Start command**: `npm start` (or `node server.js`).
3. Open the host-provided URL from both your laptop and phone — data syncs from anywhere.

> Note: on free-tier hosts with an ephemeral disk, `data.json` is reset when the service restarts. For permanent cloud storage, deploy on a host with a persistent disk or VPS.

---

## 📁 Project Structure

```
taskanalyser/
├── index.html        # Main HTML layout & modal structures
├── server.js         # Zero-dependency Node.js sync server + static file server
├── package.json      # npm scripts (npm start)
├── data.json         # Created automatically — your synced task data (gitignored)
├── css/
│   └── styles.css    # Design system, CSS variables & mobile media queries
├── js/
│   └── app.js        # Core application logic, task engine & sync engine
└── README.md         # Documentation & guide
```

---

## 📱 Mobile Usage Tips
- **Add to Home Screen**: On iOS: Share → Add to Home Screen. On Android: Menu → Add to Home Screen. Opens full-screen like a native app.
- **Week Strip Swipe**: Swipe horizontally on the 7-day week strip to switch dates effortlessly.
- **Quick Extend**: Tap the calendar extension icon (`📅+`) on any pending task card to postpone deadlines by +1d, +2d, +3d, or +1w.
