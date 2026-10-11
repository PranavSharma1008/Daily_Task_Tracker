/**
 * DayTask — Native Zero-Dependency SMTP Email Service & Background Reminder Engine
 * Powered by Node.js built-in TLS client (no npm packages required).
 */

const tls = require('node:tls');
const fs = require('node:fs');
const path = require('node:path');

// Email Configuration
const CONFIG = {
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpPort: parseInt(process.env.SMTP_PORT, 10) || 465,
    smtpUser: process.env.SMTP_USER || 'pranav2410991479@gmail.com',
    smtpPass: process.env.SMTP_PASS || 'ibduwgvxuwnmxmyh',
    notifyEmail: process.env.NOTIFY_EMAIL || 'shpranav00009@gmail.com',
    senderName: 'DayTask Reminder Engine',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1qEQaXyeo_lEQwfSCEHsdbSOjnc0j-pBQtQDhk1PjKro/edit?pli=1&gid=0#gid=0',
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    ledgerFile: path.join(__dirname, 'email-ledger.json')
};

// 4 Scheduled times daily for Google Sheets check-in
const SPREADSHEET_SCHEDULE = [
    { hour: 11, label: '11:00 AM' },
    { hour: 12, label: '12:00 PM' },
    { hour: 16, label: '4:00 PM' },
    { hour: 20, label: '8:00 PM' }
];

