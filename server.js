const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
require('dotenv').config();
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// The callback URL you registered in GitHub must match this exactly,
// including the port. GitHub's matching is strict.
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:3000/callback';

// OAuth state is a random token we hand out at the start of the flow and
// check when GitHub bounces the user back. If it doesn't match, we refuse.
// This stops an attacker from starting a flow and swapping codes around.
const stateStore = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn(
    'GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are not set. ' +
    'Auth routes will reject requests until you set them.'
  );
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Step 1 of the OAuth flow. We redirect the user to GitHub's authorize
// screen with our client id and the scopes we need.
app.get('/auth', (req, res) => {
  if (!CLIENT_ID) {
    return res.status(500).send('GitHub client id is not configured on the server.');
  }

  const state = crypto.randomBytes(32).toString('hex');
  stateStore.set(state, Date.now());

  const scope = 'public_repo';
  const url = 'https://github.com/login/oauth/authorize' +
    '?client_id=' + encodeURIComponent(CLIENT_ID) +
    '&redirect_uri=' + encodeURIComponent(CALLBACK_URL) +
    '&scope=' + encodeURIComponent(scope) +
    '&state=' + encodeURIComponent(state);

  res.redirect(url);
});

// Step 2. GitHub sends the user back here with a code and state. We trade
// the code for an access token and hand the token to the browser.
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).send('GitHub credentials are not configured on the server.');
  }

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code.' });
  }

  const issuedAt = stateStore.get(state);
  if (!issuedAt || Date.now() - issuedAt > STATE_TTL_MS) {
    return res.status(400).json({ error: 'Invalid or expired state parameter.' });
  }
  stateStore.delete(state);

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: CALLBACK_URL,
      }),
    });

    const data = await tokenRes.json();

    if (data.error || !data.access_token) {
      return res.status(400).json({ error: data.error_description || data.error || 'Token exchange failed.' });
    }

    // Return the token to the frontend so app.js can call the GitHub API.
    res.json({
      access_token: data.access_token,
      scope: data.scope,
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach GitHub.' });
  }
});

app.listen(PORT, () => {
  console.log(`Stardance Project Studio running at http://localhost:${PORT}`);
});