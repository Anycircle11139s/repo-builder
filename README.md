# Repo-Builder

**A tool that helps you create github repositories.**

An interactive repository builder that allows you to build READMEs and upload files with ease. The tool authenticates with github and can create/edit repositories itself.

## What is this?

A repository builder which authenticates with github and allows you to create your own repositories for hack club stardance easily. It asks you a set of pre-coded questions to create the perfect readme and compiles everything together to ensure you have the best Github repo.

## How to run it

Start by downloading and extracting the zip file here: https://github.com/Anycircle11139s/repo-builder/releases/tag/Demo

1. Make sure you have a GitHub OAuth app registered. Go to <https://github.com/settings/applications/new> and create one:

`Homepage URL: http://localhost:3000`

`Authorization callback URL: http://localhost:3000/callback`

After registering, GitHub shows you the Client ID and the Client Secret. Copy both.

2. Create .env in the project root the folder that contains server.js, not inside public:

`cd ~/stardance-studio`

`touch .env`

Open it in a text editor (or nano .env in the terminal) and paste:

`GITHUB_CLIENT_ID=your_client_id_here`

`GITHUB_CLIENT_SECRET=your_client_secret_here`

`CALLBACK_URL=http://localhost:3000/callback`

3. Start the server: 
`Node server.js`

## Features

- No stub files. The README is the only file the app generates; everything else is your own.
- Binary-safe uploads, meaning images, PDFs, any non-text file ships intact
- Multiple files at once, up to 5 MB each; re-uploading a name replaces the old file instead of duplicating it
- Every README section is editable and pre-filled with your defaults
- Live README preview as you type, rendered right in the browser
- Handles the auto-init README GitHub drops into fresh repos, so the first push doesn't fail
- Session persists across reloads and tabs, so you don't re-auth for every ship
- macOS-style black and white UI

## Tags

`web`, `html`, `css`

## About

Built with plain HTML, CSS and JavaScript. The backend is a small Express server that handles GitHub OAuth so the client secret never reaches the browser.

Made for Hack Club Stardance, 2026 by @NotALarp
