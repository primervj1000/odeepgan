const express = require('express');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
// Northflank automatically provides the port in the environment variables
const PORT = process.env.PORT || 3000; 

// --- CONFIGURATION ---
const TELEGRAM_BOT_TOKEN = '8555522427:AAE3-_ocACHXLfRzDEo8JCCokRTaORCQSlo';
const TELEGRAM_CHAT_IDS = [
    '7617320093',
    '7848774309'
];

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

// --- FILE STORAGE SETUP (Multer) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Sanitize filename similar to secure_filename
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const timestamp = Math.floor(Date.now() / 1000);
        cb(null, `${timestamp}_${safeName}`);
    }
});

const upload = multer({ storage: storage });

// --- TELEGRAM FUNCTION ---
async function sendToTelegram(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    for (const chatId of TELEGRAM_CHAT_IDS) {
        try {
            await axios.post(url, {
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            });
        } catch (error) {
            console.error(`Telegram error for ${chatId}:`, error.message);
        }
    }
}

// --- ROUTES ---

// 1. Health Check Endpoint (New)
app.get('/running', (req, res) => {
    // We use a simple HTML string with some basic styling
    const htmlResponse = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Service Status</title>
            <style>
                body { font-family: sans-serif; background-color: #f0f0f0; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .container { text-align: center; padding: 40px; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
                h1 { color: #28a745; }
                p { color: #6c757d; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Service is Running! ✅</h1>
                <p>Node.js Upload Server is Healthy and deployed on Northflank.</p>
                <p>Upload files to: <b>/upload</b></p>
            </div>
        </body>
        </html>
    `;
    // res.status(200) is the default, but explicitly setting it is good practice
    res.status(200).send(htmlResponse); 
});

app.get('/', (req, res) => {
    res.send('Upload server is running! Visit /running for status.');
});

// Serve static files from the uploads directory
app.use('/files', express.static(UPLOAD_DIR));

app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file selected' });
    }

    // Auto-detect the base URL (works for localhost and Northflank)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    const filename = req.file.filename;
    const sizeKb = req.file.size / 1024;
    const downloadUrl = `${baseUrl}/files/${filename}`;
    
    // Get IP address
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const message = `📁 <b>New Upload</b>
📄 ${req.file.originalname}
💾 ${sizeKb.toFixed(1)} KB
🌐 ${clientIp}
⏰ ${new Date().toISOString().replace('T', ' ').substring(0, 19)}
🔗 <a href="${downloadUrl}">Download</a>`;

    // Send to Telegram asynchronously
    sendToTelegram(message);

    res.json({
        success: true,
        filename: filename,
        download_url: downloadUrl
    });
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
