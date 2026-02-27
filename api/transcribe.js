// Vercel serverless functions don't support multer, so we use the
// built-in body parser with a raw buffer and forward it to Whisper.
export const config = {
  api: {
    bodyParser: false, // We handle the raw stream ourselves
  },
};

// Collect raw request body as a Buffer
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error: OpenAI API key missing.' });
  }

  try {
    // Read the raw multipart body from the browser
    const rawBody = await getRawBody(req);
    const contentType = req.headers['content-type'] || '';

    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Expected multipart/form-data' });
    }

    // Forward the raw multipart body directly to OpenAI — no repacking needed
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': contentType, // pass through the boundary header unchanged
      },
      body: rawBody
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
}
