(function () {
  'use strict';

  const byId = (id) => document.getElementById(id);

  const els = {
    stepNav: byId('stepNav'),
    steps: document.querySelectorAll('.step'),
    panels: document.querySelectorAll('.step-panel'),
    authBadge: byId('authBadge'),
    authText: byId('authText'),
    signOutBtn: byId('signOutBtn'),

    repoName: byId('repoName'),
    projectName: byId('projectName'),
    tagline: byId('tagline'),
    description: byId('description'),
    tagsInput: byId('tagsInput'),
    tagsList: byId('tagsList'),

    sectWhat: byId('sectWhat'),
    sectHow: byId('sectHow'),
    sectFeatures: byId('sectFeatures'),
    sectAbout: byId('sectAbout'),
    madeFor: byId('madeFor'),

    addFilesBtn: byId('addFilesBtn'),
    fileInput: byId('fileInput'),
    fileList: byId('fileList'),

    preview: byId('preview'),
    previewEmpty: byId('previewEmpty'),

    previewRepo: byId('previewRepo'),
    shipBtn: byId('shipBtn'),
    progressWrap: byId('progressWrap'),
    progressFill: byId('progressFill'),
    progressText: byId('progressText'),
    result: byId('result'),
    resultTitle: byId('resultTitle'),
    resultMessage: byId('resultMessage'),
    repoLink: byId('repoLink'),
  };

  let token = localStorage.getItem('sd_token') || null;
  let username = localStorage.getItem('sd_username') || null;
  let tags = ['web', 'html', 'css'];
  let uploads = [];

  const currentYear = new Date().getFullYear();

  const DEFAULT_SECTIONS = {
    sectWhat: 'A project built for Hack Club Stardance, an online summer program where teens build technical projects and ship them to the world.',
    sectHow: 'Open index.html in a browser. The live preview in the studio is the same markdown that this README renders from.',
    sectFeatures: 'Live markdown preview that rebuilds as you type\nTag list with add and remove\nZero dependency backend for GitHub auth\nSequential push of every file to a new repo',
    sectAbout: 'Built with plain HTML, CSS and JavaScript. The backend is a small Express server that handles GitHub OAuth so the client secret never reaches the browser.',
    madeFor: 'Made for Hack Club Stardance, ' + currentYear + '.',
  };

  // Auth -----------------------------------------------------------------
  function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) setAuthError('Authorization was cancelled or refused.');
    if (!code) return;

    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    setAuthState('Connecting...');

    fetch('/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code, state: state })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.access_token) {
          token = data.access_token;
          localStorage.setItem('sd_token', token);
          setAuthState('Connected');
          resolveProfile();
          goToStep(1);
        } else {
          setAuthError(data.error || 'Could not finish the sign in.');
        }
      })
      .catch(function (err) {
        console.error('callback failed:', err);
        setAuthError('Could not reach the auth server.');
      });
  }

  function setAuthState(text) {
    els.authText.textContent = text;
    els.authBadge.classList.add('authed');
    els.authBadge.classList.remove('error');
    els.signOutBtn.classList.remove('hidden');
  }

  function setAuthError(text) {
    els.authText.textContent = text;
    els.authBadge.classList.add('error');
    els.authBadge.classList.remove('authed');
  }

  function signOut() {
    token = null;
    username = null;
    uploads = [];
    localStorage.removeItem('sd_token');
    localStorage.removeItem('sd_username');
    els.authText.textContent = 'Not connected';
    els.authBadge.classList.remove('authed', 'error');
    els.signOutBtn.classList.add('hidden');
    renderFileList();
    lockShip();
  }

  function resolveProfile() {
    if (!token) return Promise.resolve();

    const headers = {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    return fetch('https://api.github.com/user', { headers: headers })
      .then(function (res) {
        if (!res.ok) throw new Error('user');
        return res.json();
      })
      .then(function (user) {
        username = user.login;
        localStorage.setItem('sd_username', username);
        persistProfile();
      })
      .catch(function () {
        persistProfile();
      });
  }

  function persistProfile() {
    const name = els.repoName.value.trim() || 'my-stardance-project';
    els.previewRepo.textContent = (username ? username + '/' : '') + name;
  }

  // Steps ----------------------------------------------------------------
  function goToStep(index) {
    els.steps.forEach(function (step, i) {
      step.classList.toggle('active', i === index);
    });
    els.panels.forEach(function (panel, i) {
      panel.classList.toggle('active', i === index);
    });
  }

  els.stepNav.addEventListener('click', function (e) {
    const btn = e.target.closest('.step');
    if (!btn) return;
    const index = parseInt(btn.dataset.step, 10);
    if (index > 0 && !token) return;
    goToStep(index);
  });

  // Tags -----------------------------------------------------------------
  function addTag(value) {
    value = value.trim().replace(/^#/, '').toLowerCase();
    if (!value || tags.indexOf(value) !== -1) return;
    tags.push(value);
    renderTags();
    renderPreview();
  }

  function removeTag(value) {
    tags = tags.filter(function (t) { return t !== value; });
    renderTags();
    renderPreview();
  }

  function renderTags() {
    els.tagsList.innerHTML = '';
    tags.forEach(function (tag) {
      const el = document.createElement('span');
      el.className = 'tag';
      el.textContent = tag + ' ';

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'x';
      remove.setAttribute('aria-label', 'Remove ' + tag);
      remove.addEventListener('click', function () { removeTag(tag); });

      el.appendChild(remove);
      els.tagsList.appendChild(el);
    });
  }

  els.tagsInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(els.tagsInput.value);
      els.tagsInput.value = '';
    }
  });

  els.tagsInput.addEventListener('blur', function () {
    if (els.tagsInput.value.trim()) {
      addTag(els.tagsInput.value);
      els.tagsInput.value = '';
    }
  });

  // Uploaded files -------------------------------------------------------
  function addFiles(fileList) {
    Array.from(fileList || []).forEach(function (file) {
      if (file.name === 'README.md') return; 
      if (uploads.some(function (u) { return u.name === file.name; })) return;

      const reader = new FileReader();
      reader.onload = function () {
        const dataUrl = reader.result;
        uploads.push({
          name: file.name,
          base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
          size: file.size,
        });
        renderFileList();
        renderPreview();
      };
      reader.readAsDataURL(file);
    });
    els.fileInput.value = '';
  }

  function removeUpload(name) {
    uploads = uploads.filter(function (u) { return u.name !== name; });
    renderFileList();
    renderPreview();
  }

  function renderFileList() {
    els.fileList.innerHTML = '';
    uploads.forEach(function (u) {
      const li = document.createElement('li');

      const label = document.createElement('span');
      label.textContent = u.name + ' (' + Math.round(u.size / 1024) + ' KB)';

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.textContent = 'Remove';
      rm.addEventListener('click', function () { removeUpload(u.name); });

      li.appendChild(label);
      li.appendChild(rm);
      els.fileList.appendChild(li);
    });
    els.fileList.classList.toggle('hidden', uploads.length === 0);
  }

  els.addFilesBtn.addEventListener('click', function () { els.fileInput.click(); });
  els.fileInput.addEventListener('change', function () { addFiles(this.files); });

  // Markdown generation --------------------------------------------------
  function escapeMd(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escaped(text) {
    return escapeMd(text).replace(/\\/g, '');
  }

  function buildMarkdown(project, tagline, description, repo, tagList) {
    const lines = [];

    lines.push('# ' + escaped(project));
    if (tagline) { lines.push(''); lines.push('*' + escapeMd(tagline) + '*'); }
    lines.push('');
    if (description) { lines.push(description.replace(/\n/g, '\n\n')); lines.push(''); }

    const what = els.sectWhat.value.trim();
    if (what) { lines.push('## What is this?'); lines.push(''); lines.push(what); lines.push(''); }

    const how = els.sectHow.value.trim();
    if (how) { lines.push('## How to run it'); lines.push(''); lines.push(how); lines.push(''); }

    const features = els.sectFeatures.value.trim();
    if (features) {
      lines.push('## Features'); lines.push('');
      features.split('\n').forEach(function (f) {
        if (f.trim()) lines.push('- ' + f.trim());
      });
      lines.push('');
    }

    if (tagList.length) {
      lines.push('## Tags'); lines.push('');
      lines.push('`' + tagList.join('`, `') + '`');
      lines.push('');
    }

    const about = els.sectAbout.value.trim();
    if (about) { lines.push('## About'); lines.push(''); lines.push(about); lines.push(''); }

    const made = els.madeFor.value.trim();
    if (made) { lines.push(made); lines.push(''); }

    return lines.join('\n');
  }

  function renderPreview() {
    const project = els.projectName.value.trim() || 'My Stardance Project';
    const tagline = els.tagline.value.trim();
    const description = els.description.value.trim();
    const repo = els.repoName.value.trim() || 'my-stardance-project';

    const html = simpleMarkdown(buildMarkdown(project, tagline, description, repo, tags));

    els.preview.innerHTML = html;

    const filled = els.projectName.value.trim() || els.description.value.trim();
    els.previewEmpty.classList.toggle('hidden', Boolean(filled));

    persistProfile();
    refreshShipState();
  }

  function simpleMarkdown(md) {
    let out = '';
    const lines = md.split('\n');
    let inList = false;
    let inCode = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === '```') {
        inCode = !inCode;
        if (!inCode) out += '</code></pre>';
        continue;
      }
      if (inCode) {
        out += '<code>' + escapeHtml(line) + '</code>\n';
        continue;
      }

      if (line.startsWith('# ')) {
        out += '<h1>' + inline(line.slice(2)) + '</h1>\n';
      } else if (line.startsWith('## ')) {
        out += '<h2>' + inline(line.slice(3)) + '</h2>\n';
      } else if (line.startsWith('- ')) {
        if (!inList) { out += '<ul>\n'; inList = true; }
        out += '<li>' + inline(line.slice(2)) + '</li>\n';
      } else if (line.trim() === '') {
        if (inList) { out += '</ul>\n'; inList = false; }
      } else {
        out += '<p>' + inline(line) + '</p>\n';
      }
    }

    if (inList) out += '</ul>\n';
    return out;
  }

  function inline(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  ['repoName', 'projectName', 'tagline', 'description',
   'sectWhat', 'sectHow', 'sectFeatures', 'sectAbout', 'madeFor'].forEach(function (id) {
    byId(id).addEventListener('input', renderPreview);
  });

  els.repoName.addEventListener('input', persistProfile);

  // Shipping -------------------------------------------------------------
  function lockShip() {
    els.shipBtn.disabled = true;
  }

  function refreshShipState() {
    const ready = Boolean(
      token &&
      username &&
      els.repoName.value.trim() &&
      els.projectName.value.trim()
    );
    els.shipBtn.disabled = !ready;
  }

  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async function githubFetch(url, options) {
    const headers = {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    };

    const res = await fetch(url, Object.assign({}, options, { headers: headers }));
    const body = await res.json().catch(function () { return {}; });

    if (!res.ok) {
      const detail = body.message || 'GitHub returned ' + res.status;
      const error = new Error(detail);
      error.status = res.status;
      throw error;
    }
    return body;
  }

  function setProgress(percent, text) {
    els.progressWrap.classList.remove('hidden');
    els.progressFill.style.width = percent + '%';
    els.progressText.textContent = text;
  }

  async function ship() {
    lockShip();
    els.result.classList.add('hidden');

    const repo = els.repoName.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const project = els.projectName.value.trim();
    const tagline = els.tagline.value.trim();
    const description = els.description.value.trim();

    const files = {};
    files['README.md'] = toBase64(buildMarkdown(project, tagline, description, repo, tags));
    uploads.forEach(function (u) { files[u.name] = u.base64; });

    try {
      setProgress(4, 'Resolving your profile');
      if (!username) await resolveProfile();

      setProgress(12, 'Creating repository: ' + repo);

      const repoData = await githubFetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: repo,
          description: tagline || project,
          'private': false,
          auto_init: true,
        }),
      });

      await new Promise(function (resolve) { setTimeout(resolve, 1200); });

      const owner = repoData.owner.login;
      const repoFull = owner + '/' + repo;
      els.previewRepo.textContent = repoFull;

      let done = 0;
      const total = Object.keys(files).length;

      for (const name of Object.keys(files)) {
        done += 1;
        const percent = 30 + Math.round((done / total) * 60);
        setProgress(percent, 'Writing ' + name);


        let sha = '';
        const existing = await githubFetch(
          'https://api.github.com/repos/' + repoFull + '/contents/' + encodeURIComponent(name),
          { method: 'GET' }
        ).catch(function () { return null; });
        if (existing && existing.sha) sha = existing.sha;

        const payload = {
          message: 'Add ' + name,
          content: files[name], 
        };
        if (sha) payload.sha = sha;

        await githubFetch(
          'https://api.github.com/repos/' + repoFull + '/contents/' + encodeURIComponent(name),
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
      }

      setProgress(100, 'Done');

      els.resultTitle.textContent = 'Shipped';
      els.resultMessage.textContent = 'Your repository is live and public.';
      els.repoLink.classList.remove('hidden');
      els.repoLink.href = 'https://github.com/' + repoFull;
      els.result.classList.remove('hidden');
    } catch (err) {
      els.resultTitle.textContent = 'Something went wrong';
      els.resultMessage.textContent = err.message || 'The push failed. Check that the repo name is free and try again.';
      els.result.classList.remove('hidden');
      refreshShipState();
    }
  }

  els.shipBtn.addEventListener('click', ship);
  els.signOutBtn.addEventListener('click', signOut);

  // Boot ---------------------------------------------------------------
  Object.keys(DEFAULT_SECTIONS).forEach(function (key) {
    if (els[key] && !els[key].value.trim()) els[key].value = DEFAULT_SECTIONS[key];
  });
  renderTags();
  renderFileList();

  if (token) {
    setAuthState('Connected');
    resolveProfile();
    goToStep(1);
  } else {
    lockShip();
  }

  handleCallback();
  renderPreview();
})();
