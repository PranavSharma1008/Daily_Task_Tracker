/**
 * DayTask — Modern Daily Task Tracker
 * Complete Client-Side Application Logic with LocalStorage Persistence
 */

(function () {
    'use strict';

    // ==========================================
    // DATE HELPERS (STRICT HOISTING FIX)
    // ==========================================
    function toISODateString(date) {
        if (!date || !(date instanceof Date) || isNaN(date)) return new Date().toISOString().split('T')[0];
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseISODateString(isoStr) {
        if (!isoStr || typeof isoStr !== 'string' || !isoStr.includes('-')) {
            return new Date();
        }
        const parts = isoStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
            return new Date();
        }
        return new Date(year, month, day);
    }

    function isSameDay(d1, d2) {
        if (!d1 || !d2) return false;
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    }

    // ==========================================
    // STATE & CONSTANTS
    // ==========================================
    const STORAGE_KEY_DATA = 'daytask_data';
    const STORAGE_KEY_THEME = 'daytask_theme';
    const STORAGE_KEY_SELECTED_DATE = 'daytask_selected_date';

    // Clear any existing PIN lock permanently
    localStorage.removeItem('daytask_pin');

    const savedSelectedDate = localStorage.getItem(STORAGE_KEY_SELECTED_DATE);
    let currentDate = savedSelectedDate ? parseISODateString(savedSelectedDate) : new Date(); // The selected date
    let activeFilter = 'all'; // 'all' | 'pending' | 'completed'
    let searchQuery = '';
    let draggedTaskId = null;

    // DOM Elements
    const elements = {
        themeToggleBtn: document.getElementById('theme-toggle'),
        headerTodayDisplay: document.getElementById('header-today-display'),
        currentDateHeading: document.getElementById('current-date-heading'),
        
        btnPrevDay: document.getElementById('btn-prev-day'),
        btnNextDay: document.getElementById('btn-next-day'),
        btnGoToday: document.getElementById('btn-go-today'),
        btnDateDisplay: document.getElementById('btn-date-display'),
        datePickerInput: document.getElementById('date-picker-input'),
        displayDayName: document.getElementById('display-day-name'),
        displayFullDate: document.getElementById('display-full-date'),
        weekStripContainer: document.getElementById('week-strip-container'),

        dashMotivation: document.getElementById('dash-motivation'),
        dashPercentageBadge: document.getElementById('dash-percentage-badge'),
        progressFill: document.getElementById('progress-fill'),
        progressText: document.getElementById('progress-text'),
        progressStatusLabel: document.getElementById('progress-status-label'),
        countTotal: document.getElementById('count-total'),
        countPending: document.getElementById('count-pending'),
        countCompleted: document.getElementById('count-completed'),

        addTaskForm: document.getElementById('add-task-form'),
        taskTitleInput: document.getElementById('task-title-input'),
        taskPrioritySelect: document.getElementById('task-priority-select'),
        taskDueDateInput: document.getElementById('task-duedate-input'),
        taskAlertDaysInput: document.getElementById('task-alertdays-input'),
        taskTimeInput: document.getElementById('task-time-input'),
        taskCategorySelect: document.getElementById('task-category-select'),

        taskSearchInput: document.getElementById('task-search-input'),
        filterTabs: document.getElementById('filter-tabs'),

        pendingTaskList: document.getElementById('pending-task-list'),
        completedTaskList: document.getElementById('completed-task-list'),
        pendingCountBadge: document.getElementById('pending-count-badge'),
        completedCountBadge: document.getElementById('completed-count-badge'),
        pendingEmptyState: document.getElementById('pending-empty-state'),
        completedEmptyState: document.getElementById('completed-empty-state'),

        // Urgent Banner & Individual Red Alert Cards
        urgentDeadlineBanner: document.getElementById('urgent-deadline-banner'),
        bannerTitle: document.getElementById('banner-title'),
        urgentCardsContainer: document.getElementById('urgent-cards-container'),

        // Edit Modal
        editModal: document.getElementById('edit-modal'),
        editTaskForm: document.getElementById('edit-task-form'),
        editTaskId: document.getElementById('edit-task-id'),
        editTaskTitle: document.getElementById('edit-task-title'),
        editTaskPriority: document.getElementById('edit-task-priority'),
        editTaskDueDate: document.getElementById('edit-task-duedate'),
        editTaskAlertDays: document.getElementById('edit-task-alertdays'),
        editTaskTime: document.getElementById('edit-task-time'),
        editTaskCategory: document.getElementById('edit-task-category'),
        btnCloseEditModal: document.getElementById('btn-close-edit-modal'),
        btnCancelEdit: document.getElementById('btn-cancel-edit'),

        // Extend Modal
        extendModal: document.getElementById('extend-modal'),
        btnCloseExtendModal: document.getElementById('btn-close-extend-modal'),
        btnCancelExtend: document.getElementById('btn-cancel-extend'),
        btnSaveExtend: document.getElementById('btn-save-extend'),
        extendTaskTitleDisplay: document.getElementById('extend-task-title-display'),
        extendCurrentDateDisplay: document.getElementById('extend-current-date-display'),
        extendCustomDate: document.getElementById('extend-custom-date'),

        toastContainer: document.getElementById('toast-container'),
        confettiCanvas: document.getElementById('confetti-canvas')
    };

    // ==========================================
    // LOCAL STORAGE MANAGER
    // ==========================================
    function loadAllData() {
        try {
            const json = localStorage.getItem(STORAGE_KEY_DATA);
            return json ? JSON.parse(json) : {};
        } catch (e) {
            console.error('Failed to parse localStorage data:', e);
            return {};
        }
    }

    function saveAllData(data) {
        try {
            localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
            showToast('Failed to save tasks locally', 'error');
        }
    }

    function getTasksForDate(dateStr) {
        const allData = loadAllData();
        const pendingForDate = [];
        const completedForDate = [];

        Object.keys(allData).forEach(dateKey => {
            const tasks = allData[dateKey];
            tasks.forEach(task => {
                if (!task.completed) {
                    // Tasks ONLY show in the main task list for the exact creation date
                    if (dateKey === dateStr) {
                        if (!pendingForDate.some(t => t.id === task.id)) {
                            pendingForDate.push(task);
                        }
                    }
                } else {
                    // Completed task: belongs to the date it was completed on!
                    const taskCompletedDate = task.completedDate || dateKey;
                    if (taskCompletedDate === dateStr) {
                        if (!completedForDate.some(t => t.id === task.id)) {
                            completedForDate.push(task);
                        }
                    }
                }
            });
        });

        return [...pendingForDate, ...completedForDate];
    }

    function saveTasksForDate(dateStr, tasks) {
        const data = loadAllData();
        data[dateStr] = tasks;
        saveAllData(data);
    }

    // ==========================================
    // BACKUP & VAULT MANAGERS
    // ==========================================
    function exportDataBackup() {
        const allData = loadAllData();
        const exportObject = {
            appName: 'DayTask',
            version: '2.0',
            exportedAt: new Date().toISOString(),
            theme: localStorage.getItem(STORAGE_KEY_THEME) || 'light',
            data: allData
        };

        const jsonString = JSON.stringify(exportObject, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `daytask_backup_${toISODateString(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Backup exported successfully!', 'success');
    }

    function importDataBackup(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const parsed = JSON.parse(e.target.result);
                if (parsed && parsed.data && typeof parsed.data === 'object') {
                    saveAllData(parsed.data);
                    if (parsed.theme) {
                        document.documentElement.setAttribute('data-theme', parsed.theme);
                        localStorage.setItem(STORAGE_KEY_THEME, parsed.theme);
                    }
                    renderAll();
                    closeBackupModal();
                    showToast('Data backup restored successfully!', 'success');
                } else {
                    showToast('Invalid backup file format', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Failed to parse backup file', 'error');
            }
        };
        reader.readAsText(file);
    }

    // ==========================================
    // SECURITY & PASSCODE LOCK SYSTEM
    // ==========================================
    function openBackupModal() {
        elements.backupModal.classList.remove('hidden');
    }

    function closeBackupModal() {
        elements.backupModal.classList.add('hidden');
    }

    // ==========================================
    // DATE HELPERS
    // ==========================================
    function toISODateString(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseISODateString(isoStr) {
        if (!isoStr || typeof isoStr !== 'string' || !isoStr.includes('-')) {
            return new Date();
        }
        const parts = isoStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        if (isNaN(year) || isNaN(month) || isNaN(day)) {
            return new Date();
        }
        return new Date(year, month, day);
    }

    function isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    }

    function formatTimeDisplay(timeStr) {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const formattedHour = h % 12 || 12;
        return `${formattedHour}:${minutes} ${ampm}`;
    }

    // ==========================================
    // DYNAMIC PRIORITY & URGENCY CALCULATOR
    // ==========================================
    function computeUrgencyAndPriority(dueDateStr, priorityMode, alertDaysThreshold = 2) {
        const threshold = parseInt(alertDaysThreshold != null ? alertDaysThreshold : 2, 10);

        if (!dueDateStr) {
            const fallbackPriority = (priorityMode === 'auto' || !priorityMode) ? 'medium' : priorityMode;
            return {
                priority: fallbackPriority,
                duePillClass: '',
                dueLabel: '',
                diffDays: null,
                isUrgent: false,
                threshold
            };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const due = parseISODateString(dueDateStr);
        due.setHours(0, 0, 0, 0);

        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Format dates for display
        const dueFormatted = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const alertStartDate = new Date(due.getTime() - (threshold * 24 * 60 * 60 * 1000));
        const alertStartFormatted = alertStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        let effectivePriority = priorityMode;
        let duePillClass = 'normal';
        let dueLabel = '';
        let isUrgent = false;

        if (diffDays < 0) {
            // Overdue
            const absDays = Math.abs(diffDays);
            dueLabel = `🚨 OVERDUE! Submission was ${dueFormatted} (${absDays}d overdue)`;
            duePillClass = 'overdue';
            if (priorityMode === 'auto' || !priorityMode) effectivePriority = 'urgent';
            isUrgent = true;
        } else if (diffDays === 0) {
            // Due Today / Submission Day
            dueLabel = `🔴 PRESENT DAY ALERT! Due Today (${dueFormatted})`;
            duePillClass = 'today';
            if (priorityMode === 'auto' || !priorityMode) effectivePriority = 'urgent';
            isUrgent = true;
        } else if (diffDays <= threshold) {
            // Within user-configured custom High Alert threshold!
            dueLabel = `🔥 HIGH ALERT! Due ${dueFormatted} (${diffDays} day${diffDays > 1 ? 's' : ''} left ≤ ${threshold}d alert)`;
            duePillClass = 'soon';
            if (priorityMode === 'auto' || !priorityMode) effectivePriority = 'urgent';
            isUrgent = true;
        } else {
            // Outside alert threshold
            dueLabel = `📅 Due ${dueFormatted} · Alert on ${alertStartFormatted} (${diffDays} days left)`;
            duePillClass = 'normal';
            if (priorityMode === 'auto' || !priorityMode) effectivePriority = 'medium';
        }

        return {
            priority: effectivePriority,
            duePillClass,
            dueLabel,
            diffDays,
            isUrgent,
            threshold,
            dueFormatted,
            alertStartFormatted
        };
    }

    function checkUrgentTaskDeadlines() {
        const allData = loadAllData();
        const urgentTasks = [];

        Object.keys(allData).forEach(dateKey => {
            const tasks = allData[dateKey];
            tasks.forEach(task => {
                if (!task.completed && task.dueDate) {
                    const info = computeUrgencyAndPriority(task.dueDate, task.priority || 'auto', task.alertDays != null ? task.alertDays : 2);
                    if (info.isUrgent) {
                        urgentTasks.push({ ...task, dueInfo: info, taskDateStr: dateKey });
                    }
                }
            });
        });

        if (urgentTasks.length > 0) {
            elements.urgentDeadlineBanner.classList.remove('hidden');

            const presentDayTasks = urgentTasks.filter(t => t.dueInfo.diffDays === 0);
            if (presentDayTasks.length > 0) {
                elements.bannerTitle.textContent = `🚨 High Alert: ${urgentTasks.length} Urgent Task${urgentTasks.length > 1 ? 's' : ''} Require Attention!`;
            } else {
                elements.bannerTitle.textContent = `🚨 High Alert: ${urgentTasks.length} Task${urgentTasks.length > 1 ? 's' : ''} Reached Your Urgent Threshold!`;
            }

            elements.urgentCardsContainer.innerHTML = '';

            urgentTasks.forEach(task => {
                const card = document.createElement('div');
                card.className = `urgent-red-card ${task.dueInfo.duePillClass}`;
                card.dataset.id = task.id;

                const icon = task.dueInfo.diffDays === 0 ? '🔴' : (task.dueInfo.diffDays < 0 ? '🚨' : '🔥');

                card.innerHTML = `
                    <div class="urgent-red-left">
                        <span class="urgent-red-icon">${icon}</span>
                        <div class="urgent-red-content">
                            <h4 class="urgent-red-title">${escapeHTML(task.title)}</h4>
                            <span class="urgent-red-status ${task.dueInfo.duePillClass}">${escapeHTML(task.dueInfo.dueLabel)}</span>
                        </div>
                    </div>
                    <div class="urgent-red-actions">
                        <button class="btn-urgent-action complete" title="Mark Done">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            <span>Mark Done</span>
                        </button>
                    </div>
                `;

                // Quick Complete Action
                const completeBtn = card.querySelector('.btn-urgent-action.complete');
                completeBtn.addEventListener('click', () => {
                    toggleTaskComplete(task.id);
                });

                elements.urgentCardsContainer.appendChild(card);
            });
        } else {
            elements.urgentDeadlineBanner.classList.add('hidden');
            elements.urgentCardsContainer.innerHTML = '';
        }
    }

    // ==========================================
    // THEME MANAGER
    // ==========================================
    function initTheme() {
        const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem(STORAGE_KEY_THEME, newTheme);
        showToast(`Switched to ${newTheme} mode`);
    }

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>';
        if (type === 'success') {
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        }

        toast.innerHTML = `${iconSvg} <span>${escapeHTML(message)}</span>`;
        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 2600);
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // ==========================================
    // APP INITIALIZATION & CORE RENDERING
    // ==========================================
    function init() {
        initTheme();
        bindEvents();
        renderAll();
    }

    function renderAll() {
        const dateStr = toISODateString(currentDate);
        try {
            localStorage.setItem(STORAGE_KEY_SELECTED_DATE, dateStr);
        } catch (e) {}

        const tasks = getTasksForDate(dateStr);

        renderHeaderDate();
        renderWeekStrip();
        renderStats(tasks);
        renderTaskLists(tasks);
        checkUrgentTaskDeadlines();
    }

    function renderHeaderDate() {
        const today = new Date();
        const isToday = isSameDay(currentDate, today);

        // Header today pill
        if (isToday) {
            elements.currentDateHeading.textContent = 'Today';
        } else {
            elements.currentDateHeading.textContent = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        // Date navigator display - always display true weekday name (e.g. Thursday, Friday)
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayNameStr = dayNames[currentDate.getDay()];
        elements.displayDayName.textContent = isToday ? `${dayNameStr} (Today)` : dayNameStr;

        elements.displayFullDate.textContent = currentDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        // Set date picker value
        elements.datePickerInput.value = toISODateString(currentDate);
    }

    function renderWeekStrip() {
        elements.weekStripContainer.innerHTML = '';

        // Render 7 days around currentDate (-3 days to +3 days)
        for (let i = -3; i <= 3; i++) {
            const day = new Date(currentDate);
            day.setDate(currentDate.getDate() + i);

            const dayStr = toISODateString(day);
            const dayTasks = getTasksForDate(dayStr);
            const isSelected = isSameDay(day, currentDate);
            const isToday = isSameDay(day, new Date());

            const dayNameShort = day.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = day.getDate();

            const pill = document.createElement('div');
            pill.className = `week-day-pill ${isSelected ? 'active' : ''}`;
            
            // Build task indicator dots
            let dotsHtml = '';
            if (dayTasks.length > 0) {
                const total = dayTasks.length;
                const completed = dayTasks.filter(t => t.completed).length;
                const isAllDone = total > 0 && completed === total;

                dotsHtml = `<div class="day-dots">
                    <span class="dot ${isAllDone ? 'completed-dot' : ''}"></span>
                </div>`;
            } else {
                dotsHtml = `<div class="day-dots"></div>`;
            }

            pill.innerHTML = `
                <span class="day-name">${isToday ? 'TODAY' : dayNameShort}</span>
                <span class="day-number">${dayNum}</span>
                ${dotsHtml}
            `;

            pill.addEventListener('click', () => {
                currentDate = new Date(day);
                renderAll();
            });

            elements.weekStripContainer.appendChild(pill);
        }
    }

    function renderStats(tasks) {
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        elements.countTotal.textContent = total;
        elements.countPending.textContent = pending;
        elements.countCompleted.textContent = completed;

        elements.progressFill.style.width = `${percentage}%`;
        elements.progressText.textContent = `${completed} / ${total} Tasks Completed`;
        elements.progressStatusLabel.textContent = `${percentage}% Complete`;
        elements.dashPercentageBadge.textContent = `${percentage}%`;

        // Motivation message logic
        let motivationStr = "Add your tasks above to organize your day!";
        if (total > 0) {
            if (percentage === 100) {
                motivationStr = "🎉 Phenomenal job! You completed all your tasks today!";
            } else if (percentage >= 75) {
                motivationStr = "🚀 Almost there! Keep pushing to finish the remaining tasks!";
            } else if (percentage >= 50) {
                motivationStr = "💪 You're halfway through! Keep up the great momentum!";
            } else if (percentage > 0) {
                motivationStr = "🌱 Good start! Focus on your next priority item.";
            } else {
                motivationStr = "🎯 Ready to conquer your day? Let's start checking tasks off!";
            }
        }
        elements.dashMotivation.textContent = motivationStr;
    }

    function renderTaskLists(tasks) {
        elements.pendingTaskList.innerHTML = '';
        elements.completedTaskList.innerHTML = '';

        let filtered = tasks;

        // Apply Search Filter
        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(t => 
                t.title.toLowerCase().includes(q) || 
                (t.category && t.category.toLowerCase().includes(q))
            );
        }

        const pendingTasks = filtered.filter(t => !t.completed);
        const completedTasks = filtered.filter(t => t.completed);

        elements.pendingCountBadge.textContent = pendingTasks.length;
        elements.completedCountBadge.textContent = completedTasks.length;

        // Tab Filter Logic
        if (activeFilter === 'completed') {
            elements.pendingTaskList.parentElement.classList.add('hidden');
            elements.completedTaskList.parentElement.classList.remove('hidden');
        } else if (activeFilter === 'pending') {
            elements.pendingTaskList.parentElement.classList.remove('hidden');
            elements.completedTaskList.parentElement.classList.add('hidden');
        } else {
            elements.pendingTaskList.parentElement.classList.remove('hidden');
            elements.completedTaskList.parentElement.classList.remove('hidden');
        }

        // Render Pending
        if (pendingTasks.length === 0) {
            elements.pendingEmptyState.classList.remove('hidden');
        } else {
            elements.pendingEmptyState.classList.add('hidden');
            pendingTasks.forEach(task => {
                elements.pendingTaskList.appendChild(createTaskCardElement(task));
            });
        }

        // Render Completed
        if (completedTasks.length === 0) {
            elements.completedEmptyState.classList.remove('hidden');
        } else {
            elements.completedEmptyState.classList.add('hidden');
            completedTasks.forEach(task => {
                elements.completedTaskList.appendChild(createTaskCardElement(task));
            });
        }

        initDragAndDrop();
    }

    function createTaskCardElement(task) {
        const card = document.createElement('div');
        card.className = `task-card ${task.completed ? 'completed' : ''}`;
        card.dataset.id = task.id;
        card.setAttribute('draggable', 'true');

        const urgencyInfo = computeUrgencyAndPriority(task.dueDate, task.priority || 'auto', task.alertDays != null ? task.alertDays : 2);
        const effectivePriority = urgencyInfo.priority;
        const formattedTime = task.time ? formatTimeDisplay(task.time) : '';

        card.innerHTML = `
            <div class="task-left">
                <span class="drag-handle" title="Drag to reorder">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                </span>
                
                <div class="task-checkbox-wrapper">
                    <input type="checkbox" ${task.completed ? 'checked' : ''} aria-label="Mark task completed">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>

                <div class="task-content">
                    <span class="task-title">${escapeHTML(task.title)}</span>
                    <div class="task-meta-row">
                        <span class="priority-pill ${effectivePriority}">${effectivePriority} Priority</span>
                        ${urgencyInfo.dueLabel ? `
                            <span class="duedate-pill ${urgencyInfo.duePillClass}">
                                ${escapeHTML(urgencyInfo.dueLabel)}
                            </span>
                        ` : ''}
                        ${formattedTime ? `
                            <span class="meta-tag">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                ${formattedTime}
                            </span>
                        ` : ''}
                        ${task.category ? `
                            <span class="meta-tag">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
                                ${escapeHTML(task.category)}
                            </span>
                        ` : ''}
                        ${(task.completed && task.createdDate && task.createdDate !== (task.completedDate || toISODateString(currentDate))) ? `
                            <span class="meta-tag">
                                📅 Created ${escapeHTML(task.createdDate)}
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>

            <div class="task-actions">
                ${!task.completed ? `
                    <button class="btn-task-action extend" title="Extend Deadline" aria-label="Extend Deadline">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M12 14v4"/><path d="M10 16h4"/></svg>
                    </button>
                ` : ''}
                <button class="btn-task-action edit" title="Edit Task" aria-label="Edit Task">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="btn-task-action delete" title="Delete Task" aria-label="Delete Task">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `;

        // Checkbox Change Handler
        const checkbox = card.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => {
            toggleTaskComplete(task.id);
        });

        // Extend Button
        const extendBtn = card.querySelector('.btn-task-action.extend');
        if (extendBtn) {
            extendBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openExtendModal(task);
            });
        }

        // Edit Button
        const editBtn = card.querySelector('.btn-task-action.edit');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(task);
        });

        // Delete Button
        const deleteBtn = card.querySelector('.btn-task-action.delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTask(task.id);
        });

        return card;
    }

    // ==========================================
    // TASK CRUD OPERATIONS
    // ==========================================
    function addTask(title, priority, dueDate, alertDays, time, category) {
        if (!title || !title.trim()) return;

        const dateStr = toISODateString(currentDate);
        const allData = loadAllData();
        if (!allData[dateStr]) {
            allData[dateStr] = [];
        }

        const newTask = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            title: title.trim(),
            priority: priority || 'auto',
            dueDate: dueDate || '',
            alertDays: (alertDays !== null && alertDays !== undefined && alertDays !== '') ? parseInt(alertDays, 10) : 2,
            time: time || '',
            category: category || 'General',
            completed: false,
            createdDate: dateStr,
            createdAt: new Date().toISOString()
        };

        allData[dateStr].unshift(newTask);
        saveAllData(allData);

        // Ensure newly added pending tasks are immediately visible regardless of previous filter state
        activeFilter = 'all';
        searchQuery = '';
        if (elements.taskSearchInput) elements.taskSearchInput.value = '';
        if (elements.filterTabs) {
            elements.filterTabs.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            const allTab = elements.filterTabs.querySelector('[data-filter="all"]');
            if (allTab) allTab.classList.add('active');
        }

        renderAll();
        showToast('Task added successfully!', 'success');
    }

    function toggleTaskComplete(taskId) {
        const allData = loadAllData();
        let found = false;
        const currentActiveDateStr = toISODateString(currentDate);

        Object.keys(allData).forEach(dateKey => {
            const task = allData[dateKey].find(t => t.id === taskId);
            if (task) {
                found = true;
                task.completed = !task.completed;

                if (task.completed) {
                    task.completedDate = currentActiveDateStr;
                    task.completedAt = new Date().toISOString();
                    showToast(`Task completed! Recorded under ${currentActiveDateStr}`, 'success');
                } else {
                    delete task.completedDate;
                    delete task.completedAt;
                    showToast('Task re-opened as pending', 'info');
                }

                const total = allData[dateKey].length;
                const completed = allData[dateKey].filter(t => t.completed).length;

                if (task.completed && completed === total && total > 0) {
                    triggerConfetti();
                }
            }
        });

        if (found) {
            saveAllData(allData);
            renderAll();
        }
    }

    function deleteTask(taskId) {
        const cardEl = document.querySelector(`.task-card[data-id="${taskId}"]`);
        if (cardEl) {
            cardEl.classList.add('deleting');
        }

        setTimeout(() => {
            const allData = loadAllData();
            let deleted = false;

            Object.keys(allData).forEach(dateKey => {
                const originalLength = allData[dateKey].length;
                allData[dateKey] = allData[dateKey].filter(t => t.id !== taskId);
                if (allData[dateKey].length < originalLength) {
                    deleted = true;
                }
            });

            if (deleted) {
                saveAllData(allData);
                renderAll();
                showToast('Task deleted successfully');
            }
        }, 150);
    }

    function updateTask(taskId, newTitle, newPriority, newDueDate, newAlertDays, newTime, newCategory) {
        const allData = loadAllData();
        let updated = false;

        Object.keys(allData).forEach(dateKey => {
            const task = allData[dateKey].find(t => t.id === taskId);
            if (task) {
                task.title = newTitle.trim();
                task.priority = newPriority;
                task.dueDate = newDueDate;
                task.alertDays = newAlertDays != null ? parseInt(newAlertDays, 10) : 2;
                task.time = newTime;
                task.category = newCategory;
                updated = true;
            }
        });

        if (updated) {
            saveAllData(allData);
            renderAll();
            showToast('Task updated successfully');
        }
    }

    // ==========================================
    // DRAG AND DROP REORDERING
    // ==========================================
    function initDragAndDrop() {
        const cards = document.querySelectorAll('.task-card');
        const lists = [elements.pendingTaskList, elements.completedTaskList];

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                draggedTaskId = card.dataset.id;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                draggedTaskId = null;
            });
        });

        lists.forEach(list => {
            list.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const afterElement = getDragAfterElement(list, e.clientY);
                const draggingCard = document.querySelector('.task-card.dragging');
                if (draggingCard) {
                    if (afterElement == null) {
                        list.appendChild(draggingCard);
                    } else {
                        list.insertBefore(draggingCard, afterElement);
                    }
                }
            });

            list.addEventListener('drop', (e) => {
                e.preventDefault();
                saveCurrentDomOrder();
            });
        });
    }

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function saveCurrentDomOrder() {
        const dateStr = toISODateString(currentDate);
        const existingTasks = getTasksForDate(dateStr);
        const taskMap = new Map(existingTasks.map(t => [t.id, t]));

        const newOrder = [];
        const pendingDomCards = elements.pendingTaskList.querySelectorAll('.task-card');
        const completedDomCards = elements.completedTaskList.querySelectorAll('.task-card');

        pendingDomCards.forEach(card => {
            const task = taskMap.get(card.dataset.id);
            if (task) {
                task.completed = false;
                newOrder.push(task);
            }
        });

        completedDomCards.forEach(card => {
            const task = taskMap.get(card.dataset.id);
            if (task) {
                task.completed = true;
                newOrder.push(task);
            }
        });

        saveTasksForDate(dateStr, newOrder);
        renderAll();
    }

    // ==========================================
    // MODALS & EVENT HANDLERS
    // ==========================================
    let targetExtendTask = null;

    function openExtendModal(task) {
        targetExtendTask = task;
        elements.extendTaskTitleDisplay.textContent = `Task: "${task.title}"`;
        elements.extendCurrentDateDisplay.textContent = task.dueDate ? `Current End Date: ${task.dueDate}` : `Current End Date: Not set`;
        elements.extendCustomDate.value = task.dueDate || toISODateString(currentDate);

        const presetBtns = elements.extendModal.querySelectorAll('.btn-extend-preset');
        presetBtns.forEach(b => b.classList.remove('active'));

        elements.extendModal.classList.remove('hidden');
    }

    function closeExtendModal() {
        elements.extendModal.classList.add('hidden');
        targetExtendTask = null;
    }

    function extendTaskDueDate(newDueDate) {
        if (!targetExtendTask) return;
        const allData = loadAllData();
        let updated = false;

        Object.keys(allData).forEach(dateKey => {
            const task = allData[dateKey].find(t => t.id === targetExtendTask.id);
            if (task) {
                task.dueDate = newDueDate;
                updated = true;
            }
        });

        if (updated) {
            saveAllData(allData);
            renderAll();
            closeExtendModal();
            showToast(`Task deadline extended to ${newDueDate}`, 'success');
        }
    }

    function openEditModal(task) {
        elements.editTaskId.value = task.id;
        elements.editTaskTitle.value = task.title;
        elements.editTaskPriority.value = task.priority || 'auto';
        elements.editTaskDueDate.value = task.dueDate || '';
        elements.editTaskAlertDays.value = task.alertDays != null ? task.alertDays : 2;
        elements.editTaskTime.value = task.time || '';
        elements.editTaskCategory.value = task.category || 'General';

        elements.editModal.classList.remove('hidden');
        elements.editTaskTitle.focus();
    }

    function closeEditModal() {
        elements.editModal.classList.add('hidden');
    }

    function bindEvents() {
        // Theme toggle
        elements.themeToggleBtn.addEventListener('click', toggleTheme);

        // Date navigation
        elements.btnPrevDay.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() - 1);
            renderAll();
        });

        elements.btnNextDay.addEventListener('click', () => {
            currentDate.setDate(currentDate.getDate() + 1);
            renderAll();
        });

        elements.btnGoToday.addEventListener('click', () => {
            currentDate = new Date();
            renderAll();
            showToast('Jumped to Today');
        });

        // Date Picker Trigger
        elements.btnDateDisplay.addEventListener('click', () => {
            elements.datePickerInput.showPicker ? elements.datePickerInput.showPicker() : elements.datePickerInput.click();
        });

        elements.datePickerInput.addEventListener('change', (e) => {
            if (e.target.value) {
                currentDate = parseISODateString(e.target.value);
                renderAll();
            }
        });

        // Add Task Form Submission Handler
        const handleAddTaskSubmit = (e) => {
            if (e) e.preventDefault();
            const titleEl = document.getElementById('task-title-input');
            if (!titleEl || !titleEl.value.trim()) return;

            const title = titleEl.value;
            const priorityEl = document.getElementById('task-priority-select');
            const dueDateEl = document.getElementById('task-duedate-input');
            const alertDaysEl = document.getElementById('task-alertdays-input');
            const timeEl = document.getElementById('task-time-input');
            const categoryEl = document.getElementById('task-category-select');

            const priority = priorityEl ? priorityEl.value : 'auto';
            const dueDate = dueDateEl ? dueDateEl.value : '';
            const alertDays = alertDaysEl ? alertDaysEl.value : '2';
            const time = timeEl ? timeEl.value : '';
            const category = categoryEl ? categoryEl.value : 'General';

            addTask(title, priority, dueDate, alertDays, time, category);

            titleEl.value = '';
            if (dueDateEl) dueDateEl.value = '';
            if (timeEl) timeEl.value = '';
        };

        const formEl = document.getElementById('add-task-form');
        if (formEl) {
            formEl.addEventListener('submit', handleAddTaskSubmit);
        }

        const btnAddEl = document.getElementById('btn-add-task');
        if (btnAddEl) {
            btnAddEl.addEventListener('click', handleAddTaskSubmit);
        }

        // Urgent Banner Action Button
        elements.btnViewUrgent.addEventListener('click', () => {
            activeFilter = 'pending';
            elements.filterTabs.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            const pendingTab = elements.filterTabs.querySelector('[data-filter="pending"]');
            if (pendingTab) pendingTab.classList.add('active');
            renderAll();
            showToast('Filtered pending tasks with urgent deadlines');
        });

        // Search Input
        elements.taskSearchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            const tasks = getTasksForDate(toISODateString(currentDate));
            renderTaskLists(tasks);
        });

        // Filter Tabs
        elements.filterTabs.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                elements.filterTabs.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                activeFilter = e.target.dataset.filter;
                const tasks = getTasksForDate(toISODateString(currentDate));
                renderTaskLists(tasks);
            }
        });

        // Edit Modal Events
        elements.btnCloseEditModal.addEventListener('click', closeEditModal);
        elements.btnCancelEdit.addEventListener('click', closeEditModal);
        elements.editModal.addEventListener('click', (e) => {
            if (e.target === elements.editModal) closeEditModal();
        });

        elements.editTaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = elements.editTaskId.value;
            const title = elements.editTaskTitle.value;
            const priority = elements.editTaskPriority.value;
            const dueDate = elements.editTaskDueDate.value;
            const alertDays = elements.editTaskAlertDays.value;
            const time = elements.editTaskTime.value;
            const category = elements.editTaskCategory.value;

            updateTask(id, title, priority, dueDate, alertDays, time, category);
            closeEditModal();
        });

        // Extend Date Quick Modal Events
        elements.btnCloseExtendModal.addEventListener('click', closeExtendModal);
        elements.btnCancelExtend.addEventListener('click', closeExtendModal);
        elements.extendModal.addEventListener('click', (e) => {
            if (e.target === elements.extendModal) closeExtendModal();
        });

        const extendPresetBtns = elements.extendModal.querySelectorAll('.btn-extend-preset');
        extendPresetBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                extendPresetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const daysToAdd = parseInt(btn.dataset.days, 10);
                let baseDate = (targetExtendTask && targetExtendTask.dueDate && targetExtendTask.dueDate.includes('-')) 
                    ? parseISODateString(targetExtendTask.dueDate) 
                    : new Date(currentDate);
                
                baseDate.setDate(baseDate.getDate() + daysToAdd);
                elements.extendCustomDate.value = toISODateString(baseDate);
            });
        });

        elements.btnSaveExtend.addEventListener('click', (e) => {
            e.preventDefault();
            const selectedDate = elements.extendCustomDate.value;
            if (selectedDate) {
                extendTaskDueDate(selectedDate);
            } else {
                showToast('Please select or pick a valid date', 'error');
            }
        });

        // Tab Focus & Visibility Auto-Refresh Engine (Zero Hard Refreshes Needed!)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                renderAll();
            }
        });

        window.addEventListener('focus', () => {
            renderAll();
        });

        // Cross-Tab Storage Sync
        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY_DATA || e.key === STORAGE_KEY_THEME) {
                renderAll();
            }
        });

        // Live Urgency & Date Ticker (Auto-refreshes countdowns and alerts every 30 seconds)
        setInterval(() => {
            renderAll();
        }, 30000);

        // Global Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            const activeEl = document.activeElement;
            const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA';

            if (!isInput && !elements.editModal.classList.contains('hidden')) {
                if (e.key === 'Escape') closeEditModal();
                return;
            }

            if (!isInput && !elements.extendModal.classList.contains('hidden')) {
                if (e.key === 'Escape') closeExtendModal();
                return;
            }

            if (!isInput) {
                if (e.key === 'n' || e.key === 'N' || e.key === '/') {
                    e.preventDefault();
                    elements.taskTitleInput.focus();
                } else if (e.key === 'ArrowLeft') {
                    currentDate.setDate(currentDate.getDate() - 1);
                    renderAll();
                } else if (e.key === 'ArrowRight') {
                    currentDate.setDate(currentDate.getDate() + 1);
                    renderAll();
                }
            }
        });
    }

    // ==========================================
    // CONFETTI ANIMATION SYSTEM
    // ==========================================
    function triggerConfetti() {
        const canvas = elements.confettiCanvas;
        const ctx = canvas.getContext('2d');

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const pieces = [];
        const numberOfPieces = 100;
        const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9', '#818CF8'];

        for (let i = 0; i < numberOfPieces; i++) {
            pieces.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                speed: Math.random() * 3 + 2,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 10 - 5
            });
        }

        let animationFrame;
        const startTime = Date.now();

        function updateAndDraw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            pieces.forEach(p => {
                p.y += p.speed;
                p.rotation += p.rotationSpeed;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                ctx.restore();
            });

            if (Date.now() - startTime < 3000) {
                animationFrame = requestAnimationFrame(updateAndDraw);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animationFrame);
            }
        }

        updateAndDraw();
    }

    // Initialize application when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
