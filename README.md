# 🚀 DayTask — Daily Task Tracker & High Alert Reminder Engine

A modern, fast, and fully responsive **Daily Task Tracker** built with pure **HTML5, CSS3, and Vanilla JavaScript**. Designed for personal daily task management, dynamic deadline tracking, custom high-alert notification thresholds, and seamless mobile use.

---

## ✨ Features

### 1. 📅 Day-by-Day Task Management & History
- **Selected Date View**: Manage tasks day-by-day with full date navigation (`<` Previous, `Today`, `>` Next, Date Picker).
- **Interactive 7-Day Week Strip**: Quick-jump between days of the week with live progress dots.
- **Accurate Date-of-Completion Records**: Tasks completed on a given date (e.g. created Aug 13th, completed Aug 17th) are recorded and displayed under **that specific completion date's history**.

### 2. 🚨 End Date & Custom High Alert Reminders
- **Submission (End) Date Tracking**: Assign an End Date (Due Date) to any task.
- **Custom Manual Alert Threshold**: Set your own alert window (`1`, `2`, `3`, `4`, `5`... days before the End Date).
- **Standardized Badge Pattern**:
  - **Before Alert**: `📅 Due Aug 17 · Alert on Aug 15 (4 days left)`
  - **High Alert Active**: `🔥 HIGH ALERT! Due Aug 17 (2 days left ≤ 2d alert)`
  - **Submission Day**: `🔴 PRESENT DAY ALERT! Due Today (Aug 17)`
  - **Overdue**: `🚨 OVERDUE! Submission was Aug 17 (1d overdue)`

### 3. ⚡ Dynamic Priority Escalation
- **Auto-Escalate Mode**: Tasks automatically escalate to **URGENT** priority when they enter your custom High Alert threshold window.

### 4. 📱 100% Mobile Responsive Design
- **Touch-Optimized UI**: Fully responsive layout tailored for mobile phones (iOS Safari & Android Chrome) and tablets.
- **Mobile Touch Targets**: Large 40px+ touch buttons, smooth swipeable week strip, and auto-wrapping metadata badges.
- **No Page Zooming**: Input fields configured with `16px` font-size on mobile to prevent iOS Safari auto-zoom issues.

### 5. 🔄 Live Reactive Auto-Refresh (Zero Hard Refreshes Needed)
- **Instant UI Updates**: Adding, checking, editing, extending, or deleting tasks updates the view immediately.
- **Tab Focus Auto-Sync**: Switching tabs or focusing windows automatically re-calculates task urgency and progress bars without manual page reloads (`Cmd+R` / `F5`).
- **Cross-Tab Synchronization**: Data auto-syncs across multiple open tabs.

### 6. 🎨 Personalization & Utilities
- **Dark & Light Mode**: Toggle themes with automatic local persistence.
- **Quick Deadline Extension**: Extend deadlines (+1 Day, +2 Days, +3 Days, +1 Week, or custom date picker) with a single tap.
- **Confetti Celebration**: Triggers celebratory confetti when all daily tasks are completed.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5, Vanilla CSS3 (Custom CSS variables), Vanilla JavaScript (ES6+)
- **Data Persistence**: `localStorage` (100% client-side, instant, zero backend/database dependencies)
- **Icons**: Clean inline SVG icons

---

## 🚀 How to Run Locally

### Option 1: Python HTTP Server (Recommended)
```bash
# Navigate to the project directory
cd /path/to/taskanalyser

# Launch Python HTTP server on port 8000
python3 -m http.server 8000
```
Open **[http://localhost:8000](http://localhost:8000)** in your desktop or mobile browser.

### Option 2: Open Directly
Simply double-click [`index.html`](file:///Users/pranavsharma/Documents/Projects/personal_project/taskanalyser/index.html) to open it in any web browser.

---

## 📁 Project Structure

```
taskanalyser/
├── index.html        # Main HTML layout & modal structures
├── css/
│   └── styles.css    # Design system, CSS variables & mobile media queries
├── js/
│   └── app.js        # Core application logic, task engine & reactive event loops
└── README.md         # Documentation & guide
```

---

## 📱 Mobile Usage Tips
- **Bookmark / Add to Home Screen**: Save `http://localhost:8000` to your iOS or Android home screen for full-screen app experience.
- **Week Strip Swipe**: Swipe horizontally on the 7-day week strip to switch dates effortlessly.
- **Quick Extend**: Tap the calendar extension icon (`📅+`) on any pending task card to postpone deadlines by +1d, +2d, +3d, or +1w.
