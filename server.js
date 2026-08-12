const path = require('path');
const crypto = require('crypto');
const express = require('express');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3000/';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn(
    'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are not set. Auth routes will reject requests until you set them.'
  );
}

// State tokens from /auth, with a 10 minute expiry.
const states = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/auth', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  states.set(state, Date.now() + 10 * 60 * 1000);

  const url =
    'https://github.com/login/oauth/authorize?' +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: CALLBACK_URL,
      scope: 'public_repo',
      state
    });

  res.redirect(url);
});

app.post('/callback', async (req, res) => {
  const { code, state } = req.body || {};

  if (!code || !state) {
    return res.status(400).json({ error: 'code and state are required' });
  }

  const expiry = states.get(state);
  if (!expiry || expiry < Date.now()) {
    return res.status(400).json({ error: 'invalid or expired state' });
  }
  states.delete(state);

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        state
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return res.status(400).json(data);
    }

    res.json({ access_token: data.access_token, scope: data.scope });
  } catch (err) {
    res.status(500).json({ error: 'token exchange failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Stardance Project Studio running at http://localhost:${PORT}`);
});