// ==========================================
// Native SMTP TLS Mail Dispatcher
// ==========================================
function sendSmtpMail({ from = CONFIG.smtpUser, to = CONFIG.notifyEmail, subject, html, text }) {
    return new Promise((resolve, reject) => {
        const socket = tls.connect(CONFIG.smtpPort, CONFIG.smtpHost, {
            rejectUnauthorized: false
        }, () => {});

        socket.setEncoding('utf8');

        let step = 0;
        let response = '';
        let timeout = setTimeout(() => {
            socket.destroy();
            reject(new Error('SMTP connection timed out'));
        }, 15000);

        socket.on('data', (data) => {
            response += data;
            
            // 220 Server banner greeting
            if (data.startsWith('220') && step === 0) {
                socket.write(`EHLO localhost\r\n`);
            }
            // 250 Response to EHLO
            else if (data.startsWith('250') && step === 0) {
                step = 1;
                socket.write(`AUTH LOGIN\r\n`);
            }
            // 334 Response to AUTH LOGIN (requesting username)
            else if (data.startsWith('334') && step === 1) {
                step = 2;
                socket.write(Buffer.from(CONFIG.smtpUser).toString('base64') + '\r\n');
            }
            // 334 Requesting password
            else if (data.startsWith('334') && step === 2) {
                step = 3;
                socket.write(Buffer.from(CONFIG.smtpPass).toString('base64') + '\r\n');
            }
            // 235 Authentication successful
            else if (data.startsWith('235') && step === 3) {
                step = 4;
                socket.write(`MAIL FROM:<${from}>\r\n`);
            }
            // 250 Response to MAIL FROM
            else if (data.startsWith('250') && step === 4) {
                step = 5;
                socket.write(`RCPT TO:<${to}>\r\n`);
            }
            // 250 Response to RCPT TO
            else if (data.startsWith('250') && step === 5) {
                step = 6;
                socket.write(`DATA\r\n`);
            }
            // 354 Start mail input
            else if (data.startsWith('354') && step === 6) {
                step = 7;
                const plainText = text || html.replace(/<[^>]+>/g, ' ');
                const boundary = '----=_Part_' + Date.now() + '_' + Math.random().toString(36).slice(2);
                
                const messageLines = [
                    `From: ${CONFIG.senderName} <${from}>`,
                    `To: <${to}>`,
                    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
                    `Date: ${new Date().toUTCString()}`,
                    `MIME-Version: 1.0`,
                    `Content-Type: multipart/alternative; boundary="${boundary}"`,
                    ``,
                    `--${boundary}`,
                    `Content-Type: text/plain; charset=UTF-8`,
                    `Content-Transfer-Encoding: 7bit`,
                    ``,
                    plainText,
                    ``,
                    `--${boundary}`,
                    `Content-Type: text/html; charset=UTF-8`,
                    `Content-Transfer-Encoding: 8bit`,
                    ``,
                    html,
                    ``,
                    `--${boundary}--`,
                    `\r\n.`
                ];
                socket.write(messageLines.join('\r\n') + '\r\n');
            }
            // 250 Message accepted for delivery
            else if (data.startsWith('250') && step === 7) {
                step = 8;
                clearTimeout(timeout);
                socket.write(`QUIT\r\n`);
                resolve({ success: true, message: 'Email sent successfully to ' + to });
            }
            // 5xx Error handling
            else if (data.startsWith('5')) {
                clearTimeout(timeout);
                socket.destroy();
                reject(new Error(`SMTP Error [step ${step}]: ${data.trim()}`));
            }
        });

        socket.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

// ==========================================
// Deduplication Ledger File Management
// ==========================================
function loadLedger(ledgerFile = CONFIG.ledgerFile) {
    try {
        if (fs.existsSync(ledgerFile)) {
            const data = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
            if (data && typeof data === 'object') return data;
        }
    } catch (e) {
        console.warn('[EmailService] Failed to read ledger:', e.message);
    }
    return { sent: {}, lastCheck: null };
}

function saveLedger(ledger, ledgerFile = CONFIG.ledgerFile) {
    try {
        const dir = path.dirname(ledgerFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2), 'utf8');
    } catch (e) {
        console.error('[EmailService] Failed to save ledger:', e.message);
    }
}

// ==========================================
// HTML Email Templates
// ==========================================
function renderTaskAlertHtml(task, urgencyLabel, diffDays) {
    const priority = (task.priority || 'Medium').toUpperCase();
    let badgeColor = '#EF4444'; // Red
    let statusHeading = 'HIGH ALERT REMINDER';

    if (diffDays < 0) {
        statusHeading = 'OVERDUE TASK ALERT';
        badgeColor = '#DC2626';
    } else if (diffDays === 0) {
        statusHeading = 'PRESENT DAY DEADLINE';
        badgeColor = '#E11D48';
    }

    const subtasksHtml = Array.isArray(task.subtasks) && task.subtasks.length > 0
        ? `
            <div style="margin-top:16px; padding:12px; background:#F8FAFC; border-radius:8px; border-left:4px solid #4F46E5;">
                <strong style="color:#1E293B; font-size:13px;">Checklist Progress:</strong>
                <ul style="margin:8px 0 0 16px; padding:0; color:#475569; font-size:13px; line-height:1.6;">
                    ${task.subtasks.map(s => `<li>${s.completed ? '✅ <strike>' + s.text + '</strike>' : '⬜ ' + s.text}</li>`).join('')}
                </ul>
            </div>
        `
        : '';

    const notesHtml = task.notes
        ? `
            <div style="margin-top:14px; padding:12px; background:#FEF3C7; border-radius:8px; color:#92400E; font-size:13px; line-height:1.5;">
                <strong>Notes:</strong> ${task.notes.replace(/\n/g, '<br>')}
            </div>
        `
        : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Remainder Alert: ${task.title}</title>
    </head>
    <body style="margin:0; padding:24px; background:#F1F5F9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width:580px; margin:0 auto; background:#FFFFFF; border-radius:12px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.06); border:1px solid #E2E8F0;">
            <!-- Header Banner -->
            <div style="background:linear-gradient(135deg, #1E1B4B 0%, #312E81 100%); padding:24px 28px; text-align:left;">
                <div style="display:inline-block; padding:4px 10px; background:${badgeColor}; color:#FFFFFF; border-radius:999px; font-size:11px; font-weight:800; letter-spacing:0.5px;">
                    🔥 ${statusHeading}
                </div>
                <h1 style="color:#FFFFFF; margin:12px 0 0 0; font-size:22px; font-weight:700; line-height:1.3;">
                    ${task.title}
                </h1>
            </div>

            <!-- Content Body -->
            <div style="padding:28px;">
                <p style="color:#475569; font-size:15px; line-height:1.5; margin:0 0 20px 0;">
                    Hello Pranav, this is an automated high-priority reminder from your <strong>DayTask</strong> engine.
                    The deadline for this task is approaching or overdue.
                </p>

                <!-- Metadata Grid -->
                <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
                    <tr>
                        <td style="padding:8px 0; color:#64748B; font-size:13px; width:120px;">📅 Due Date:</td>
                        <td style="padding:8px 0; color:#0F172A; font-size:14px; font-weight:700;">${task.dueDate || 'Today'}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0; color:#64748B; font-size:13px;">🚨 Urgency Status:</td>
                        <td style="padding:8px 0; color:${badgeColor}; font-size:14px; font-weight:700;">${urgencyLabel}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0; color:#64748B; font-size:13px;">⚡ Priority Level:</td>
                        <td style="padding:8px 0; color:#0F172A; font-size:14px; font-weight:600;">${priority}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0; color:#64748B; font-size:13px;">📁 Category:</td>
                        <td style="padding:8px 0; color:#0F172A; font-size:14px; font-weight:600;">${task.category || 'General'}</td>
                    </tr>
                </table>

                ${subtasksHtml}
                ${notesHtml}

                <!-- Action Button -->
                <div style="margin-top:28px; text-align:center;">
                    <a href="${CONFIG.appUrl}" style="display:inline-block; padding:12px 28px; background:#4F46E5; color:#FFFFFF; text-decoration:none; border-radius:8px; font-size:15px; font-weight:700; box-shadow:0 4px 12px rgba(79,70,229,0.3);">
                        Open DayTask Tracker
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="background:#F8FAFC; padding:16px 28px; border-top:1px solid #E2E8F0; text-align:center; color:#94A3B8; font-size:12px;">
                DayTask Daily Productivity Engine · Automated Alert sent to ${CONFIG.notifyEmail}
            </div>
        </div>
    </body>
    </html>
    `;
}

function renderSpreadsheetReminderHtml(timeSlotLabel) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Remainder Alert: Google Spreadsheet Check-in</title>
    </head>
    <body style="margin:0; padding:24px; background:#F1F5F9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width:560px; margin:0 auto; background:#FFFFFF; border-radius:12px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.06); border:1px solid #E2E8F0;">
            <!-- Header -->
            <div style="background:linear-gradient(135deg, #0F9D58 0%, #0B8043 100%); padding:24px 28px; text-align:left;">
                <div style="display:inline-block; padding:4px 10px; background:rgba(255,255,255,0.2); color:#FFFFFF; border-radius:999px; font-size:12px; font-weight:700;">
                    ⏰ ${timeSlotLabel} Scheduled Check-in
                </div>
                <h1 style="color:#FFFFFF; margin:10px 0 0 0; font-size:22px; font-weight:700;">
                    📊 Google Spreadsheet Reminder
                </h1>
            </div>

            <!-- Body -->
            <div style="padding:28px;">
                <p style="color:#334155; font-size:15px; line-height:1.6; margin:0 0 16px 0;">
                    Hi Pranav, this is your scheduled reminder to update and review your <strong>Google Spreadsheet</strong>.
                </p>
                <div style="background:#F0FDF4; border:1px solid #DCFCE7; border-radius:8px; padding:16px; margin-bottom:24px;">
                    <p style="margin:0; color:#166534; font-size:14px; line-height:1.5;">
                        📌 <strong>Routine Checkpoint (${timeSlotLabel}):</strong> Keep your daily progress, tasks, and spreadsheet logs up to date.
                    </p>
                </div>

                <div style="text-align:center; margin:28px 0 10px 0;">
                    <a href="${CONFIG.spreadsheetUrl}" style="display:inline-block; padding:13px 32px; background:#0F9D58; color:#FFFFFF; text-decoration:none; border-radius:8px; font-size:15px; font-weight:700; box-shadow:0 4px 12px rgba(15,157,88,0.35);">
                        Open Google Spreadsheet
                    </a>
                </div>
            </div>

            <!-- Footer -->
            <div style="background:#F8FAFC; padding:16px 28px; border-top:1px solid #E2E8F0; text-align:center; color:#94A3B8; font-size:12px;">
                Scheduled intervals: 11:00 AM · 12:00 PM · 4:00 PM · 8:00 PM · DayTask Assistant
            </div>
        </div>
    </body>
    </html>
    `;
}

// ==========================================
// Date & Urgency Calculation Helper (UTC safe)
// ==========================================
function toISODateString(date) {
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function calendarDayDifference(baseDate, targetDateStr) {
    if (!targetDateStr) return 0;
    const parts = targetDateStr.split('-');
    if (parts.length !== 3) return 0;
    
    const target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const base = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    
    const diffMs = target.getTime() - base.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// ==========================================
// Main Automated Check & Dispatch Routine
// ==========================================
async function checkAndSendAlerts(allData, ledgerFile = CONFIG.ledgerFile, now = new Date()) {
    if (!allData || typeof allData !== 'object') return { taskAlertsSent: 0, sheetAlertsSent: 0 };

    const ledger = loadLedger(ledgerFile);
    if (!ledger.sent) ledger.sent = {};

    const todayStr = toISODateString(now);
    const currentHour = now.getHours();
    let taskAlertsSent = 0;
    let sheetAlertsSent = 0;

    // ----------------------------------------------------
    // 1. Task High Alert Checks
    // ----------------------------------------------------
    const allTasks = [];
    Object.keys(allData).forEach(key => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Array.isArray(allData[key])) {
            allData[key].forEach(task => {
                if (task && task.id && !task.completed && task.dueDate) {
                    allTasks.push(task);
                }
            });
        }
    });

    for (const task of allTasks) {
        const alertThreshold = task.alertDays != null ? parseInt(task.alertDays, 10) : 2;
        const diffDays = calendarDayDifference(now, task.dueDate);

        const isOverdue = diffDays < 0;
        const isToday = diffDays === 0;
        const isInAlertWindow = diffDays > 0 && diffDays <= alertThreshold;

        if (isOverdue || isToday || isInAlertWindow) {
            const ledgerKey = `task_${task.id}_${todayStr}`;
            
            // Send only once per day per task
            if (!ledger.sent[ledgerKey]) {
                let urgencyLabel = `Due in ${diffDays} day(s) (threshold: ${alertThreshold}d)`;
                if (isOverdue) urgencyLabel = `OVERDUE by ${Math.abs(diffDays)} day(s)!`;
                if (isToday) urgencyLabel = `DUE TODAY!`;

                // Title format strictly matching user requirement: Remainder Alert <Task Name>
                const subject = `Remainder Alert: ${task.title}`;
                const html = renderTaskAlertHtml(task, urgencyLabel, diffDays);

                try {
                    console.log(`[EmailService] Dispatching task alert: "${subject}" to ${CONFIG.notifyEmail}...`);
                    await sendSmtpMail({
                        subject,
                        html
                    });
                    ledger.sent[ledgerKey] = new Date().toISOString();
                    taskAlertsSent++;
                } catch (err) {
                    console.error(`[EmailService] Failed to send alert for task ${task.id}:`, err.message);
                }
            }
        }
    }

    // ----------------------------------------------------
    // 2. Google Sheets Schedule Checks (11am, 12pm, 4pm, 8pm)
    // ----------------------------------------------------
    const matchedSlot = SPREADSHEET_SCHEDULE.find(s => s.hour === currentHour);
    if (matchedSlot) {
        const slotKey = `sheet_${matchedSlot.hour}_${todayStr}`;
        if (!ledger.sent[slotKey]) {
            const subject = `Remainder Alert: Google Spreadsheet Check-in (${matchedSlot.label})`;
            const html = renderSpreadsheetReminderHtml(matchedSlot.label);

            try {
                console.log(`[EmailService] Dispatching spreadsheet check-in (${matchedSlot.label}) to ${CONFIG.notifyEmail}...`);
                await sendSmtpMail({
                    subject,
                    html
                });
                ledger.sent[slotKey] = new Date().toISOString();
                sheetAlertsSent++;
            } catch (err) {
                console.error(`[EmailService] Failed to send sheet reminder for ${matchedSlot.label}:`, err.message);
            }
        }
    }

    // Prune ledger entries older than 14 days to prevent unbounded growth
    const cutoffTime = Date.now() - (14 * 24 * 60 * 60 * 1000);
    Object.keys(ledger.sent).forEach(k => {
        try {
            if (new Date(ledger.sent[k]).getTime() < cutoffTime) {
                delete ledger.sent[k];
            }
        } catch (e) {}
    });

    ledger.lastCheck = new Date().toISOString();
    saveLedger(ledger, ledgerFile);

    return { taskAlertsSent, sheetAlertsSent };
}

module.exports = {
    CONFIG,
    SPREADSHEET_SCHEDULE,
    sendSmtpMail,
    renderTaskAlertHtml,
    renderSpreadsheetReminderHtml,
    checkAndSendAlerts,
    calendarDayDifference,
    toISODateString,
    loadLedger,
    saveLedger
};
