/**
 * DayTask — Modern Daily Task Tracker
 * Complete Client-Side Application Logic with LocalStorage Persistence & Cloud Sync
 */

(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory();
    } else {
        root.DayTask = factory();
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // ==========================================
    // DATE HELPERS (STRICT UTC & TIMEZONE SAFE)
    // ==========================================
    function toISODateString(date) {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
            date = new Date();
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseISODateString(isoStr) {
        if (!isoStr || typeof isoStr !== 'string') {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return d;
        }
        const trimmed = isoStr.trim();
        if (trimmed.includes('-')) {
            const parts = trimmed.split('-');
            if (parts.length === 3) {
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                    return new Date(year, month, day, 0, 0, 0, 0);
                }
            }
        }
        const fallback = new Date(trimmed);
        if (!isNaN(fallback.getTime())) {
            fallback.setHours(0, 0, 0, 0);
            return fallback;
        }
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function isSameDay(d1, d2) {
        if (!d1 || !d2 || !(d1 instanceof Date) || !(d2 instanceof Date) || isNaN(d1.getTime()) || isNaN(d2.getTime())) {
            return false;
        }
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    }

    function calendarDayDifference(baseDate, targetDate) {
        const b = baseDate instanceof Date ? baseDate : parseISODateString(baseDate);
        const t = targetDate instanceof Date ? targetDate : parseISODateString(targetDate);
        const utcBase = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
        const utcTarget = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
        return Math.round((utcTarget - utcBase) / (1000 * 60 * 60 * 24));
    }

    function formatTimeDisplay(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return '';
        const parts = timeStr.split(':');
        if (parts.length < 2) return '';
        const h = parseInt(parts[0], 10);
        const minutes = parts[1];
        if (isNaN(h)) return '';
        const ampm = h >= 12 ? 'PM' : 'AM';
        const formattedHour = h % 12 || 12;
        return `${formattedHour}:${minutes} ${ampm}`;
    }

    function escapeHTML(str) {
        if (str == null) return '';
        return String(str).replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // ==========================================
    // DYNAMIC PRIORITY & URGENCY CALCULATOR
    // ==========================================
    function computeUrgencyAndPriority(dueDateStr, priorityMode = 'auto', alertDaysThreshold = 2, referenceDate = null) {
        const parsedThreshold = parseInt(alertDaysThreshold != null && alertDaysThreshold !== '' ? alertDaysThreshold : 2, 10);
        const threshold = (!isNaN(parsedThreshold) && parsedThreshold >= 0) ? parsedThreshold : 2;

        if (!dueDateStr) {
            const fallbackPriority = (priorityMode === 'auto' || !priorityMode) ? 'medium' : priorityMode;
            return {
                priority: fallbackPriority,
                duePillClass: '',
                dueLabel: '',
                diffDays: null,
                isUrgent: false,
                isOverdue: false,
                threshold
            };
        }

        const baseDate = referenceDate ? (referenceDate instanceof Date ? new Date(referenceDate) : parseISODateString(referenceDate)) : new Date();
        baseDate.setHours(0, 0, 0, 0);

        const due = parseISODateString(dueDateStr);
        due.setHours(0, 0, 0, 0);

        const diffDays = calendarDayDifference(baseDate, due);
        const dueFormatted = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const alertStartDate = new Date(due);
        alertStartDate.setDate(alertStartDate.getDate() - threshold);
        const alertStartFormatted = alertStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        let effectivePriority = priorityMode;
        let duePillClass = 'normal';
        let dueLabel = '';
        let isUrgent = false;
        let isOverdue = false;

        if (diffDays < 0) {
            // OVERDUE: End date has passed!
            const absDays = Math.abs(diffDays);
            dueLabel = `🚨 OVERDUE! Due ${dueFormatted} (${absDays}d overdue)`;
            duePillClass = 'overdue';
            isOverdue = true;
            isUrgent = true;
            if (priorityMode === 'auto' || !priorityMode) effectivePriority = 'urgent';
        } else if (diffDays === 0) {
            // DUE TODAY / DUE ON VIEWED DATE: Present Day Alert!
            const isRealToday = isSameDay(baseDate, new Date());
            dueLabel = isRealToday 
                ? `🔴 PRESENT DAY ALERT! Due Today (${dueFormatted})` 
                : `🔴 PRESENT DAY ALERT! Due (${dueFormatted})`;
            duePillClass = 'today';
            isUrgent = true;
            if (priorityMode === 'auto' || !priorityMode) effectivePriority = 'urgent';
        } else if (diffDays <= threshold) {
            // WITHIN HIGH ALERT REMINDER WINDOW
            dueLabel = `🔥 HIGH ALERT! Due ${dueFormatted} (${diffDays} day${diffDays > 1 ? 's' : ''} left ≤ ${threshold}d alert)`;
            duePillClass = 'soon';
            isUrgent = true;
            if (priorityMode === 'auto' || !priorityMode) effectivePriority = 'urgent';
        } else {
            // OUTSIDE ALERT WINDOW
            dueLabel = `📅 Due ${dueFormatted} · Alert on ${alertStartFormatted} (${diffDays} day${diffDays > 1 ? 's' : ''} left)`;
            duePillClass = 'normal';
            if (priorityMode === 'auto' || !priorityMode) effectivePriority = 'medium';
        }

        return {
            priority: effectivePriority,
            duePillClass,
            dueLabel,
            diffDays,
            isUrgent,
            isOverdue,
            threshold,
            dueFormatted,
            alertStartFormatted
        };
    }

    // ==========================================
    // DATA STORE & CONFLICT-FREE SYNC MERGE
    // ==========================================
    function dataKeys(data) {
        return Object.keys(data || {}).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
    }

    function taskTimestamp(task) {
        if (!task) return '';
        return task.updatedAt || task.createdAt || '';
    }

    function mergeDataStores(a, b) {
        const out = {};
        const allKeys = new Set([...dataKeys(a), ...dataKeys(b)]);
        const deletedA = (a && a._meta && Array.isArray(a._meta.deleted)) ? a._meta.deleted : [];
        const deletedB = (b && b._meta && Array.isArray(b._meta.deleted)) ? b._meta.deleted : [];
        const deleted = new Set([...deletedA, ...deletedB]);

        allKeys.forEach(key => {
            const listA = Array.isArray(a[key]) ? a[key] : [];
            const listB = Array.isArray(b[key]) ? b[key] : [];
            const byId = new Map();

            listA.forEach(t => { if (t && t.id) byId.set(t.id, t); });
            listB.forEach(t => {
                if (!t || !t.id) return;
                const cur = byId.get(t.id);
                if (!cur || taskTimestamp(t) >= taskTimestamp(cur)) byId.set(t.id, t);
            });

            const merged = [...byId.values()].filter(t => !deleted.has(t.id));
            if (merged.length) out[key] = merged;
        });

        out._meta = { deleted: [...deleted], updatedAt: new Date().toISOString() };
        return out;
    }

    // ==========================================
    // SUBTASKS / CHECKLIST ENGINE
    // ==========================================
    function createSubtask(text, completed = false, id = null) {
        if (!text || typeof text !== 'string') return null;
        const trimmed = text.trim();
        if (!trimmed) return null;
        return {
            id: id || ('sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
            text: trimmed,
            completed: Boolean(completed)
        };
    }

    function getSubtaskProgress(subtasks) {
        if (!Array.isArray(subtasks) || subtasks.length === 0) {
            return { total: 0, completed: 0, percentage: 0 };
        }
        const total = subtasks.length;
        const completed = subtasks.filter(s => Boolean(s && s.completed)).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        return { total, completed, percentage };
    }

    function toggleSubtaskInList(subtasks, subtaskId) {
        if (!Array.isArray(subtasks)) return [];
        return subtasks.map(s => {
            if (s && s.id === subtaskId) {
                return { ...s, completed: !s.completed };
            }
            return s;
        });
    }

    function addSubtaskToList(subtasks, text) {
        const list = Array.isArray(subtasks) ? [...subtasks] : [];
        const item = createSubtask(text);
        if (item) list.push(item);
        return list;
    }

    function removeSubtaskFromList(subtasks, subtaskId) {
        if (!Array.isArray(subtasks)) return [];
        return subtasks.filter(s => s && s.id !== subtaskId);
    }

    // ==========================================
    // SORTING & FILTERING ENGINE
    // ==========================================
    function sortTasks(tasks, sortBy = 'custom') {
        if (!Array.isArray(tasks)) return [];
        const list = [...tasks];

        // Pinned tasks always stay at the top!
        const pinned = [];
        const unpinned = [];
        for (const t of list) {
            if (t && t.isPinned) {
                pinned.push(t);
            } else {
                unpinned.push(t);
            }
        }

        const sortComparator = (a, b) => {
            if (!a || !b) return 0;
            if (sortBy === 'dueDate') {
                if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
                if (a.dueDate) return -1;
                if (b.dueDate) return 1;
                return 0;
            }

            if (sortBy === 'priority') {
                const rank = { urgent: 4, high: 3, medium: 2, low: 1, auto: 2.5 };
                const rankA = rank[a.priority] || 2;
                const rankB = rank[b.priority] || 2;
                if (rankB !== rankA) return rankB - rankA;
                return 0;
            }

            if (sortBy === 'time') {
                if (a.time && b.time) return a.time.localeCompare(b.time);
                if (a.time) return -1;
                if (b.time) return 1;
                return 0;
            }

            if (sortBy === 'title') {
                return (a.title || '').localeCompare(b.title || '');
            }

            return 0;
        };

        pinned.sort(sortComparator);
        unpinned.sort(sortComparator);

        return [...pinned, ...unpinned];
    }

    function filterTasks(tasks, options = {}) {
        if (!Array.isArray(tasks)) return [];
        const { status = 'all', search = '', category = 'all' } = options;
        const q = (search || '').toLowerCase().trim();

        return tasks.filter(t => {
            if (!t) return false;
            if (status === 'pending' && t.completed) return false;
            if (status === 'completed' && !t.completed) return false;

            if (category && category !== 'all') {
                const cat = t.category || 'General';
                if (cat !== category) return false;
            }

            if (q) {
                const matchTitle = t.title && t.title.toLowerCase().includes(q);
                const matchCat = t.category && t.category.toLowerCase().includes(q);
                const matchNotes = t.notes && t.notes.toLowerCase().includes(q);
                const matchSubtask = Array.isArray(t.subtasks) && t.subtasks.some(s => s && s.text && s.text.toLowerCase().includes(q));
                if (!matchTitle && !matchCat && !matchNotes && !matchSubtask) return false;
            }

            return true;
        });
    }

    // ==========================================
    // ANALYTICS & STREAKS ENGINE
    // ==========================================
    function calculateStreak(allData, referenceDate = new Date()) {
        if (!allData || typeof allData !== 'object') return { currentStreak: 0, bestStreak: 0 };
        const base = referenceDate instanceof Date ? new Date(referenceDate) : parseISODateString(referenceDate);
        base.setHours(0, 0, 0, 0);

        const completedDates = new Set();
        dataKeys(allData).forEach(key => {
            const tasks = allData[key];
            if (Array.isArray(tasks)) {
                tasks.forEach(t => {
                    if (t && t.completed) {
                        const cDate = t.completedDate || key;
                        completedDates.add(cDate);
                    }
                });
            }
        });

        const sortedDates = [...completedDates].sort();
        if (sortedDates.length === 0) {
            return { currentStreak: 0, bestStreak: 0 };
        }

        let bestStreak = 0;
        let tempStreak = 0;
        let prevDate = null;

        sortedDates.forEach(dStr => {
            const d = parseISODateString(dStr);
            if (!prevDate) {
                tempStreak = 1;
            } else {
                const diff = calendarDayDifference(prevDate, d);
                if (diff === 1) {
                    tempStreak += 1;
                } else if (diff > 1) {
                    tempStreak = 1;
                }
            }
            if (tempStreak > bestStreak) bestStreak = tempStreak;
            prevDate = d;
        });

        let currentStreak = 0;
        const checkDate = new Date(base);

        const todayStr = toISODateString(checkDate);
        if (completedDates.has(todayStr)) {
            currentStreak += 1;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // Grace period: check from yesterday
            checkDate.setDate(checkDate.getDate() - 1);
        }

        while (true) {
            const dStr = toISODateString(checkDate);
            if (completedDates.has(dStr)) {
                currentStreak += 1;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        if (currentStreak > bestStreak) bestStreak = currentStreak;

        return { currentStreak, bestStreak };
    }

    function calculateProductivityStats(allData, referenceDate = new Date()) {
        let totalTasks = 0;
        let totalCompleted = 0;
        const categoryCounts = {
            General: { total: 0, completed: 0 },
            Work: { total: 0, completed: 0 },
            Personal: { total: 0, completed: 0 },
            Study: { total: 0, completed: 0 },
            Health: { total: 0, completed: 0 }
        };

        const keys = dataKeys(allData);
        keys.forEach(key => {
            const tasks = allData[key];
            if (Array.isArray(tasks)) {
                tasks.forEach(t => {
                    if (!t || !t.id) return;
                    totalTasks += 1;
                    const cat = t.category || 'General';
                    if (!categoryCounts[cat]) {
                        categoryCounts[cat] = { total: 0, completed: 0 };
                    }
                    categoryCounts[cat].total += 1;

                    if (t.completed) {
                        totalCompleted += 1;
                        categoryCounts[cat].completed += 1;
                    }
                });
            }
        });

        const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
        const streaks = calculateStreak(allData, referenceDate);

        const base = referenceDate instanceof Date ? new Date(referenceDate) : parseISODateString(referenceDate);
        base.setHours(0, 0, 0, 0);
        const recentDays = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date(base);
            d.setDate(base.getDate() - i);
            const dStr = toISODateString(d);
            const dayTasks = Array.isArray(allData[dStr]) ? allData[dStr] : [];
            const completedCount = dayTasks.filter(t => t.completed).length;
            recentDays.push({
                date: dStr,
                dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
                total: dayTasks.length,
                completed: completedCount
            });
        }

        return {
            totalTasks,
            totalCompleted,
            completionRate,
            currentStreak: streaks.currentStreak,
            bestStreak: streaks.bestStreak,
            categoryCounts,
            recentDays
        };
    }

    // ==========================================
    // EXPORT & SUMMARY ENGINE
    // ==========================================
    function generateCSV(allData, selectedDate = null) {
        const headers = ['Date', 'Title', 'Priority', 'End Date', 'Alert Days', 'Time', 'Category', 'Status', 'Pinned', 'Notes', 'Subtasks'];
        const rows = [headers.join(',')];

        const keysToExport = selectedDate ? [selectedDate] : dataKeys(allData).sort();

        keysToExport.forEach(dateKey => {
            const tasks = Array.isArray(allData[dateKey]) ? allData[dateKey] : [];
            tasks.forEach(t => {
                if (!t || !t.id) return;
                const escapeCSV = (val) => {
                    if (val == null) return '""';
                    const str = String(val).replace(/"/g, '""');
                    return `"${str}"`;
                };

                const subtasksStr = Array.isArray(t.subtasks)
                    ? t.subtasks.map(s => `[${s.completed ? 'x' : ' '}] ${s.text}`).join('; ')
                    : '';

                const row = [
                    escapeCSV(dateKey),
                    escapeCSV(t.title || ''),
                    escapeCSV(t.priority || 'auto'),
                    escapeCSV(t.dueDate || ''),
                    escapeCSV(t.alertDays != null ? t.alertDays : ''),
                    escapeCSV(t.time || ''),
                    escapeCSV(t.category || 'General'),
                    escapeCSV(t.completed ? 'Completed' : 'Pending'),
                    escapeCSV(t.isPinned ? 'Yes' : 'No'),
                    escapeCSV(t.notes || ''),
                    escapeCSV(subtasksStr)
                ];
                rows.push(row.join(','));
            });
        });

        return rows.join('\r\n');
    }

    function generateMarkdownSummary(tasks, dateStr) {
        if (!Array.isArray(tasks)) tasks = [];
        const total = tasks.length;
        const completed = tasks.filter(t => t.completed).length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        let md = `# 📅 DayTask Summary — ${dateStr}\n\n`;
        md += `**Progress:** ${completed}/${total} completed (${percentage}%)\n\n`;

        if (tasks.length === 0) {
            md += `*No tasks recorded for this date.*\n`;
            return md;
        }

        const pending = tasks.filter(t => !t.completed);
        const done = tasks.filter(t => t.completed);

        if (pending.length > 0) {
            md += `### ⏳ Pending Tasks (${pending.length})\n`;
            pending.forEach(t => {
                const priorityBadge = t.priority && t.priority !== 'auto' ? ` [${t.priority.toUpperCase()}]` : '';
                const dueBadge = t.dueDate ? ` (Due: ${t.dueDate})` : '';
                md += `- [ ] **${t.title}**${priorityBadge}${dueBadge}\n`;
                if (t.notes) {
                    md += `  > ${t.notes.replace(/\n/g, '\n  > ')}\n`;
                }
                if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
                    t.subtasks.forEach(s => {
                        md += `  - [${s.completed ? 'x' : ' '}] ${s.text}\n`;
                    });
                }
            });
            md += `\n`;
        }

        if (done.length > 0) {
            md += `### ✅ Completed Tasks (${done.length})\n`;
            done.forEach(t => {
                md += `- [x] ~${t.title}~\n`;
                if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
                    t.subtasks.forEach(s => {
                        md += `  - [${s.completed ? 'x' : ' '}] ${s.text}\n`;
                    });
                }
            });
            md += `\n`;
        }

        return md;
    }

    // ==========================================
    // BATCH ACTIONS ENGINE
    // ==========================================
    function batchMarkAllComplete(allData, dateStr) {
        if (!allData || !Array.isArray(allData[dateStr])) return { count: 0 };
        let count = 0;
        const nowIso = new Date().toISOString();
        allData[dateStr].forEach(t => {
            if (!t.completed) {
                t.completed = true;
                t.completedDate = dateStr;
                t.completedAt = nowIso;
                t.updatedAt = nowIso;
                count += 1;
            }
        });
        return { count };
    }

    function batchMovePending(allData, fromDateStr, toDateStr) {
        if (!allData || !Array.isArray(allData[fromDateStr])) return { count: 0 };
        if (!allData[toDateStr]) allData[toDateStr] = [];

        const pending = allData[fromDateStr].filter(t => !t.completed);
        allData[fromDateStr] = allData[fromDateStr].filter(t => t.completed);

        const nowIso = new Date().toISOString();
        pending.forEach(t => {
            t.updatedAt = nowIso;
            allData[toDateStr].push(t);
        });

        return { count: pending.length };
    }

    function batchClearCompleted(allData, dateStr) {
        if (!allData || !Array.isArray(allData[dateStr])) return { count: 0 };
        if (!allData._meta) allData._meta = { deleted: [] };
        if (!Array.isArray(allData._meta.deleted)) allData._meta.deleted = [];

        const completed = allData[dateStr].filter(t => t.completed);
        allData[dateStr] = allData[dateStr].filter(t => !t.completed);

        completed.forEach(t => {
            if (!allData._meta.deleted.includes(t.id)) {
                allData._meta.deleted.push(t.id);
            }
        });

        return { count: completed.length };
    }

    function createUndoAction(type, payload) {
        return {
            id: 'undo_' + Date.now(),
            type,
            payload,
            createdAt: Date.now()
        };
    }

    function applyUndoAction(allData, undoAction) {
        if (!allData || !undoAction) return false;
        const { type, payload } = undoAction;

        if (type === 'delete') {
            const { dateKey, task } = payload;
            if (!allData[dateKey]) allData[dateKey] = [];
            allData[dateKey].unshift(task);
            if (allData._meta && Array.isArray(allData._meta.deleted)) {
                allData._meta.deleted = allData._meta.deleted.filter(id => id !== task.id);
            }
            return true;
        }

        if (type === 'complete_toggle') {
            const { taskId, previousCompleted, previousCompletedDate } = payload;
            dataKeys(allData).forEach(k => {
                const t = allData[k].find(task => task.id === taskId);
                if (t) {
                    t.completed = previousCompleted;
                    if (previousCompleted) {
                        t.completedDate = previousCompletedDate || k;
                    } else {
                        delete t.completedDate;
                        delete t.completedAt;
                    }
                    t.updatedAt = new Date().toISOString();
                }
            });
            return true;
        }

        return false;
    }

    // If running in Node.js test environment without DOM, return core functions
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return {
            toISODateString,
            parseISODateString,
            isSameDay,
            calendarDayDifference,
            formatTimeDisplay,
            escapeHTML,
            computeUrgencyAndPriority,
            mergeDataStores,
            dataKeys,
            taskTimestamp,
            createSubtask,
            getSubtaskProgress,
            toggleSubtaskInList,
            addSubtaskToList,
            removeSubtaskFromList,
            sortTasks,
            filterTasks,
            calculateStreak,
            calculateProductivityStats,
            generateCSV,
            generateMarkdownSummary,
            batchMarkAllComplete,
            batchMovePending,
            batchClearCompleted,
            createUndoAction,
            applyUndoAction
        };
    }

    // ==========================================
    // CLIENT APPLICATION RUNTIME
    // ==========================================
    const STORAGE_KEY_DATA = 'daytask_data';
    const STORAGE_KEY_THEME = 'daytask_theme';
    const STORAGE_KEY_SELECTED_DATE = 'daytask_selected_date';
    const STORAGE_KEY_NOTIFIED = 'daytask_notified';

    const API_ENDPOINT = '/api/data';
    const REMOTE_DISABLED = typeof location !== 'undefined' && location.protocol === 'file:';

    // Clear legacy pin locks
    try {
        localStorage.removeItem('daytask_pin');
    } catch (e) {}

    const savedSelectedDate = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY_SELECTED_DATE) : null;
    let currentDate = savedSelectedDate ? parseISODateString(savedSelectedDate) : new Date();
    currentDate.setHours(0, 0, 0, 0);

    const STORAGE_KEY_SOUND = 'daytask_sound_enabled';

    let activeFilter = 'all'; // 'all' | 'pending' | 'completed'
    let activeSort = 'custom'; // 'custom' | 'dueDate' | 'priority' | 'time' | 'title'
    let activeCategory = 'all';
    let searchQuery = '';
    let draggedTaskId = null;
    let dataCache = null;
    let remotePushTimer = null;
    let remotePullInFlight = false;
    let lastAlertCheckAt = 0;
    let isConfettiRunning = false;
    let lastRenderedStateKey = '';
    let draftSubtasks = [];
    let editModalSubtasks = [];
    let isSoundEnabled = typeof localStorage !== 'undefined' ? (localStorage.getItem(STORAGE_KEY_SOUND) !== 'false') : true;

    // DOM Elements Cache
    const elements = {
        themeToggleBtn: document.getElementById('theme-toggle'),
        headerTodayDisplay: document.getElementById('header-today-display'),
        currentDateHeading: document.getElementById('current-date-heading'),
        headerStreakBadge: document.getElementById('header-streak-badge'),
        streakCounter: document.getElementById('streak-counter'),
        btnAnalytics: document.getElementById('btn-analytics'),
        btnSound: document.getElementById('btn-sound'),
        btnHelp: document.getElementById('btn-help'),

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

        // Extra task options
        btnToggleAddExtra: document.getElementById('btn-toggle-add-extra'),
        extraToggleLabel: document.getElementById('extra-toggle-label'),
        addExtraContainer: document.getElementById('add-extra-container'),
        taskNotesInput: document.getElementById('task-notes-input'),
        taskSubtaskDraftInput: document.getElementById('task-subtask-draft-input'),
        btnAddDraftSubtask: document.getElementById('btn-add-draft-subtask'),
        subtaskDraftChips: document.getElementById('subtask-draft-chips'),
        taskPinInput: document.getElementById('task-pin-input'),

        // Toolbar controls
        taskSearchInput: document.getElementById('task-search-input'),
        btnClearSearch: document.getElementById('btn-clear-search'),
        searchEmptyState: document.getElementById('search-empty-state'),
        searchEmptyMessage: document.getElementById('search-empty-message'),
        btnResetSearch: document.getElementById('btn-reset-search'),
        filterTabs: document.getElementById('filter-tabs'),
        taskSortSelect: document.getElementById('task-sort-select'),
        categoryFilterSelect: document.getElementById('category-filter-select'),
        btnBulkMenu: document.getElementById('btn-bulk-menu'),
        bulkMenuDropdown: document.getElementById('bulk-menu-dropdown'),
        btnBatchCompleteAll: document.getElementById('btn-batch-complete-all'),
        btnBatchMoveTomorrow: document.getElementById('btn-batch-move-tomorrow'),
        btnBatchClearCompleted: document.getElementById('btn-batch-clear-completed'),
        btnCopyMarkdownSummary: document.getElementById('btn-copy-markdown-summary'),

        pendingTaskList: document.getElementById('pending-task-list'),
        completedTaskList: document.getElementById('completed-task-list'),
        pendingCountBadge: document.getElementById('pending-count-badge'),
        completedCountBadge: document.getElementById('completed-count-badge'),
        pendingEmptyState: document.getElementById('pending-empty-state'),
        completedEmptyState: document.getElementById('completed-empty-state'),

        // Urgent Banner
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
        editTaskNotes: document.getElementById('edit-task-notes'),
        editSubtasksList: document.getElementById('edit-subtasks-list'),
        editNewSubtaskInput: document.getElementById('edit-new-subtask-input'),
        btnAddEditSubtask: document.getElementById('btn-add-edit-subtask'),
        editTaskPin: document.getElementById('edit-task-pin'),
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

        // Backup Modal
        btnBackup: document.getElementById('btn-backup'),
        backupModal: document.getElementById('backup-modal'),
        btnCloseBackupModal: document.getElementById('btn-close-backup-modal'),
        btnExportBackup: document.getElementById('btn-export-backup'),
        btnExportCsv: document.getElementById('btn-export-csv'),
        btnSendTestEmail: document.getElementById('btn-send-test-email'),
        backupFileInput: document.getElementById('backup-file-input'),

        // Analytics Modal
        analyticsModal: document.getElementById('analytics-modal'),
        btnCloseAnalyticsModal: document.getElementById('btn-close-analytics-modal'),
        statsCurrentStreak: document.getElementById('stats-current-streak'),
        statsBestStreak: document.getElementById('stats-best-streak'),
        statsCompletionRate: document.getElementById('stats-completion-rate'),
        statsLifetimeCompleted: document.getElementById('stats-lifetime-completed'),
        analyticsChartContainer: document.getElementById('analytics-chart-container'),
        analyticsCategoryContainer: document.getElementById('analytics-category-container'),

        // Shortcuts Modal
        shortcutsModal: document.getElementById('shortcuts-modal'),
        btnCloseShortcutsModal: document.getElementById('btn-close-shortcuts-modal'),

        // Notifications & Misc
        btnNotifications: document.getElementById('btn-notifications'),
        notificationIndicator: document.getElementById('notification-indicator'),
        toastContainer: document.getElementById('toast-container'),
        confettiCanvas: document.getElementById('confetti-canvas'),
        syncStatus: document.getElementById('sync-status')
    };

    let targetExtendTask = null;

    // ==========================================
    // STORAGE & PERSISTENCE
    // ==========================================
    function loadAllData() {
        if (dataCache) return dataCache;
        try {
            const json = localStorage.getItem(STORAGE_KEY_DATA);
            dataCache = json ? JSON.parse(json) : {};
        } catch (e) {
            console.error('Failed to parse localStorage data:', e);
            dataCache = {};
        }
        if (!dataCache._meta) {
            dataCache._meta = { deleted: [], updatedAt: new Date().toISOString() };
        }
        return dataCache;
    }

    function saveAllData(data) {
        dataCache = data;
        try {
            localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
            showToast('Failed to save tasks locally', 'error');
        }
        scheduleRemotePush(data);
    }

    function getTasksForDate(dateStr) {
        const allData = loadAllData();
        const pendingForDate = [];
        const completedForDate = [];

        dataKeys(allData).forEach(dateKey => {
            const tasks = allData[dateKey];
            if (!Array.isArray(tasks)) return;

            tasks.forEach(task => {
                if (!task || !task.id) return;
                if (!task.completed) {
                    if (dateKey === dateStr) {
                        if (!pendingForDate.some(t => t.id === task.id)) {
                            pendingForDate.push(task);
                        }
                    }
                } else {
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
        const activeIds = new Set(tasks.map(t => t.id));

        // Clean up tasks moving across keys to prevent duplicates
        dataKeys(data).forEach(k => {
            if (k !== dateStr && Array.isArray(data[k])) {
                data[k] = data[k].filter(t => !activeIds.has(t.id));
            }
        });

        data[dateStr] = tasks;
        saveAllData(data);
    }

    // ==========================================
    // REMOTE SYNC ENGINE
    // ==========================================
    function setSyncStatus(status) {
        const el = elements.syncStatus;
        if (!el) return;
        el.dataset.status = status;
        if (status === 'synced') {
            el.textContent = '✓ Cloud synced';
        } else if (status === 'syncing') {
            el.textContent = '↻ Syncing…';
        } else if (status === 'offline') {
            el.textContent = '⚠ Offline — saved locally';
        } else {
            el.textContent = 'Local mode';
        }
    }

    function scheduleRemotePush(data) {
        if (REMOTE_DISABLED) {
            setSyncStatus('file');
            return;
        }
        clearTimeout(remotePushTimer);
        remotePushTimer = setTimeout(() => pushToServer(data), 350);
    }

    async function pushToServer(data) {
        if (REMOTE_DISABLED) return;
        setSyncStatus('syncing');
        try {
            const res = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const merged = await res.json();
            dataCache = merged;
            localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(merged));
            setSyncStatus('synced');
        } catch (e) {
            console.warn('Remote sync push failed:', e);
            setSyncStatus('offline');
        }
    }

    async function pullFromServer(forceRender = false) {
        if (REMOTE_DISABLED) {
            setSyncStatus('file');
            return;
        }
        if (remotePullInFlight) return;
        remotePullInFlight = true;
        let dataChanged = false;

        try {
            const res = await fetch(API_ENDPOINT);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const remote = await res.json();
            const local = loadAllData();
            const merged = mergeDataStores(local, remote);
            const localJson = JSON.stringify(local);
            const mergedJson = JSON.stringify(merged);

            if (mergedJson !== localJson) {
                saveAllData(merged);
                dataChanged = true;
            }
            setSyncStatus('synced');
        } catch (e) {
            console.warn('Remote sync pull failed:', e);
            setSyncStatus('offline');
        } finally {
            remotePullInFlight = false;
            if (dataChanged || forceRender) {
                renderAll();
            }
        }
    }

    async function initRemoteSync() {
        if (REMOTE_DISABLED) {
            setSyncStatus('file');
            return;
        }
        setSyncStatus('syncing');
        await pullFromServer(true);
        // Poll every 5s only if page is visible
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                pullFromServer(false);
            }
        }, 5000);
    }

    // ==========================================
    // BACKUP & RESTORE
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
                const incomingData = parsed && parsed.data ? parsed.data : parsed;
                if (incomingData && typeof incomingData === 'object') {
                    const current = loadAllData();
                    const merged = mergeDataStores(current, incomingData);
                    saveAllData(merged);
                    if (parsed.theme) {
                        document.documentElement.setAttribute('data-theme', parsed.theme);
                        localStorage.setItem(STORAGE_KEY_THEME, parsed.theme);
                    }
                    renderAll();
                    closeBackupModal();
                    showToast('Tasks restored and merged successfully!', 'success');
                } else {
                    showToast('Invalid backup file format', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Failed to parse backup JSON file', 'error');
            }
        };
        reader.readAsText(file);
    }

    function openBackupModal() {
        if (elements.backupModal) elements.backupModal.classList.remove('hidden');
    }

    function closeBackupModal() {
        if (elements.backupModal) elements.backupModal.classList.add('hidden');
        if (elements.backupFileInput) elements.backupFileInput.value = '';
    }

    // ==========================================
    // THEME & NOTIFICATIONS
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

    function updateNotificationIndicator() {
        if (!elements.notificationIndicator) return;
        if (!('Notification' in window)) {
            elements.notificationIndicator.classList.add('hidden');
            if (elements.btnNotifications) elements.btnNotifications.title = 'Notifications not supported';
            return;
        }

        if (Notification.permission === 'granted') {
            elements.notificationIndicator.classList.remove('hidden');
            elements.notificationIndicator.classList.remove('blocked');
            if (elements.btnNotifications) elements.btnNotifications.title = 'Alerts enabled';
        } else if (Notification.permission === 'denied') {
            elements.notificationIndicator.classList.remove('hidden');
            elements.notificationIndicator.classList.add('blocked');
            if (elements.btnNotifications) elements.btnNotifications.title = 'Notifications blocked in browser settings';
        } else {
            elements.notificationIndicator.classList.add('hidden');
            if (elements.btnNotifications) elements.btnNotifications.title = 'Click to enable notifications';
        }
    }

    function requestNotificationPermission() {
        if (!('Notification' in window)) {
            showToast('Notifications are not supported in this browser', 'error');
            return;
        }
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(perm => {
                updateNotificationIndicator();
                if (perm === 'granted') {
                    showToast('Alerts enabled! You will be notified when tasks reach alert window.', 'success');
                    checkAndNotifyAlerts();
                } else {
                    showToast('Notifications blocked. Enable them in browser settings.', 'error');
                }
            });
        } else if (Notification.permission === 'granted') {
            showToast('Notifications are already active', 'success');
        } else {
            showToast('Notifications are blocked. Enable them in browser settings.', 'error');
        }
    }

    function checkAndNotifyAlerts() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        if (document.visibilityState !== 'visible') return;

        const now = Date.now();
        if (now - lastAlertCheckAt < 60000) return;
        lastAlertCheckAt = now;

        const todayStr = toISODateString(new Date());
        let notifiedMap = {};
        try {
            notifiedMap = JSON.parse(localStorage.getItem(STORAGE_KEY_NOTIFIED) || '{}');
        } catch (e) {}
        if (!notifiedMap || notifiedMap.date !== todayStr) {
            notifiedMap = { date: todayStr, ids: [] };
        }

        const allData = loadAllData();
        dataKeys(allData).forEach(dateKey => {
            allData[dateKey].forEach(task => {
                if (task.completed || !task.dueDate) return;
                const info = computeUrgencyAndPriority(
                    task.dueDate,
                    task.priority || 'auto',
                    task.alertDays != null ? task.alertDays : 2,
                    new Date()
                );
                if (info.isUrgent && !notifiedMap.ids.includes(task.id)) {
                    try {
                        new Notification('DayTask Alert', {
                            body: `${task.title} — ${info.dueLabel}`,
                            tag: task.id
                        });
                        notifiedMap.ids.push(task.id);
                    } catch (e) {}
                }
            });
        });

        try {
            localStorage.setItem(STORAGE_KEY_NOTIFIED, JSON.stringify(notifiedMap));
        } catch (e) {}
    }

    // ==========================================
    // TOAST NOTIFICATIONS & AUDIO SYNTHESIS
    // ==========================================
    function playAudioChime(type = 'check') {
        if (!isSoundEnabled || typeof window === 'undefined') return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();

            if (type === 'check') {
                const playTone = (freq, start, duration) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
                    gain.gain.setValueAtTime(0.12, ctx.currentTime + start);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(ctx.currentTime + start);
                    osc.stop(ctx.currentTime + start + duration);
                };
                playTone(523.25, 0, 0.12);     // C5
                playTone(659.25, 0.08, 0.18);  // E5
            } else if (type === 'uncheck') {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(329.63, ctx.currentTime);
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.08);
            } else if (type === 'fanfare') {
                const notes = [523.25, 659.25, 783.99, 1046.50];
                notes.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    const start = idx * 0.09;
                    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
                    gain.gain.setValueAtTime(0.14, ctx.currentTime + start);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.28);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(ctx.currentTime + start);
                    osc.stop(ctx.currentTime + start + 0.28);
                });
            }
        } catch (e) {}
    }

    function updateSoundIndicator() {
        if (!elements.btnSound) return;
        const onIcon = elements.btnSound.querySelector('.sound-on-icon');
        const offIcon = elements.btnSound.querySelector('.sound-off-icon');
        if (onIcon && offIcon) {
            onIcon.classList.toggle('hidden', !isSoundEnabled);
            offIcon.classList.toggle('hidden', isSoundEnabled);
        }
        elements.btnSound.title = isSoundEnabled ? 'Sound Effects Enabled (M)' : 'Sound Effects Muted (M)';
    }

    function toggleSound() {
        isSoundEnabled = !isSoundEnabled;
        try {
            localStorage.setItem(STORAGE_KEY_SOUND, isSoundEnabled ? 'true' : 'false');
        } catch (e) {}
        updateSoundIndicator();
        if (isSoundEnabled) {
            playAudioChime('check');
            showToast('Sound effects enabled 🔊');
        } else {
            showToast('Sound effects muted 🔇');
        }
    }

    function showToast(message, type = 'info', action = null) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>';
        if (type === 'success') {
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        } else if (type === 'error') {
            iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>';
        }

        toast.innerHTML = `${iconSvg} <span>${escapeHTML(message)}</span>`;
        if (action && typeof action.onClick === 'function') {
            const actionBtn = document.createElement('button');
            actionBtn.type = 'button';
            actionBtn.className = 'toast-undo-btn';
            actionBtn.textContent = action.text || 'Undo';
            actionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                action.onClick();
                toast.remove();
            });
            toast.appendChild(actionBtn);
        }

        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3200);
    }

    function renderStreakCounter() {
        if (!elements.streakCounter) return;
        const streakData = calculateStreak(loadAllData(), currentDate);
        elements.streakCounter.textContent = streakData.currentStreak;
    }

    // ==========================================
    // CORE RENDERING ENGINE
    // ==========================================
    function renderAll() {
        const dateStr = toISODateString(currentDate);
        try {
            sessionStorage.setItem(STORAGE_KEY_SELECTED_DATE, dateStr);
        } catch (e) {}

        const tasks = getTasksForDate(dateStr);

        renderHeaderDate();
        renderWeekStrip();
        renderStreakCounter();
        renderStats(tasks);
        renderTaskLists(tasks);
        checkUrgentTaskDeadlines();
        checkAndNotifyAlerts();
        updateNotificationIndicator();
        updateSoundIndicator();
    }

    function renderHeaderDate() {
        const today = new Date();
        const isToday = isSameDay(currentDate, today);

        if (isToday) {
            elements.currentDateHeading.textContent = 'Today';
        } else {
            elements.currentDateHeading.textContent = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayNameStr = dayNames[currentDate.getDay()];
        elements.displayDayName.textContent = isToday ? `${dayNameStr} (Today)` : dayNameStr;

        elements.displayFullDate.textContent = currentDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        elements.datePickerInput.value = toISODateString(currentDate);
    }

    function renderWeekStrip() {
        elements.weekStripContainer.innerHTML = '';
        const today = new Date();

        for (let i = -3; i <= 3; i++) {
            const day = new Date(currentDate);
            day.setDate(currentDate.getDate() + i);

            const dayStr = toISODateString(day);
            const dayTasks = getTasksForDate(dayStr);
            const isSelected = isSameDay(day, currentDate);
            const isToday = isSameDay(day, today);

            const dayNameShort = day.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum = day.getDate();

            const pill = document.createElement('div');
            pill.className = `week-day-pill ${isSelected ? 'active' : ''}`;
            pill.setAttribute('role', 'button');
            pill.setAttribute('tabindex', '0');
            pill.setAttribute('aria-label', `${isToday ? 'Today, ' : ''}${dayNameShort} ${dayNum}`);

            let dotsHtml = '';
            if (dayTasks.length > 0) {
                const total = dayTasks.length;
                const completed = dayTasks.filter(t => t.completed).length;
                const hasOverdue = dayTasks.some(t => {
                    if (t.completed || !t.dueDate) return false;
                    return calendarDayDifference(today, t.dueDate) < 0;
                });
                const hasAlert = dayTasks.some(t => {
                    if (t.completed || !t.dueDate) return false;
                    const info = computeUrgencyAndPriority(t.dueDate, t.priority, t.alertDays, today);
                    return info.isUrgent && !info.isOverdue;
                });

                let dotClass = '';
                if (hasOverdue) {
                    dotClass = 'overdue-dot';
                } else if (hasAlert) {
                    dotClass = 'alert-dot';
                } else if (completed === total) {
                    dotClass = 'completed-dot';
                }

                dotsHtml = `<div class="day-dots"><span class="dot ${dotClass}"></span></div>`;
            } else {
                dotsHtml = `<div class="day-dots"></div>`;
            }

            pill.innerHTML = `
                <span class="day-name">${isToday ? 'TODAY' : dayNameShort}</span>
                <span class="day-number">${dayNum}</span>
                ${dotsHtml}
            `;

            const selectDay = () => {
                currentDate = new Date(day);
                renderAll();
            };

            pill.addEventListener('click', selectDay);
            pill.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectDay();
                }
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

        let motivationStr = "Add your tasks to organize your day!";
        if (total > 0) {
            if (percentage === 100) {
                motivationStr = "🎉 Phenomenal job! You accomplished all tasks today!";
            } else if (percentage >= 75) {
                motivationStr = "🚀 Almost there! Push through the remaining tasks!";
            } else if (percentage >= 50) {
                motivationStr = "💪 Halfway through! Keep up the great momentum!";
            } else if (percentage > 0) {
                motivationStr = "🌱 Good start! Focus on your next priority item.";
            } else {
                motivationStr = "🎯 Ready to conquer your day? Let's check off some tasks!";
            }
        }
        elements.dashMotivation.textContent = motivationStr;
    }

    function checkUrgentTaskDeadlines() {
        const allData = loadAllData();
        const urgentTasks = [];
        const viewDate = new Date(currentDate);
        viewDate.setHours(0, 0, 0, 0);

        dataKeys(allData).forEach(dateKey => {
            const tasks = allData[dateKey];
            if (!Array.isArray(tasks)) return;

            tasks.forEach(task => {
                if (!task.completed && task.dueDate) {
                    const info = computeUrgencyAndPriority(
                        task.dueDate,
                        task.priority || 'auto',
                        task.alertDays != null ? task.alertDays : 2,
                        viewDate
                    );
                    if (info.isUrgent) {
                        urgentTasks.push({ ...task, dueInfo: info, taskDateStr: dateKey });
                    }
                }
            });
        });

        if (urgentTasks.length > 0) {
            elements.urgentDeadlineBanner.classList.remove('hidden');

            const overdueCount = urgentTasks.filter(t => t.dueInfo.isOverdue).length;
            if (overdueCount > 0) {
                elements.bannerTitle.textContent = `🚨 High Alert: ${overdueCount} Overdue & ${urgentTasks.length - overdueCount} Urgent Task${urgentTasks.length > 1 ? 's' : ''}!`;
            } else {
                elements.bannerTitle.textContent = `🚨 High Alert: ${urgentTasks.length} Urgent Task${urgentTasks.length > 1 ? 's' : ''} Require Attention!`;
            }

            elements.urgentCardsContainer.innerHTML = '';

            urgentTasks.forEach(task => {
                const card = document.createElement('div');
                card.className = `urgent-red-card ${task.dueInfo.duePillClass}`;
                card.dataset.id = task.id;

                const icon = task.dueInfo.isOverdue ? '🚨' : (task.dueInfo.diffDays === 0 ? '🔴' : '🔥');

                card.innerHTML = `
                    <div class="urgent-red-left">
                        <span class="urgent-red-icon">${icon}</span>
                        <div class="urgent-red-content">
                            <h4 class="urgent-red-title">${escapeHTML(task.title)}</h4>
                            <span class="urgent-red-status ${task.dueInfo.duePillClass}">${escapeHTML(task.dueInfo.dueLabel)}</span>
                        </div>
                    </div>
                    <div class="urgent-red-actions">
                        ${task.dueInfo.isOverdue ? `
                            <button class="btn-urgent-action reschedule" title="Reschedule to Today">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
                                <span>Today</span>
                            </button>
                        ` : ''}
                        <button class="btn-urgent-action edit" title="Edit Task">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                            <span>Edit</span>
                        </button>
                        <button class="btn-urgent-action complete" title="Mark Done">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            <span>Mark Done</span>
                        </button>
                    </div>
                `;

                const rescheduleBtn = card.querySelector('.btn-urgent-action.reschedule');
                if (rescheduleBtn) {
                    rescheduleBtn.addEventListener('click', () => {
                        updateTaskDueDate(task.id, toISODateString(new Date()));
                    });
                }

                const editBtn = card.querySelector('.btn-urgent-action.edit');
                if (editBtn) {
                    editBtn.addEventListener('click', () => openEditModal(task));
                }

                const completeBtn = card.querySelector('.btn-urgent-action.complete');
                if (completeBtn) {
                    completeBtn.addEventListener('click', () => toggleTaskComplete(task.id));
                }

                elements.urgentCardsContainer.appendChild(card);
            });
        } else {
            elements.urgentDeadlineBanner.classList.add('hidden');
            elements.urgentCardsContainer.innerHTML = '';
        }
    }

    function renderTaskLists(tasks) {
        elements.pendingTaskList.innerHTML = '';
        elements.completedTaskList.innerHTML = '';

        // 1. Filter tasks by status, search, and category
        const filtered = filterTasks(tasks, {
            status: activeFilter,
            search: searchQuery,
            category: activeCategory
        });

        // 2. Sort tasks by activeSort
        const sorted = sortTasks(filtered, activeSort);

        const pendingTasks = sorted.filter(t => !t.completed);
        const completedTasks = sorted.filter(t => t.completed);

        elements.pendingCountBadge.textContent = pendingTasks.length;
        elements.completedCountBadge.textContent = completedTasks.length;

        const isSearching = searchQuery.trim() !== '';
        if (elements.btnClearSearch) {
            elements.btnClearSearch.classList.toggle('hidden', !isSearching);
        }

        if (filtered.length === 0 && (isSearching || activeCategory !== 'all')) {
            if (elements.searchEmptyState) {
                elements.searchEmptyState.classList.remove('hidden');
                elements.searchEmptyMessage.textContent = isSearching
                    ? `No tasks match "${searchQuery.trim()}".`
                    : `No tasks found in category "${activeCategory}".`;
            }
            elements.pendingEmptyState.classList.add('hidden');
            elements.completedEmptyState.classList.add('hidden');
            return;
        } else if (elements.searchEmptyState) {
            elements.searchEmptyState.classList.add('hidden');
        }

        // Tab Filter Display
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
        const isPinned = Boolean(task.isPinned);
        card.className = `task-card ${task.completed ? 'completed' : ''} ${isPinned ? 'pinned' : ''}`;
        card.dataset.id = task.id;
        card.setAttribute('draggable', 'true');

        const urgencyInfo = computeUrgencyAndPriority(
            task.dueDate,
            task.priority || 'auto',
            task.alertDays != null ? task.alertDays : 2,
            currentDate
        );
        const effectivePriority = urgencyInfo.priority;
        const formattedTime = task.time ? formatTimeDisplay(task.time) : '';

        const categoryDisplayMap = {
            'Health': 'Health & Fitness',
            'Health & Fitness': 'Health & Fitness'
        };
        const displayCategory = categoryDisplayMap[task.category] || task.category;

        const hasSubtasks = Array.isArray(task.subtasks) && task.subtasks.length > 0;
        const subProgress = getSubtaskProgress(task.subtasks);
        const hasNotes = Boolean(task.notes && task.notes.trim());

        card.innerHTML = `
            <div class="task-left">
                <span class="drag-handle" title="Drag to reorder" aria-label="Drag handle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                </span>
                
                <div class="task-checkbox-wrapper">
                    <input type="checkbox" ${task.completed ? 'checked' : ''} aria-label="Mark task completed">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>

                <div class="task-content">
                    <span class="task-title">${escapeHTML(task.title)}</span>
                    <div class="task-meta-row">
                        ${isPinned ? `<span class="pinned-badge">📌 Pinned</span>` : ''}
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
                                ${escapeHTML(displayCategory)}
                            </span>
                        ` : ''}
                        ${hasSubtasks ? `
                            <button type="button" class="task-subtasks-summary-btn" title="Toggle subtasks checklist">
                                ☑️ ${subProgress.completed}/${subProgress.total} Subtasks
                            </button>
                        ` : ''}
                        ${hasNotes ? `
                            <button type="button" class="task-notes-toggle" title="Toggle notes preview">
                                📝 Notes
                            </button>
                        ` : ''}
                        ${(task.completed && task.createdDate && task.createdDate !== (task.completedDate || toISODateString(currentDate))) ? `
                            <span class="meta-tag">
                                📅 Created ${escapeHTML(task.createdDate)}
                            </span>
                        ` : ''}
                    </div>

                    ${hasSubtasks ? `
                        <div class="task-subtasks-drawer hidden">
                            ${task.subtasks.map(s => `
                                <label class="subtask-item ${s.completed ? 'completed' : ''}">
                                    <input type="checkbox" class="subtask-checkbox" data-sub-id="${s.id}" ${s.completed ? 'checked' : ''}>
                                    <span class="subtask-text">${escapeHTML(s.text)}</span>
                                </label>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${hasNotes ? `
                        <div class="task-notes-drawer hidden">${escapeHTML(task.notes)}</div>
                    ` : ''}
                </div>
            </div>

            <div class="task-actions">
                ${!task.completed ? `
                    <button class="btn-task-action pin ${isPinned ? 'active' : ''}" title="${isPinned ? 'Unpin Task' : 'Pin to Top'}" aria-label="Pin Task">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
                    </button>
                    <button class="btn-task-action extend" title="Extend Deadline" aria-label="Extend Deadline">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M12 14v4"/><path d="M10 16h4"/></svg>
                    </button>
                ` : ''}
                <button class="btn-task-action duplicate" title="Duplicate Task" aria-label="Duplicate Task">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
                <button class="btn-task-action edit" title="Edit Task" aria-label="Edit Task">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </button>
                <button class="btn-task-action delete" title="Delete Task" aria-label="Delete Task">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `;

        const checkbox = card.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', () => toggleTaskComplete(task.id));

        // Subtasks drawer toggle
        const subtasksSummaryBtn = card.querySelector('.task-subtasks-summary-btn');
        if (subtasksSummaryBtn) {
            subtasksSummaryBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const drawer = card.querySelector('.task-subtasks-drawer');
                if (drawer) drawer.classList.toggle('hidden');
            });
        }

        // Subtask item check
        card.querySelectorAll('.subtask-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                toggleTaskSubtask(task.id, cb.dataset.subId);
            });
        });

        // Notes drawer toggle
        const notesToggleBtn = card.querySelector('.task-notes-toggle');
        if (notesToggleBtn) {
            notesToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const drawer = card.querySelector('.task-notes-drawer');
                if (drawer) drawer.classList.toggle('hidden');
            });
        }

        // Pin button
        const pinBtn = card.querySelector('.btn-task-action.pin');
        if (pinBtn) {
            pinBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePinTask(task.id);
            });
        }

        // Duplicate button
        const duplicateBtn = card.querySelector('.btn-task-action.duplicate');
        if (duplicateBtn) {
            duplicateBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                duplicateTask(task.id);
            });
        }

        const extendBtn = card.querySelector('.btn-task-action.extend');
        if (extendBtn) {
            extendBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openExtendModal(task);
            });
        }

        const editBtn = card.querySelector('.btn-task-action.edit');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(task);
        });

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
    function addTask(title, priority, dueDate, alertDays, time, category, notes = '', subtasks = [], isPinned = false) {
        if (!title || !title.trim()) return;

        const dateStr = toISODateString(currentDate);
        const allData = loadAllData();
        if (!allData[dateStr]) {
            allData[dateStr] = [];
        }

        const parsedAlert = parseInt(alertDays, 10);
        const newTask = {
            id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            title: title.trim(),
            priority: priority || 'auto',
            dueDate: dueDate || '',
            alertDays: (!isNaN(parsedAlert) && parsedAlert >= 0) ? parsedAlert : 2,
            time: time || '',
            category: category || 'General',
            notes: (notes || '').trim(),
            subtasks: Array.isArray(subtasks) ? subtasks : [],
            isPinned: Boolean(isPinned),
            completed: false,
            createdDate: dateStr,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        allData[dateStr].unshift(newTask);
        saveAllData(allData);

        activeFilter = 'all';
        searchQuery = '';
        draftSubtasks = [];
        renderDraftSubtaskChips();
        if (elements.addExtraContainer) elements.addExtraContainer.classList.add('hidden');
        if (elements.extraToggleLabel) elements.extraToggleLabel.textContent = 'Add Notes & Subtasks';
        if (elements.taskNotesInput) elements.taskNotesInput.value = '';
        if (elements.taskPinInput) elements.taskPinInput.checked = false;
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

        dataKeys(allData).forEach(dateKey => {
            const task = allData[dateKey].find(t => t.id === taskId);
            if (task) {
                found = true;
                task.completed = !task.completed;

                if (task.completed) {
                    task.completedDate = currentActiveDateStr;
                    task.completedAt = new Date().toISOString();
                    task.updatedAt = new Date().toISOString();
                    playAudioChime('check');
                    showToast('Task completed! Marked as done.', 'success');
                } else {
                    delete task.completedDate;
                    delete task.completedAt;
                    task.updatedAt = new Date().toISOString();
                    playAudioChime('uncheck');
                    showToast('Task re-opened as pending', 'info');
                }
            }
        });

        if (found) {
            saveAllData(allData);
            renderAll();

            // Trigger confetti if all tasks for the current viewed day are completed!
            const tasks = getTasksForDate(currentActiveDateStr);
            const total = tasks.length;
            const completed = tasks.filter(t => t.completed).length;
            if (total > 0 && completed === total) {
                playAudioChime('fanfare');
                triggerConfetti();
            }
        }
    }

    function deleteTask(taskId) {
        const cardEl = document.querySelector(`.task-card[data-id="${taskId}"]`);
        if (cardEl) {
            cardEl.classList.add('deleting');
        }

        setTimeout(() => {
            const allData = loadAllData();
            let deletedTask = null;
            let deletedFromDate = null;

            dataKeys(allData).forEach(dateKey => {
                const idx = allData[dateKey].findIndex(t => t.id === taskId);
                if (idx !== -1) {
                    deletedTask = allData[dateKey][idx];
                    deletedFromDate = dateKey;
                    allData[dateKey].splice(idx, 1);
                }
            });

            if (deletedTask) {
                if (!allData._meta) allData._meta = { deleted: [] };
                if (!Array.isArray(allData._meta.deleted)) allData._meta.deleted = [];
                if (!allData._meta.deleted.includes(taskId)) allData._meta.deleted.push(taskId);

                saveAllData(allData);
                renderAll();

                const undo = createUndoAction('delete', { dateKey: deletedFromDate, task: deletedTask });
                showToast('Task deleted successfully', 'info', {
                    text: 'Undo',
                    onClick: () => {
                        const curData = loadAllData();
                        applyUndoAction(curData, undo);
                        saveAllData(curData);
                        renderAll();
                        showToast('Task restored!', 'success');
                    }
                });
            }
        }, 150);
    }

    function togglePinTask(taskId) {
        const allData = loadAllData();
        let updated = false;
        let isNowPinned = false;

        dataKeys(allData).forEach(dateKey => {
            const task = allData[dateKey].find(t => t.id === taskId);
            if (task) {
                task.isPinned = !task.isPinned;
                task.updatedAt = new Date().toISOString();
                updated = true;
                isNowPinned = task.isPinned;
            }
        });

        if (updated) {
            saveAllData(allData);
            renderAll();
            showToast(isNowPinned ? 'Task pinned to top 📌' : 'Task unpinned');
        }
    }

    function duplicateTask(taskId) {
        const allData = loadAllData();
        let cloned = null;
        const currentActiveDateStr = toISODateString(currentDate);

        dataKeys(allData).forEach(dateKey => {
            const task = allData[dateKey].find(t => t.id === taskId);
            if (task) {
                cloned = {
                    ...JSON.parse(JSON.stringify(task)),
                    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                    title: `${task.title} (Copy)`,
                    completed: false,
                    createdDate: currentActiveDateStr,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                delete cloned.completedDate;
                delete cloned.completedAt;
            }
        });

        if (cloned) {
            if (!allData[currentActiveDateStr]) allData[currentActiveDateStr] = [];
            allData[currentActiveDateStr].unshift(cloned);
            saveAllData(allData);
            renderAll();
            showToast('Task duplicated successfully! 📑', 'success');
        }
    }

    function toggleTaskSubtask(taskId, subtaskId) {
        const allData = loadAllData();
        let found = false;

        dataKeys(allData).forEach(dateKey => {
            const task = allData[dateKey].find(t => t.id === taskId);
            if (task && Array.isArray(task.subtasks)) {
                task.subtasks = toggleSubtaskInList(task.subtasks, subtaskId);
                task.updatedAt = new Date().toISOString();
                found = true;
            }
        });

        if (found) {
            playAudioChime('check');
            saveAllData(allData);
            renderAll();
        }
    }

    function renderDraftSubtaskChips() {
        if (!elements.subtaskDraftChips) return;
        elements.subtaskDraftChips.innerHTML = '';
        draftSubtasks.forEach((sub, idx) => {
            const chip = document.createElement('span');
            chip.className = 'subtask-draft-chip';
            chip.innerHTML = `<span>${escapeHTML(sub.text)}</span> <button type="button" class="btn-remove-draft" data-idx="${idx}" aria-label="Remove">&times;</button>`;
            chip.querySelector('.btn-remove-draft').addEventListener('click', () => {
                draftSubtasks.splice(idx, 1);
                renderDraftSubtaskChips();
            });
            elements.subtaskDraftChips.appendChild(chip);
        });
    }

    function renderEditModalSubtasks() {
        if (!elements.editSubtasksList) return;
        elements.editSubtasksList.innerHTML = '';
        if (editModalSubtasks.length === 0) {
            elements.editSubtasksList.innerHTML = '<span style="font-size:0.78rem; color:var(--text-muted);">No subtasks added yet. Type below to add items.</span>';
            return;
        }

        editModalSubtasks.forEach((sub, idx) => {
            const item = document.createElement('div');
            item.className = 'subtask-edit-item';
            item.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <input type="checkbox" ${sub.completed ? 'checked' : ''} data-idx="${idx}" style="cursor:pointer; width:15px; height:15px;">
                    <span style="${sub.completed ? 'text-decoration:line-through; color:var(--text-light);' : ''}">${escapeHTML(sub.text)}</span>
                </div>
                <button type="button" class="btn-remove-subtask" data-idx="${idx}" title="Delete Subtask">&times;</button>
            `;

            item.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
                editModalSubtasks[idx].completed = e.target.checked;
                renderEditModalSubtasks();
            });

            item.querySelector('.btn-remove-subtask').addEventListener('click', () => {
                editModalSubtasks.splice(idx, 1);
                renderEditModalSubtasks();
            });

            elements.editSubtasksList.appendChild(item);
        });
    }

    function updateTask(taskId, newTitle, newPriority, newDueDate, newAlertDays, newTime, newCategory, newNotes = '', newSubtasks = [], newIsPinned = false) {
        if (!newTitle || !newTitle.trim()) {
            showToast('Task description cannot be empty', 'error');
            return;
        }

        const allData = loadAllData();
        let updated = false;

        dataKeys(allData).forEach(dateKey => {
            const task = allData[dateKey].find(t => t.id === taskId);
            if (task) {
                task.title = newTitle.trim();
                task.priority = newPriority || 'auto';
                task.dueDate = newDueDate || '';

                const parsedAlert = parseInt(newAlertDays, 10);
                task.alertDays = (!isNaN(parsedAlert) && parsedAlert >= 0) ? parsedAlert : 2;

                task.time = newTime || '';
                task.category = newCategory || 'General';
                task.notes = (newNotes || '').trim();
                task.subtasks = Array.isArray(newSubtasks) ? newSubtasks : [];
                task.isPinned = Boolean(newIsPinned);
                task.updatedAt = new Date().toISOString();
                updated = true;
            }
        });

        if (updated) {
            saveAllData(allData);
            renderAll();
            showToast('Task updated successfully', 'success');
        }
    }

    function updateTaskDueDate(taskId, newDueDate) {
        const allData = loadAllData();
        let updated = false;

        dataKeys(allData).forEach(dateKey => {
            const task = allData[dateKey].find(t => t.id === taskId);
            if (task) {
                task.dueDate = newDueDate;
                task.updatedAt = new Date().toISOString();
                updated = true;
            }
        });

        if (updated) {
            saveAllData(allData);
            renderAll();
            showToast(`Task deadline updated to ${newDueDate}`, 'success');
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
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', card.dataset.id);
                }
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                draggedTaskId = null;
            });
        });

        lists.forEach(list => {
            list.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
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
                delete task.completedDate;
                delete task.completedAt;
                task.updatedAt = new Date().toISOString();
                newOrder.push(task);
            }
        });

        completedDomCards.forEach(card => {
            const task = taskMap.get(card.dataset.id);
            if (task) {
                task.completed = true;
                if (!task.completedDate) task.completedDate = dateStr;
                task.updatedAt = new Date().toISOString();
                newOrder.push(task);
            }
        });

        saveTasksForDate(dateStr, newOrder);
        renderAll();
    }

    // ==========================================
    // MODAL DIALOGS
    // ==========================================
    function openExtendModal(task) {
        targetExtendTask = task;
        elements.extendTaskTitleDisplay.textContent = `Task: "${task.title}"`;
        elements.extendCurrentDateDisplay.textContent = task.dueDate ? `Current End Date: ${task.dueDate}` : `Current End Date: Not set`;

        const today = new Date();
        const minDateStr = toISODateString(today);
        elements.extendCustomDate.min = minDateStr;

        elements.extendCustomDate.value = task.dueDate || minDateStr;

        const presetBtns = elements.extendModal.querySelectorAll('.btn-extend-preset');
        presetBtns.forEach(b => b.classList.remove('active'));

        elements.extendModal.classList.remove('hidden');
    }

    function closeExtendModal() {
        elements.extendModal.classList.add('hidden');
        targetExtendTask = null;
    }

    function openEditModal(task) {
        elements.editTaskId.value = task.id;
        elements.editTaskTitle.value = task.title || '';
        elements.editTaskPriority.value = task.priority || 'auto';
        elements.editTaskDueDate.value = task.dueDate || '';
        elements.editTaskAlertDays.value = task.alertDays != null ? task.alertDays : 2;
        elements.editTaskTime.value = task.time || '';

        let catValue = task.category || 'General';
        if (catValue === 'Health & Fitness') catValue = 'Health';
        elements.editTaskCategory.value = catValue;

        if (elements.editTaskNotes) {
            elements.editTaskNotes.value = task.notes || '';
        }
        if (elements.editTaskPin) {
            elements.editTaskPin.checked = Boolean(task.isPinned);
        }

        editModalSubtasks = Array.isArray(task.subtasks) ? JSON.parse(JSON.stringify(task.subtasks)) : [];
        renderEditModalSubtasks();

        elements.editModal.classList.remove('hidden');
        elements.editTaskTitle.focus();
    }

    function closeEditModal() {
        elements.editModal.classList.add('hidden');
        editModalSubtasks = [];
    }

    function openAnalyticsModal() {
        if (!elements.analyticsModal) return;
        const allData = loadAllData();
        const stats = calculateProductivityStats(allData, currentDate);

        if (elements.statsCurrentStreak) elements.statsCurrentStreak.textContent = stats.currentStreak;
        if (elements.statsBestStreak) elements.statsBestStreak.textContent = stats.bestStreak;
        if (elements.statsCompletionRate) elements.statsCompletionRate.textContent = `${stats.completionRate}%`;
        if (elements.statsLifetimeCompleted) elements.statsLifetimeCompleted.textContent = stats.totalCompleted;

        // Render 7-day bar chart
        if (elements.analyticsChartContainer) {
            elements.analyticsChartContainer.innerHTML = '';
            const maxVal = Math.max(...stats.recentDays.map(d => d.total), 1);

            stats.recentDays.forEach(day => {
                const heightPct = Math.round((day.completed / maxVal) * 100);
                const col = document.createElement('div');
                col.className = 'chart-col';
                col.innerHTML = `
                    <span class="chart-count">${day.completed}</span>
                    <div class="chart-bar-wrap" title="${day.date}: ${day.completed} of ${day.total} tasks completed">
                        <div class="chart-bar-fill" style="height: ${Math.max(heightPct, 8)}%;"></div>
                    </div>
                    <span class="chart-label">${day.dayName}</span>
                `;
                elements.analyticsChartContainer.appendChild(col);
            });
        }

        // Render Category Breakdown
        if (elements.analyticsCategoryContainer) {
            elements.analyticsCategoryContainer.innerHTML = '';
            const catNames = Object.keys(stats.categoryCounts);
            let hasAnyCats = false;

            catNames.forEach(cat => {
                const c = stats.categoryCounts[cat];
                if (c.total > 0) {
                    hasAnyCats = true;
                    const pct = Math.round((c.completed / c.total) * 100);
                    const row = document.createElement('div');
                    row.className = 'category-row';
                    row.innerHTML = `
                        <div class="category-row-meta">
                            <span>${cat}</span>
                            <span>${c.completed} / ${c.total} (${pct}%)</span>
                        </div>
                        <div class="category-bar-track">
                            <div class="category-bar-fill" style="width: ${pct}%;"></div>
                        </div>
                    `;
                    elements.analyticsCategoryContainer.appendChild(row);
                }
            });

            if (!hasAnyCats) {
                elements.analyticsCategoryContainer.innerHTML = '<span style="font-size:0.82rem; color:var(--text-muted);">No categorized tasks created yet.</span>';
            }
        }

        elements.analyticsModal.classList.remove('hidden');
    }

    function closeAnalyticsModal() {
        if (elements.analyticsModal) elements.analyticsModal.classList.add('hidden');
    }

    function openShortcutsModal() {
        if (elements.shortcutsModal) elements.shortcutsModal.classList.remove('hidden');
    }

    function closeShortcutsModal() {
        if (elements.shortcutsModal) elements.shortcutsModal.classList.add('hidden');
    }

    // ==========================================
    // EVENT BINDINGS
    // ==========================================
    function bindEvents() {
        // Theme
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

        elements.btnDateDisplay.addEventListener('click', () => {
            try {
                if (elements.datePickerInput.showPicker) {
                    elements.datePickerInput.showPicker();
                } else {
                    elements.datePickerInput.click();
                }
            } catch (e) {
                elements.datePickerInput.click();
            }
        });

        elements.datePickerInput.addEventListener('change', (e) => {
            if (e.target.value) {
                currentDate = parseISODateString(e.target.value);
                renderAll();
            }
        });

        // Add Task Form
        elements.addTaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = elements.taskTitleInput.value;
            const priority = elements.taskPrioritySelect.value;
            const dueDate = elements.taskDueDateInput.value;
            const alertDays = elements.taskAlertDaysInput.value;
            const time = elements.taskTimeInput.value;
            const category = elements.taskCategorySelect.value;
            const notes = elements.taskNotesInput ? elements.taskNotesInput.value : '';
            const subtasks = [...draftSubtasks];
            const isPinned = elements.taskPinInput ? elements.taskPinInput.checked : false;

            addTask(title, priority, dueDate, alertDays, time, category, notes, subtasks, isPinned);

            elements.taskTitleInput.value = '';
            elements.taskDueDateInput.value = '';
            elements.taskTimeInput.value = '';
            if (elements.taskNotesInput) elements.taskNotesInput.value = '';
            if (elements.taskPinInput) elements.taskPinInput.checked = false;
            draftSubtasks = [];
            renderDraftSubtaskChips();
            elements.taskTitleInput.focus();
        });

        // Add Task - Quick Deadline Preset Chips
        const presetChips = document.querySelectorAll('.deadline-preset-chip');
        presetChips.forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                const preset = chip.dataset.preset;
                const target = new Date();
                if (preset === 'tomorrow') {
                    target.setDate(target.getDate() + 1);
                } else if (preset === '+3d') {
                    target.setDate(target.getDate() + 3);
                } else if (preset === '+7d') {
                    target.setDate(target.getDate() + 7);
                }
                if (elements.taskDueDateInput) {
                    elements.taskDueDateInput.value = toISODateString(target);
                }
            });
        });

        // Add Task - Extra Options Drawer Toggle
        if (elements.btnToggleAddExtra && elements.addExtraContainer) {
            elements.btnToggleAddExtra.addEventListener('click', () => {
                elements.addExtraContainer.classList.toggle('hidden');
                const isExpanded = !elements.addExtraContainer.classList.contains('hidden');
                elements.btnToggleAddExtra.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
            });
        }

        // Add Task - Draft Subtasks Builder
        const handleAddDraftSubtask = () => {
            if (!elements.taskSubtaskDraftInput) return;
            const text = elements.taskSubtaskDraftInput.value.trim();
            if (!text) return;
            draftSubtasks.push(createSubtask(text));
            elements.taskSubtaskDraftInput.value = '';
            renderDraftSubtaskChips();
            elements.taskSubtaskDraftInput.focus();
        };

        if (elements.btnAddDraftSubtask) {
            elements.btnAddDraftSubtask.addEventListener('click', handleAddDraftSubtask);
        }
        if (elements.taskSubtaskDraftInput) {
            elements.taskSubtaskDraftInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDraftSubtask();
                }
            });
        }

        // Notifications
        if (elements.btnNotifications) {
            elements.btnNotifications.addEventListener('click', requestNotificationPermission);
        }

        // Backup & Restore
        if (elements.btnBackup) {
            elements.btnBackup.addEventListener('click', openBackupModal);
        }
        if (elements.btnCloseBackupModal) {
            elements.btnCloseBackupModal.addEventListener('click', closeBackupModal);
        }
        if (elements.backupModal) {
            elements.backupModal.addEventListener('click', (e) => {
                if (e.target === elements.backupModal) closeBackupModal();
            });
        }
        if (elements.btnExportBackup) {
            elements.btnExportBackup.addEventListener('click', exportDataBackup);
        }
        if (elements.btnExportCsv) {
            elements.btnExportCsv.addEventListener('click', () => {
                const allData = loadAllData();
                const csvText = generateCSV(allData);
                const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `daytask_export_${toISODateString(new Date())}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast('Tasks exported to CSV successfully!', 'success');
            });
        }
        if (elements.btnSendTestEmail) {
            elements.btnSendTestEmail.addEventListener('click', async () => {
                elements.btnSendTestEmail.disabled = true;
                showToast('Sending test email via SMTP...', 'info');
                try {
                    const res = await fetch('/api/send-test-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast('Test email sent to shpranav00009@gmail.com! 📬', 'success');
                    } else {
                        showToast('Failed to send email: ' + (data.error || 'Server error'), 'error');
                    }
                } catch (e) {
                    showToast('Could not reach sync server', 'error');
                } finally {
                    elements.btnSendTestEmail.disabled = false;
                }
            });
        }
        if (elements.backupFileInput) {
            elements.backupFileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    importDataBackup(e.target.files[0]);
                }
            });
        }

        // Search Input
        elements.taskSearchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            const tasks = getTasksForDate(toISODateString(currentDate));
            renderTaskLists(tasks);
        });

        if (elements.btnClearSearch) {
            elements.btnClearSearch.addEventListener('click', () => {
                searchQuery = '';
                elements.taskSearchInput.value = '';
                elements.taskSearchInput.focus();
                const tasks = getTasksForDate(toISODateString(currentDate));
                renderTaskLists(tasks);
            });
        }

        if (elements.btnResetSearch) {
            elements.btnResetSearch.addEventListener('click', () => {
                searchQuery = '';
                elements.taskSearchInput.value = '';
                elements.taskSearchInput.focus();
                const tasks = getTasksForDate(toISODateString(currentDate));
                renderTaskLists(tasks);
            });
        }

        // Filter Tabs
        elements.filterTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (btn) {
                elements.filterTabs.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-selected', 'true');
                activeFilter = btn.dataset.filter;
                const tasks = getTasksForDate(toISODateString(currentDate));
                renderTaskLists(tasks);
            }
        });

        // Toolbar Sorting Select
        if (elements.taskSortSelect) {
            elements.taskSortSelect.addEventListener('change', (e) => {
                activeSort = e.target.value;
                const tasks = getTasksForDate(toISODateString(currentDate));
                renderTaskLists(tasks);
            });
        }

        // Toolbar Category Filter Select
        if (elements.categoryFilterSelect) {
            elements.categoryFilterSelect.addEventListener('change', (e) => {
                activeCategory = e.target.value;
                const tasks = getTasksForDate(toISODateString(currentDate));
                renderTaskLists(tasks);
            });
        }

        // Bulk Actions Menu
        if (elements.btnBulkMenu && elements.bulkMenuDropdown) {
            elements.btnBulkMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                elements.bulkMenuDropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!elements.bulkMenuDropdown.classList.contains('hidden') &&
                    !e.target.closest('#bulk-menu-dropdown') &&
                    !e.target.closest('#btn-bulk-menu')) {
                    elements.bulkMenuDropdown.classList.add('hidden');
                }
            });
        }

        // Batch Actions
        if (elements.btnBatchCompleteAll) {
            elements.btnBatchCompleteAll.addEventListener('click', () => {
                const dateStr = toISODateString(currentDate);
                const allData = loadAllData();
                const result = batchMarkAllComplete(allData, dateStr);
                saveAllData(allData);
                renderAll();
                if (elements.bulkMenuDropdown) elements.bulkMenuDropdown.classList.add('hidden');
                playAudioChime('fanfare');
                showToast(`Marked ${result.count} task(s) complete! 🎉`, 'success');
            });
        }

        if (elements.btnBatchMoveTomorrow) {
            elements.btnBatchMoveTomorrow.addEventListener('click', () => {
                const dateStr = toISODateString(currentDate);
                const tomorrow = new Date(currentDate);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const tomorrowStr = toISODateString(tomorrow);

                const allData = loadAllData();
                const result = batchMovePending(allData, dateStr, tomorrowStr);
                saveAllData(allData);
                renderAll();
                if (elements.bulkMenuDropdown) elements.bulkMenuDropdown.classList.add('hidden');
                showToast(`Moved ${result.count} pending task(s) to tomorrow`, 'info');
            });
        }

        if (elements.btnBatchClearCompleted) {
            elements.btnBatchClearCompleted.addEventListener('click', () => {
                const dateStr = toISODateString(currentDate);
                const allData = loadAllData();
                const result = batchClearCompleted(allData, dateStr);
                if (result.count > 0) {
                    saveAllData(allData);
                    renderAll();
                    showToast(`Cleared ${result.count} completed task(s)`, 'info');
                } else {
                    showToast('No completed tasks to clear', 'info');
                }
                if (elements.bulkMenuDropdown) elements.bulkMenuDropdown.classList.add('hidden');
            });
        }

        if (elements.btnCopyMarkdownSummary) {
            elements.btnCopyMarkdownSummary.addEventListener('click', () => {
                const dateStr = toISODateString(currentDate);
                const tasks = getTasksForDate(dateStr);
                const md = generateMarkdownSummary(tasks, dateStr);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(md).then(() => {
                        showToast('Markdown summary copied to clipboard! 📋', 'success');
                    }).catch(() => {
                        showToast('Failed to copy to clipboard', 'error');
                    });
                } else {
                    showToast('Clipboard access not supported', 'error');
                }
                if (elements.bulkMenuDropdown) elements.bulkMenuDropdown.classList.add('hidden');
            });
        }

        // Sound Toggle
        if (elements.btnSound) {
            elements.btnSound.addEventListener('click', toggleSound);
        }

        // Analytics Modal Controls
        if (elements.btnAnalytics) {
            elements.btnAnalytics.addEventListener('click', openAnalyticsModal);
        }
        if (elements.headerStreakBadge) {
            elements.headerStreakBadge.addEventListener('click', openAnalyticsModal);
        }
        if (elements.btnCloseAnalyticsModal) {
            elements.btnCloseAnalyticsModal.addEventListener('click', closeAnalyticsModal);
        }
        if (elements.analyticsModal) {
            elements.analyticsModal.addEventListener('click', (e) => {
                if (e.target === elements.analyticsModal) closeAnalyticsModal();
            });
        }

        // Keyboard Shortcuts Modal Controls
        if (elements.btnHelp) {
            elements.btnHelp.addEventListener('click', openShortcutsModal);
        }
        if (elements.btnCloseShortcutsModal) {
            elements.btnCloseShortcutsModal.addEventListener('click', closeShortcutsModal);
        }
        if (elements.shortcutsModal) {
            elements.shortcutsModal.addEventListener('click', (e) => {
                if (e.target === elements.shortcutsModal) closeShortcutsModal();
            });
        }

        // Edit Modal Events
        elements.btnCloseEditModal.addEventListener('click', closeEditModal);
        elements.btnCancelEdit.addEventListener('click', closeEditModal);
        elements.editModal.addEventListener('click', (e) => {
            if (e.target === elements.editModal) closeEditModal();
        });

        // Edit Modal Subtasks Builder
        const handleAddEditSubtask = () => {
            if (!elements.editNewSubtaskInput) return;
            const text = elements.editNewSubtaskInput.value.trim();
            if (!text) return;
            editModalSubtasks.push(createSubtask(text));
            elements.editNewSubtaskInput.value = '';
            renderEditModalSubtasks();
            elements.editNewSubtaskInput.focus();
        };

        if (elements.btnAddEditSubtask) {
            elements.btnAddEditSubtask.addEventListener('click', handleAddEditSubtask);
        }
        if (elements.editNewSubtaskInput) {
            elements.editNewSubtaskInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddEditSubtask();
                }
            });
        }

        elements.editTaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = elements.editTaskId.value;
            const title = elements.editTaskTitle.value;
            const priority = elements.editTaskPriority.value;
            const dueDate = elements.editTaskDueDate.value;
            const alertDays = elements.editTaskAlertDays.value;
            const time = elements.editTaskTime.value;
            const category = elements.editTaskCategory.value;
            const notes = elements.editTaskNotes ? elements.editTaskNotes.value : '';
            const isPinned = elements.editTaskPin ? elements.editTaskPin.checked : false;

            updateTask(id, title, priority, dueDate, alertDays, time, category, notes, editModalSubtasks, isPinned);
            closeEditModal();
        });

        // Extend Modal Events
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
                const today = new Date();
                let baseDate = new Date();

                // If task end date is in the future, extend from end date; if overdue, extend from today!
                if (targetExtendTask && targetExtendTask.dueDate && calendarDayDifference(today, targetExtendTask.dueDate) >= 0) {
                    baseDate = parseISODateString(targetExtendTask.dueDate);
                }
                
                baseDate.setDate(baseDate.getDate() + daysToAdd);
                elements.extendCustomDate.value = toISODateString(baseDate);
            });
        });

        elements.btnSaveExtend.addEventListener('click', (e) => {
            e.preventDefault();
            const selectedDate = elements.extendCustomDate.value;
            if (selectedDate && targetExtendTask) {
                updateTaskDueDate(targetExtendTask.id, selectedDate);
                closeExtendModal();
            } else {
                showToast('Please select a valid date', 'error');
            }
        });

        // Tab Focus & Visibility Handling
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                renderAll();
                pullFromServer(false);
            }
        });

        window.addEventListener('focus', () => {
            renderAll();
            pullFromServer(false);
        });

        // Cross-tab storage synchronization
        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY_DATA || e.key === STORAGE_KEY_THEME) {
                renderAll();
            }
        });

        // Live urgency countdown refresh every 60 seconds (no full re-fetch)
        setInterval(() => {
            if (document.visibilityState === 'visible') {
                checkUrgentTaskDeadlines();
            }
        }, 60000);

        // Global Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            const activeEl = document.activeElement;
            const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA');

            // Escape closes open modals
            if (e.key === 'Escape') {
                if (!elements.editModal.classList.contains('hidden')) closeEditModal();
                if (!elements.extendModal.classList.contains('hidden')) closeExtendModal();
                if (elements.backupModal && !elements.backupModal.classList.contains('hidden')) closeBackupModal();
                if (elements.analyticsModal && !elements.analyticsModal.classList.contains('hidden')) closeAnalyticsModal();
                if (elements.shortcutsModal && !elements.shortcutsModal.classList.contains('hidden')) closeShortcutsModal();
                if (elements.bulkMenuDropdown && !elements.bulkMenuDropdown.classList.contains('hidden')) elements.bulkMenuDropdown.classList.add('hidden');
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
                } else if (e.key === 't' || e.key === 'T') {
                    currentDate = new Date();
                    renderAll();
                    showToast('Jumped to Today');
                } else if (e.key === 'a' || e.key === 'A') {
                    openAnalyticsModal();
                } else if (e.key === 's' || e.key === 'S') {
                    window.open('https://docs.google.com/spreadsheets/d/1qEQaXyeo_lEQwfSCEHsdbSOjnc0j-pBQtQDhk1PjKro/edit?pli=1&gid=0#gid=0', '_blank', 'noopener,noreferrer');
                } else if (e.key === 'm' || e.key === 'M') {
                    toggleSound();
                } else if (e.key === 'd' || e.key === 'D') {
                    toggleTheme();
                } else if (e.key === '?') {
                    openShortcutsModal();
                }
            }
        });
    }

    // ==========================================
    // CELEBRATION CONFETTI
    // ==========================================
    function triggerConfetti() {
        if (typeof window === 'undefined') return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            showToast('All tasks done! Phenomenal work!', 'success');
            return;
        }

        if (isConfettiRunning) return;
        isConfettiRunning = true;

        const canvas = elements.confettiCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const pieces = [];
        const count = 90;
        const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#0EA5E9', '#818CF8'];

        for (let i = 0; i < count; i++) {
            pieces.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height * 0.4 - canvas.height * 0.4,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                speed: Math.random() * 3 + 2,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 8 - 4
            });
        }

        let animationFrameId;
        const startTime = Date.now();

        function drawFrame() {
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

            if (Date.now() - startTime < 2800) {
                animationFrameId = requestAnimationFrame(drawFrame);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                cancelAnimationFrame(animationFrameId);
                isConfettiRunning = false;
            }
        }

        drawFrame();
    }

    // ==========================================
    // INITIALIZATION
    // ==========================================
    function init() {
        initTheme();
        bindEvents();
        renderAll();
        initRemoteSync();
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    return {
        toISODateString,
        parseISODateString,
        isSameDay,
        calendarDayDifference,
        formatTimeDisplay,
        escapeHTML,
        computeUrgencyAndPriority,
        mergeDataStores,
        dataKeys,
        taskTimestamp,
        createSubtask,
        getSubtaskProgress,
        toggleSubtaskInList,
        addSubtaskToList,
        removeSubtaskFromList,
        sortTasks,
        filterTasks,
        calculateStreak,
        calculateProductivityStats,
        generateCSV,
        generateMarkdownSummary,
        batchMarkAllComplete,
        batchMovePending,
        batchClearCompleted,
        createUndoAction,
        applyUndoAction
    };
});

