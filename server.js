const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { google } = require('googleapis');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const LEADS_FILE = path.join(ROOT, 'data', 'leads.json');
const FINDINGS_FILE = path.join(ROOT, 'data', 'findings.json');
const USERS_FILE = path.join(ROOT, 'data', 'users.json');
const FINDINGS_IMG_DIR = path.join(ROOT, 'images', 'findings');
const CONTACT_IMG_DIR = path.join(ROOT, 'images', 'contact');
const GOOGLE_CREDENTIALS_FILE = path.join(ROOT, 'data', 'google-credentials.json');
const AI_CONFIG_FILE = path.join(ROOT, 'data', 'ai-config.json');

function getAiApiKey() {
    if (process.env.AI_API_KEY) return process.env.AI_API_KEY;
    try {
        const cfg = JSON.parse(fs.readFileSync(AI_CONFIG_FILE, 'utf8'));
        return cfg.apiKey || '';
    } catch { return ''; }
}
const SALT = 'plumcert-salt';

// Google Calendar ID — use primary calendar of the service account, or set a shared calendar ID
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'utilitiescombined@gmail.com';

// In-memory session store: token -> { username, role, expiresAt }
const sessions = new Map();

// Ensure data directory and files exist
const dataDir = path.join(ROOT, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]', 'utf8');
if (!fs.existsSync(FINDINGS_FILE)) fs.writeFileSync(FINDINGS_FILE, '[]', 'utf8');
if (!fs.existsSync(FINDINGS_IMG_DIR)) fs.mkdirSync(FINDINGS_IMG_DIR, { recursive: true });
if (!fs.existsSync(CONTACT_IMG_DIR)) fs.mkdirSync(CONTACT_IMG_DIR, { recursive: true });

// Seed super admin on first run
if (!fs.existsSync(USERS_FILE)) {
    const adminHash = crypto.scryptSync('Noobycheese123!', SALT, 64).toString('hex');
    const users = [{
        id: 'admin-001',
        username: 'Utilitiecombined',
        passwordHash: adminHash,
        role: 'admin',
        createdAt: new Date().toISOString()
    }];
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    console.log('[SETUP] Super admin account created');
}

const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
};

// ---- HELPERS ----

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1e6) {
                req.destroy();
                reject(new Error('Request body too large'));
            }
        });
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(.+)/);
        if (!boundaryMatch) return reject(new Error('No boundary found'));
        const boundary = boundaryMatch[1];
        const chunks = [];
        let totalSize = 0;
        const MAX_SIZE = 20 * 1024 * 1024;

        req.on('data', chunk => {
            totalSize += chunk.length;
            if (totalSize > MAX_SIZE) {
                req.destroy();
                return reject(new Error('Upload too large (max 20MB)'));
            }
            chunks.push(chunk);
        });

        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                const fields = {};
                const files = {};
                const boundaryBuf = Buffer.from('--' + boundary);

                let start = 0;
                const parts = [];
                while (true) {
                    const idx = buffer.indexOf(boundaryBuf, start);
                    if (idx === -1) break;
                    if (start > 0) {
                        let partStart = start;
                        let partEnd = idx;
                        if (buffer[partStart] === 0x0d && buffer[partStart + 1] === 0x0a) partStart += 2;
                        if (buffer[partEnd - 2] === 0x0d && buffer[partEnd - 1] === 0x0a) partEnd -= 2;
                        if (partEnd > partStart) parts.push(buffer.slice(partStart, partEnd));
                    }
                    start = idx + boundaryBuf.length;
                }

                for (const part of parts) {
                    const sep = part.indexOf('\r\n\r\n');
                    if (sep === -1) continue;
                    const headerStr = part.slice(0, sep).toString('utf8');
                    const body = part.slice(sep + 4);

                    const nameMatch = headerStr.match(/name="([^"]+)"/);
                    if (!nameMatch) continue;
                    const fieldName = nameMatch[1];

                    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
                    if (filenameMatch) {
                        const mimeMatch = headerStr.match(/Content-Type:\s*(.+)/i);
                        files[fieldName] = {
                            filename: filenameMatch[1],
                            data: body,
                            mimetype: mimeMatch ? mimeMatch[1].trim() : 'application/octet-stream'
                        };
                    } else {
                        fields[fieldName] = body.toString('utf8');
                    }
                }
                resolve({ fields, files });
            } catch (err) { reject(err); }
        });
        req.on('error', reject);
    });
}

function sendJSON(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(JSON.stringify(data));
}

function saveLead(lead) {
    const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
    lead.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    lead.submittedAt = new Date().toISOString();
    lead.status = 'new';
    leads.push(lead);
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
    return lead;
}

