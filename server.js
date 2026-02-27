require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const multer = require('multer');
const FormData = require('form-data');
const app = express();

const PORT = process.env.PORT || 8080;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Multer — store audio upload in memory (no disk writes needed)
const upload = multer({ storage: multer.memoryStorage() });

// Middleware to parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// CORS — allow requests from your Vercel portfolio
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://programportfolio.vercel.app');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve static files from the current directory
app.use(express.static(__dirname));

// ── Proxy endpoint for Gemini Grounding ───────────────────────────────────
app.post('/api/grounding', async (req, res) => {
    if (!GOOGLE_API_KEY) {
        console.error('GOOGLE_API_KEY is not set');
        return res.status(500).json({ error: { message: 'Server configuration error: API Key missing.' } });
    }

    try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`;

        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Gemini API Error:', data);
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: { message: 'Internal Server Error during grounding request.' } });
    }
});

// ── Claude / Anthropic proxy endpoint ────────────────────────────────────
// Keeps the Anthropic API key server-side; browser calls /api/claude instead
app.post('/api/claude', async (req, res) => {
    if (!ANTHROPIC_API_KEY) {
        console.error('ANTHROPIC_API_KEY is not set');
        return res.status(500).json({ error: { message: 'Server configuration error: Anthropic API key missing.' } });
    }

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'anthropic-beta': 'tools-2024-04-04'
            },
            body: JSON.stringify(req.body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Anthropic API Error:', data);
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Claude Proxy Error:', error);
        res.status(500).json({ error: { message: 'Internal Server Error during Claude request.' } });
    }
});

// ── Whisper transcription endpoint ────────────────────────────────────────
// Receives audio blob from the browser (any browser — Chrome, Firefox, Safari)
// Forwards to OpenAI Whisper, returns { transcript: "..." }
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    if (!OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY is not set');
        return res.status(500).json({ error: 'Server configuration error: OpenAI API key missing.' });
    }
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file received.' });
    }

    try {
        const form = new FormData();
        form.append('file', req.file.buffer, {
            filename: 'audio.webm',
            contentType: req.file.mimetype || 'audio/webm',
        });
        form.append('model', 'whisper-1');
        form.append('language', 'en');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                ...form.getHeaders()
            },
            body: form
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Whisper API Error:', data);
            return res.status(response.status).json({ error: data.error?.message || 'Whisper API error' });
        }

        res.json({ transcript: data.text });
    } catch (error) {
        console.error('Transcribe Error:', error);
        res.status(500).json({ error: 'Internal server error during transcription.' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
