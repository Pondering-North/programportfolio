const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 8080;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

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

// Proxy endpoint for Gemini Grounding
app.post('/api/grounding', async (req, res) => {
    if (!GOOGLE_API_KEY) {
        console.error('GOOGLE_API_KEY is not set');
        return res.status(500).json({ error: { message: 'Server configuration error: API Key missing.' } });
    }

    try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`;

        const response = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
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

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