function validateLead(data) {
    const errors = [];
    if (!data.fullName || data.fullName.trim().length < 2) errors.push('Full name is required');
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Valid email is required');
    if (!data.phone || data.phone.trim().length < 7) errors.push('Valid phone number is required');
    if (!data.postcode || data.postcode.trim().length < 3) errors.push('Postcode is required');
    if (!data.serviceType) errors.push('Service type is required');
    return errors;
}

// ---- USER HELPERS ----

function hashPassword(password) {
    return crypto.scryptSync(password, SALT, 64).toString('hex');
}

function readUsers() {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
    catch { return []; }
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function authenticateRequest(req) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return null;
    const session = sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
        sessions.delete(token);
        return null;
    }
    return session; // Returns { username, role, expiresAt }
}

function generateToken(username, role) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        username,
        role,
        expiresAt: Date.now() + 8 * 60 * 60 * 1000
    });
    return token;
}

// ---- FINDINGS HELPERS ----

function readFindings() {
    try { return JSON.parse(fs.readFileSync(FINDINGS_FILE, 'utf8')); }
    catch { return []; }
}

function saveFindings(findings) {
    fs.writeFileSync(FINDINGS_FILE, JSON.stringify(findings, null, 2), 'utf8');
}

function saveUploadedImage(fileData, prefix, targetDir) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(fileData.mimetype)) return null;
    if (fileData.data.length > 5 * 1024 * 1024) return null;

    const ext = fileData.mimetype === 'image/png' ? '.png'
        : fileData.mimetype === 'image/webp' ? '.webp' : '.jpg';
    const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${prefix}${ext}`;
    const dir = targetDir || FINDINGS_IMG_DIR;
    const subPath = dir === CONTACT_IMG_DIR ? 'contact' : 'findings';
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, fileData.data);
    return `images/${subPath}/${filename}`;
}

// ---- CLAUDE API HELPER ----

const AI_PROMPTS = {
    rewrite: {
        description: 'You are a professional CP12 / gas safety report writer for a UK Gas Safe registered plumbing company. Rewrite the following description of a gas, boiler or plumbing fault to be clear, professional, and technically accurate. Reference relevant safety standards (e.g. Gas Safety (Installation and Use) Regulations 1998, GSIUR, IGEM/UP/1B, BS 6891 for gas pipework, BS 5440 for flueing, IGE/UP/1) where appropriate. Use the correct UK gas safety classification (Immediately Dangerous - ID, At Risk - AR, Not to Current Standards - NCS). 2-3 sentences. Use British English. Do not add any preamble or explanation. Return only the rewritten text.',
        fix: 'You are a professional CP12 / gas safety report writer for a UK Gas Safe registered plumbing company. Rewrite the following description of how a gas or plumbing issue was resolved. Use past tense, action-focused language. Reference correct procedures (e.g. isolated supply, capped off, bled radiators, replaced flue seal, recommissioned to manufacturer instructions). 1-2 sentences. Use British English. Do not add any preamble. Return only the rewritten text.',
        outcome: 'You are a professional CP12 / gas safety report writer for a UK Gas Safe registered plumbing company. Rewrite the following sentence summarising the final result of a gas safety repair. Keep it to 1 short sentence focused on the outcome and confirming the appliance / installation is safe to use. Use British English. Do not add any preamble. Return only the rewritten text.'
    },
    proofread: {
        description: 'You are a copy editor for a UK Gas Safe registered plumbing company. Fix only spelling and grammatical errors in the following text. Do not rephrase, restructure, change the meaning, or add anything. Use British English. Return only the corrected text with no preamble.',
        fix: 'You are a copy editor for a UK Gas Safe registered plumbing company. Fix only spelling and grammatical errors in the following text. Do not rephrase, restructure, change the meaning, or add anything. Use British English. Return only the corrected text with no preamble.',
        outcome: 'You are a copy editor for a UK Gas Safe registered plumbing company. Fix only spelling and grammatical errors in the following text. Do not rephrase, restructure, change the meaning, or add anything. Use British English. Return only the corrected text with no preamble.'
    }
};

function callClaudeAPI(text, fieldType, mode) {
    return new Promise((resolve, reject) => {
        const apiKey = getAiApiKey();
        if (!apiKey) return reject(new Error('AI API key not configured. An admin must set it in /admin/ â†’ Settings â†’ AI Settings.'));

        const validFields = ['description', 'fix', 'outcome'];
        const validModes = ['rewrite', 'proofread'];
        const f = validFields.includes(fieldType) ? fieldType : 'description';
        const m = validModes.includes(mode) ? mode : 'rewrite';
        const systemPrompt = AI_PROMPTS[m][f];

        const postData = JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            messages: [{ role: 'user', content: text }],
            system: systemPrompt
        });

        const options = {
            hostname: 'api.anthropic.com',
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const apiReq = https.request(options, (apiRes) => {
            let body = '';
            apiRes.on('data', chunk => { body += chunk; });
            apiRes.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    if (result.content && result.content[0]) {
                        resolve(result.content[0].text.trim());
                    } else if (result.error) {
                        console.error('[AI API ERROR]', result.error.type, result.error.message);
                        reject(new Error(result.error.message || 'API error'));
                    } else {
                        console.error('[AI API] Unexpected response:', body);
                        reject(new Error('Unexpected API response'));
                    }
                } catch { reject(new Error('Failed to parse API response')); }
            });
        });

        apiReq.on('error', reject);
        apiReq.write(postData);
        apiReq.end();
    });
}

// ---- GOOGLE CALENDAR ----

let calendarClient = null;

function getCalendarClient() {
    if (calendarClient) return calendarClient;
    try {
        let credentials = null;

        // Priority 1: GOOGLE_CREDENTIALS_JSON env var (for Render / cloud hosting)
        if (process.env.GOOGLE_CREDENTIALS_JSON) {
            credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
            console.log('[CALENDAR] Using credentials from GOOGLE_CREDENTIALS_JSON env var');
        }
        // Priority 2: Local credentials file (for local development)
        else if (fs.existsSync(GOOGLE_CREDENTIALS_FILE)) {
            credentials = JSON.parse(fs.readFileSync(GOOGLE_CREDENTIALS_FILE, 'utf8'));
            console.log('[CALENDAR] Using credentials from local file');
        }
        else {
            console.log('[CALENDAR] No credentials found — calendar integration disabled');
            return null;
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        calendarClient = google.calendar({ version: 'v3', auth });
        console.log('[CALENDAR] Google Calendar client initialised');
        return calendarClient;
    } catch (err) {
        console.error('[CALENDAR] Failed to initialise:', err.message);
        return null;
    }
}

async function createCalendarEvent(lead) {
    const calendar = getCalendarClient();
    if (!calendar) return null;

    try {
        // Parse preferred date or default to tomorrow
        let startDate;
        const preferred = (lead.preferredDate || '').trim();
        if (preferred) {
            // Try to parse common UK date formats
            const parsed = new Date(preferred);
            if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
                startDate = parsed;
            }
        }
        if (!startDate) {
            // Default to tomorrow 9am
            startDate = new Date();
            startDate.setDate(startDate.getDate() + 1);
        }
        startDate.setHours(9, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setHours(12, 0, 0, 0); // 3-hour slot

        const event = {
            summary: `Gas Safety Inspection — ${lead.fullName}`,
            description: [
                `Service: ${lead.serviceType}`,
                `Phone: ${lead.phone}`,
                `Email: ${lead.email}`,
                `Postcode: ${lead.postcode}`,
                `Contact preference: ${lead.contactPreference || 'Not specified'}`,
                `Preferred date: ${lead.preferredDate || 'Not specified'}`,
                '',
                'Booked via Plumcert website'
            ].join('\n'),
            start: {
                dateTime: startDate.toISOString(),
                timeZone: 'Europe/London',
            },
            end: {
                dateTime: endDate.toISOString(),
                timeZone: 'Europe/London',
            },
            colorId: '9', // Blue
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 60 },
                ],
            },
        };

        const result = await calendar.events.insert({
            calendarId: GOOGLE_CALENDAR_ID,
            resource: event,
        });

        console.log(`[CALENDAR] Event created: ${result.data.htmlLink}`);
        return result.data;
    } catch (err) {
        console.error('[CALENDAR] Failed to create event:', err.message);
        return null;
    }
}

// ---- SERVER ----

http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        sendJSON(res, 204, {});
        return;
    }

    // ---- PUBLIC API ROUTES ----

    // POST /api/book
    if (req.method === 'POST' && url === '/api/book') {
        try {
            const data = await parseBody(req);
            const errors = validateLead(data);
            if (errors.length > 0) {
                sendJSON(res, 400, { success: false, errors });
                return;
            }
            const lead = saveLead(data);
            console.log(`[NEW LEAD] ${lead.fullName} | ${lead.email} | ${lead.serviceType} | ${lead.postcode}`);
            console.log('='.repeat(60));
            console.log(`[NEW BOOKING] ${lead.fullName} | ${lead.phone} | ${lead.serviceType}`);
            console.log(`  Preferred date: ${data.preferredDate || 'Not specified'}`);
            console.log(`  Contact via: ${data.contactPreference || 'Not specified'}`);
            console.log(`  Postcode: ${lead.postcode}`);
            console.log('='.repeat(60));

            // Create Google Calendar event (non-blocking)
            createCalendarEvent(lead).catch(err => {
                console.error('[CALENDAR] Background event creation failed:', err.message);
            });

            sendJSON(res, 200, { success: true, message: 'Booking request received.', leadId: lead.id });
        } catch (err) {
            console.error('[ERROR] Form submission failed:', err.message);
            sendJSON(res, 400, { success: false, errors: [err.message] });
        }
        return;
    }

    // POST /api/contact — JSON or multipart (with optional photo)
    if (req.method === 'POST' && url === '/api/contact') {
        try {
            const isMultipart = (req.headers['content-type'] || '').includes('multipart/form-data');
            let fields, files;
            if (isMultipart) {
                ({ fields, files } = await parseMultipart(req));
            } else {
                fields = await parseBody(req);
                files = {};
            }

            if (!fields.name || !fields.email || !fields.message) {
                sendJSON(res, 400, { success: false, errors: ['Name, email and message are required'] });
                return;
            }

            let attachment = null;
            if (files.photo && files.photo.data && files.photo.data.length > 0) {
                attachment = saveUploadedImage(files.photo, 'contact', CONTACT_IMG_DIR);
                if (!attachment) {
                    sendJSON(res, 400, { success: false, errors: ['Photo must be JPG, PNG or WebP under 5MB'] });
                    return;
                }
            }

            const lead = saveLead({
                fullName: fields.name,
                email: fields.email,
                phone: fields.phone || '',
                subject: fields.subject || 'General Enquiry',
                message: fields.message,
                serviceType: 'contact-form',
                postcode: '',
                attachment
            });
            console.log(`[CONTACT] ${lead.fullName} | ${lead.email} | ${lead.subject}${attachment ? ' | photo attached' : ''}`);
            sendJSON(res, 200, { success: true, message: 'Message received.' });
        } catch (err) {
            sendJSON(res, 400, { success: false, errors: [err.message] });
        }
        return;
    }

    // GET /api/health — health check endpoint (used by Render + keep-alive)
    if (req.method === 'GET' && url === '/api/health') {
        sendJSON(res, 200, { status: 'ok', uptime: process.uptime() });
        return;
    }

    // GET /api/leads
    if (req.method === 'GET' && url === '/api/leads') {
        const session = authenticateRequest(req);
        if (!session) { sendJSON(res, 401, { success: false, error: 'Not authenticated' }); return; }

        try {
            const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
            sendJSON(res, 200, { total: leads.length, leads });
        } catch {
            sendJSON(res, 500, { error: 'Could not read leads' });
        }
        return;
    }

    // GET /api/findings — Public approved findings
    if (req.method === 'GET' && url === '/api/findings') {
        try {
            const findings = readFindings().filter(f => f.status === 'approved');
            sendJSON(res, 200, { success: true, findings });
        } catch {
            sendJSON(res, 500, { error: 'Could not read findings' });
        }
        return;
    }

    // GET /api/findings/featured — Up to 3 admin-starred findings for the homepage
    if (req.method === 'GET' && url === '/api/findings/featured') {
        try {
            const findings = readFindings()
                .filter(f => f.status === 'approved' && f.featured === true)
                .slice(0, 3);
            sendJSON(res, 200, { success: true, findings });
        } catch {
            sendJSON(res, 500, { error: 'Could not read findings' });
        }
        return;
    }

    // ---- INSTALLER AUTH ----

    // POST /api/installer/login
    if (req.method === 'POST' && url === '/api/installer/login') {
        try {
            const data = await parseBody(req);
            if (!data.username || !data.password) {
                sendJSON(res, 400, { success: false, error: 'Username and password are required' });
                return;
            }

            const users = readUsers();
            const user = users.find(u => u.username.toLowerCase() === data.username.toLowerCase());
            if (!user) {
                sendJSON(res, 401, { success: false, error: 'Invalid username or password' });
                return;
            }

            const hash = hashPassword(data.password);
            const hashBuf = Buffer.from(hash, 'hex');
            const storedBuf = Buffer.from(user.passwordHash, 'hex');
            if (hashBuf.length !== storedBuf.length || !crypto.timingSafeEqual(hashBuf, storedBuf)) {
                sendJSON(res, 401, { success: false, error: 'Invalid username or password' });
                return;
            }

            const token = generateToken(user.username, user.role);
            console.log(`[LOGIN] ${user.username} (${user.role})`);
            sendJSON(res, 200, { success: true, token, role: user.role, username: user.username });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // ---- ADMIN ROUTES (admin role only) ----

    // POST /api/admin/users — Create new installer account
    if (req.method === 'POST' && url === '/api/admin/users') {
        const session = authenticateRequest(req);
        if (!session) { sendJSON(res, 401, { success: false, error: 'Not authenticated' }); return; }
        if (session.role !== 'admin') { sendJSON(res, 403, { success: false, error: 'Admin access required' }); return; }

        try {
            const data = await parseBody(req);
            if (!data.username || !data.password) {
                sendJSON(res, 400, { success: false, error: 'Username and password are required' });
                return;
            }
            if (data.password.length < 6) {
                sendJSON(res, 400, { success: false, error: 'Password must be at least 6 characters' });
                return;
            }

            const users = readUsers();
            if (users.find(u => u.username.toLowerCase() === data.username.toLowerCase())) {
                sendJSON(res, 400, { success: false, error: 'Username already exists' });
                return;
            }

            const newUser = {
                id: Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
                username: data.username,
                passwordHash: hashPassword(data.password),
                role: data.role === 'admin' ? 'admin' : 'installer',
                createdAt: new Date().toISOString()
            };
            users.push(newUser);
            saveUsers(users);

            console.log(`[ADMIN] Created user: ${newUser.username} (${newUser.role})`);
            sendJSON(res, 200, {
                success: true,
                user: { id: newUser.id, username: newUser.username, role: newUser.role, createdAt: newUser.createdAt }
            });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // GET /api/admin/users — List all users
    if (req.method === 'GET' && url === '/api/admin/users') {
        const session = authenticateRequest(req);
        if (!session) { sendJSON(res, 401, { success: false, error: 'Not authenticated' }); return; }
        if (session.role !== 'admin') { sendJSON(res, 403, { success: false, error: 'Admin access required' }); return; }

        try {
            const users = readUsers().map(u => ({
                id: u.id, username: u.username, role: u.role, createdAt: u.createdAt
            }));
            sendJSON(res, 200, { success: true, users });
        } catch {
            sendJSON(res, 500, { error: 'Could not read users' });
        }
        return;
    }

    // DELETE /api/admin/users/:id — Delete a user
    if (req.method === 'DELETE' && url.match(/^\/api\/admin\/users\/([^/]+)$/)) {
        const session = authenticateRequest(req);
        if (!session) { sendJSON(res, 401, { success: false, error: 'Not authenticated' }); return; }
        if (session.role !== 'admin') { sendJSON(res, 403, { success: false, error: 'Admin access required' }); return; }

        try {
            const userId = url.match(/^\/api\/admin\/users\/([^/]+)$/)[1];
            let users = readUsers();
            const user = users.find(u => u.id === userId);
            if (!user) { sendJSON(res, 404, { success: false, error: 'User not found' }); return; }
            if (user.id === 'admin-001') {
                sendJSON(res, 400, { success: false, error: 'Cannot delete the super admin account' });
                return;
            }

            users = users.filter(u => u.id !== userId);
            saveUsers(users);
            console.log(`[ADMIN] Deleted user: ${user.username}`);
            sendJSON(res, 200, { success: true });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // POST /api/admin/users/:id/reset-password — Reset user password
    if (req.method === 'POST' && url.match(/^\/api\/admin\/users\/([^/]+)\/reset-password$/)) {
        const session = authenticateRequest(req);
        if (!session) { sendJSON(res, 401, { success: false, error: 'Not authenticated' }); return; }
        if (session.role !== 'admin') { sendJSON(res, 403, { success: false, error: 'Admin access required' }); return; }

        try {
            const userId = url.match(/^\/api\/admin\/users\/([^/]+)\/reset-password$/)[1];
            const data = await parseBody(req);
            if (!data.password || data.password.length < 6) {
                sendJSON(res, 400, { success: false, error: 'New password must be at least 6 characters' });
                return;
            }

            const users = readUsers();
            const user = users.find(u => u.id === userId);
            if (!user) { sendJSON(res, 404, { success: false, error: 'User not found' }); return; }

            user.passwordHash = hashPassword(data.password);
            saveUsers(users);
            console.log(`[ADMIN] Password reset for: ${user.username}`);
            sendJSON(res, 200, { success: true });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // ---- INSTALLER ROUTES (any authenticated user) ----

    // POST /api/installer/findings — Submit a new finding
    if (req.method === 'POST' && url === '/api/installer/findings') {
        const session = authenticateRequest(req);
        if (!session) { sendJSON(res, 401, { success: false, error: 'Not authenticated' }); return; }

        try {
            const { fields, files } = await parseMultipart(req);

            if (!fields.title || !fields.classification || !fields.description || !fields.location) {
                sendJSON(res, 400, { success: false, error: 'Title, classification, description and location are required' });
                return;
            }

            const classLabels = {
                'ID': 'Immediately Dangerous',
                'AR': 'At Risk',
                'NCS': 'Not to Current Standards'
            };

            let beforeImage = '';
            let afterImage = '';

            if (files.beforePhoto) {
                beforeImage = saveUploadedImage(files.beforePhoto, 'before');
                if (!beforeImage) {
                    sendJSON(res, 400, { success: false, error: 'Before photo must be JPG, PNG or WebP and under 5MB' });
                    return;
                }
            }

            if (files.afterPhoto) {
                afterImage = saveUploadedImage(files.afterPhoto, 'after');
                if (!afterImage) {
                    sendJSON(res, 400, { success: false, error: 'After photo must be JPG, PNG or WebP and under 5MB' });
                    return;
                }
            }

            const finding = {
                id: Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
                title: fields.title,
                classification: fields.classification,
                classificationLabel: classLabels[fields.classification] || '',
                location: fields.location,
                propertyType: fields.propertyType || '',
                inspectionType: fields.inspectionType || '',
                description: fields.description,
                fix: fields.fix || '',
                outcome: fields.outcome || '',
                beforeImage,
                afterImage,
                submittedBy: session.username,
                status: 'pending',
                submittedAt: new Date().toISOString()
            };

            const findings = readFindings();
            findings.unshift(finding);
            saveFindings(findings);

            console.log(`[FINDING] New by ${session.username}: ${finding.title} (${finding.classification}) — ${finding.location}`);
            sendJSON(res, 200, { success: true, finding });
        } catch (err) {
            console.error('[ERROR] Finding submission failed:', err.message);
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // GET /api/installer/findings — Get findings (auth required)
    if (req.method === 'GET' && url === '/api/installer/findings') {
        const session = authenticateRequest(req);
        if (!session) { sendJSON(res, 401, { success: false, error: 'Not authenticated' }); return; }

        try {
            const findings = readFindings();
            sendJSON(res, 200, { success: true, findings });
        } catch {
            sendJSON(res, 500, { error: 'Could not read findings' });
        }
        return;
    }

    // POST /api/installer/findings/:id/approve — Toggle approval (admin only)
    if (req.method === 'POST' && url.match(/^\/api\/installer\/findings\/([^/]+)\/approve$/)) {
        const session = authenticateRequest(req);
        if (!session) { sendJSON(res, 401, { success: false, error: 'Not authenticated' }); return; }
        if (session.role !== 'admin') { sendJSON(res, 403, { success: false, error: 'Admin access required' }); return; }

        try {
            const findingId = url.match(/^\/api\/installer\/findings\/([^/]+)\/approve$/)[1];
            const findings = readFindings();
            const finding = findings.find(f => f.id === findingId);
            if (!finding) { sendJSON(res, 404, { success: false, error: 'Finding not found' }); return; }

            finding.status = finding.status === 'approved' ? 'pending' : 'approved';
            // Unapproving a finding also removes it from the homepage feature list
            if (finding.status !== 'approved') finding.featured = false;
            saveFindings(findings);

            console.log(`[FINDING] ${finding.title} — ${finding.status} by ${session.username}`);
            sendJSON(res, 200, { success: true, finding });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // POST /api/installer/findings/:id/feature — Toggle homepage-featured flag (admin only)
    // Capped at 3 featured findings. Only approved findings can be featured.
    if (req.method === 'POST' && url.match(/^\/api\/installer\/findings\/([^/]+)\/feature$/)) {
        const session = authenticateRequest(req);
        if (!session) { sendJSON(res, 401, { success: false, error: 'Not authenticated' }); return; }
        if (session.role !== 'admin') { sendJSON(res, 403, { success: false, error: 'Admin access required' }); return; }

        try {
            const findingId = url.match(/^\/api\/installer\/findings\/([^/]+)\/feature$/)[1];
            const findings = readFindings();
            const finding = findings.find(f => f.id === findingId);
            if (!finding) { sendJSON(res, 404, { success: false, error: 'Finding not found' }); return; }

            const willBeFeatured = !finding.featured;
            if (willBeFeatured) {
                if (finding.status !== 'approved') {
                    sendJSON(res, 400, { success: false, error: 'Approve the finding before featuring it on the homepage.' });
                    return;
                }
                const featuredCount = findings.filter(f => f.featured === true).length;
                if (featuredCount >= 3) {
                    sendJSON(res, 400, { success: false, error: 'You can feature at most 3 findings. Unfeature one first.' });
                    return;
                }
            }

            finding.featured = willBeFeatured;
            saveFindings(findings);

            console.log(`[FINDING] ${finding.title} — featured=${finding.featured} by ${session.username}`);
            sendJSON(res, 200, { success: true, finding });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // DELETE /api/installer/findings/:id — Admin can delete any finding;
    //                                       Installer can delete their own.
    if (req.method === 'DELETE' && url.match(/^\/api\/installer\/findings\/([^/]+)$/)) {
        const session = authenticateRequest(req);
        if (!session) { sendJSON(res, 401, { success: false, error: 'Not authenticated' }); return; }

        try {
            const findingId = url.match(/^\/api\/installer\/findings\/([^/]+)$/)[1];
            let findings = readFindings();
            const finding = findings.find(f => f.id === findingId);
            if (!finding) { sendJSON(res, 404, { success: false, error: 'Finding not found' }); return; }

            // Permission: admin can delete anything. Installer can only delete findings they posted.
            const isOwner = finding.submittedBy && finding.submittedBy === session.username;
            if (session.role !== 'admin' && !isOwner) {
                sendJSON(res, 403, { success: false, error: 'You can only delete findings you posted.' });
                return;
            }

            if (finding.beforeImage) {
                const imgPath = path.join(ROOT, finding.beforeImage);
                if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
            }
            if (finding.afterImage) {
                const imgPath = path.join(ROOT, finding.afterImage);
                if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
            }

            findings = findings.filter(f => f.id !== findingId);
            saveFindings(findings);

            console.log(`[FINDING] Deleted: ${finding.title} by ${session.username} (${session.role})`);
            sendJSON(res, 200, { success: true });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // POST /api/installer/ai-rewrite — accepts { text, fieldType, mode }
    // (kept legacy { description } for back-compat with old clients)
    if (req.method === 'POST' && url === '/api/installer/ai-rewrite') {
        const session = authenticateRequest(req);
        if (!session) { sendJSON(res, 401, { success: false, error: 'Not authenticated' }); return; }

        try {
            const data = await parseBody(req);
            const text = (data.text || data.description || '').trim();
            const fieldType = data.fieldType || 'description';
            const mode = data.mode || 'rewrite';
            if (text.length < 5) {
                sendJSON(res, 400, { success: false, error: 'Please write a few words first.' });
                return;
            }
            const rewritten = await callClaudeAPI(text, fieldType, mode);
            sendJSON(res, 200, { success: true, rewritten });
        } catch (err) {
            console.error('[ERROR] AI rewrite failed:', err.message);
            const status = /not configured/i.test(err.message) ? 503 : 500;
            sendJSON(res, status, { success: false, error: err.message });
        }
        return;
    }

    // GET /api/admin/ai-config — returns whether key is set (never the key itself)
    if (req.method === 'GET' && url === '/api/admin/ai-config') {
        const session = authenticateRequest(req);
        if (!session || session.role !== 'admin') { sendJSON(res, 401, { success: false, error: 'Admin only' }); return; }
        const key = getAiApiKey();
        const source = process.env.AI_API_KEY ? 'env' : (key ? 'file' : 'none');
        sendJSON(res, 200, { success: true, configured: !!key, source, masked: key ? (key.slice(0, 7) + '...' + key.slice(-4)) : null });
        return;
    }

    // POST /api/admin/ai-config — save key to data/ai-config.json (gitignored)
    if (req.method === 'POST' && url === '/api/admin/ai-config') {
        const session = authenticateRequest(req);
        if (!session || session.role !== 'admin') { sendJSON(res, 401, { success: false, error: 'Admin only' }); return; }
        try {
            const data = await parseBody(req);
            const key = (data.apiKey || '').trim();
            if (!key) {
                // empty = clear the file
                if (fs.existsSync(AI_CONFIG_FILE)) fs.unlinkSync(AI_CONFIG_FILE);
                sendJSON(res, 200, { success: true, configured: false });
                return;
            }
            if (!/^sk-ant-/.test(key)) {
                sendJSON(res, 400, { success: false, error: 'Anthropic keys start with "sk-ant-". Double-check the value you pasted.' });
                return;
            }
            fs.writeFileSync(AI_CONFIG_FILE, JSON.stringify({ apiKey: key }, null, 2), 'utf8');
            sendJSON(res, 200, { success: true, configured: true });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // POST /api/admin/ai-config/test — sends a small test request to verify the key works
    if (req.method === 'POST' && url === '/api/admin/ai-config/test') {
        const session = authenticateRequest(req);
        if (!session || session.role !== 'admin') { sendJSON(res, 401, { success: false, error: 'Admin only' }); return; }
        try {
            const result = await callClaudeAPI('Test connection.', 'description', 'proofread');
            sendJSON(res, 200, { success: true, sample: result.slice(0, 80) });
        } catch (err) {
            sendJSON(res, 502, { success: false, error: err.message });
        }
        return;
    }

    // PATCH /api/leads/:id/status — Update lead status
    if (req.method === 'PATCH' && url.match(/^\/api\/leads\/([^/]+)\/status$/)) {
        const session = authenticateRequest(req);
        if (!session) { sendJSON(res, 401, { success: false, error: 'Not authenticated' }); return; }

        try {
            const leadId = url.match(/^\/api\/leads\/([^/]+)\/status$/)[1];
            const data = await parseBody(req);
            const validStatuses = ['new', 'contacted', 'booked', 'completed', 'review-requested'];
            if (!validStatuses.includes(data.status)) {
                sendJSON(res, 400, { success: false, error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') });
                return;
            }

            const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
            const lead = leads.find(l => l.id === leadId);
            if (!lead) { sendJSON(res, 404, { success: false, error: 'Lead not found' }); return; }

            lead.status = data.status;
            lead.statusUpdatedAt = new Date().toISOString();
            lead.statusUpdatedBy = session.username;
            fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');

            console.log(`[LEAD] ${lead.fullName} status -> ${data.status} by ${session.username}`);
            sendJSON(res, 200, { success: true, lead });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // POST /api/leads/:id/send-review — Generate review request link for a lead
    if (req.method === 'POST' && url.match(/^\/api\/leads\/([^/]+)\/send-review$/)) {
        const session = authenticateRequest(req);
        if (!session) { sendJSON(res, 401, { success: false, error: 'Not authenticated' }); return; }

        try {
            const leadId = url.match(/^\/api\/leads\/([^/]+)\/send-review$/)[1];
            const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
            const lead = leads.find(l => l.id === leadId);
            if (!lead) { sendJSON(res, 404, { success: false, error: 'Lead not found' }); return; }

            const reviewUrl = 'https://www.google.com/search?sca_esv=40caf99d405430b1&authuser=0&hl=en&gl=uk&output=search&q=Utilities+Combined+LTD&ludocid=12288643178923305770&lsig=AB86z5WBWsRXCEpR2HIbqt_wIN76#lrd=0x4876407c0e26e861:0xaa820fcc7b4b4b2a,3,,,,';
            const customerName = lead.fullName ? lead.fullName.split(' ')[0] : 'there';

            const whatsappMessage = encodeURIComponent(
                `Hi ${customerName}, your gas safety certificate is ready and has been sent to ${lead.email || 'your email'}. ` +
                `If you're happy with our service, we'd really appreciate a quick Google review: ${reviewUrl}`
            );
            const whatsappLink = `https://wa.me/${lead.phone ? lead.phone.replace(/[^0-9]/g, '').replace(/^0/, '44') : ''}?text=${whatsappMessage}`;

            // Update lead status
            lead.status = 'review-requested';
            lead.reviewRequestedAt = new Date().toISOString();
            fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');

            console.log(`[REVIEW] Review request generated for ${lead.fullName} by ${session.username}`);
            sendJSON(res, 200, {
                success: true,
                whatsappLink,
                reviewUrl,
                message: `Review request ready for ${lead.fullName}`
            });
        } catch (err) {
            sendJSON(res, 400, { success: false, error: err.message });
        }
        return;
    }

    // ---- UNIFIED ADMIN REDIRECTS ----
    // The admin / installer panels for all Utilities Combined sister sites
    // (electricert, oilcert, plumcert) live on the canonical electricert hub.
    // Redirect any incoming /admin or /installer here so a single login serves
    // all three brands. The ?from= query is just informational for the hub.
    if (url === '/admin' || url === '/admin/' || url === '/installer' || url === '/installer/') {
        const target = (url.startsWith('/admin') ? '/admin/' : '/installer') + '?from=plumcert';
        res.writeHead(302, { Location: 'https://electricert.co.uk' + target });
        res.end();
        return;
    }

    // ---- STATIC FILES ----

    let filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (url === '/installer') {
        filePath = path.join(ROOT, 'pages', 'installer.html');
    }

    if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
        return;
    }

    if (fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end('Server Error');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });

}).listen(PORT, () => {
    console.log(`Plumcert server running at http://localhost:${PORT}`);
    console.log(`Installer portal: /installer`);

    // Keep-alive self-ping to prevent Render free-tier cold starts (every 14 minutes)
    const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
    if (RENDER_URL) {
        const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes
        setInterval(() => {
            https.get(`${RENDER_URL}/api/health`, (res) => {
                console.log(`[KEEP-ALIVE] Pinged ${RENDER_URL} — status ${res.statusCode}`);
            }).on('error', (err) => {
                console.log(`[KEEP-ALIVE] Ping failed: ${err.message}`);
            });
        }, PING_INTERVAL);
        console.log(`[KEEP-ALIVE] Self-ping enabled every 14 minutes`);
    }
});
