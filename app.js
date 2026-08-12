(function () {
  'use strict';

  // DOM helpers -----------------------------------------------------------
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

    fileInput: byId('fileInput'),
    fileList: byId('fileList'),
    uploadError: byId('uploadError'),

    secWhat: byId('secWhat'),
    secHow: byId('secHow'),
    secFeatures: byId('secFeatures'),
    secAbout: byId('secAbout'),
    secMade: byId('secMade'),

    preview: byId('preview'),
    previewEmpty: byId('previewEmpty'),

    previewRepo: byId('previewRepo'),
    previewFiles: byId('previewFiles'),
    shipBtn: byId('shipBtn'),
    progressWrap: byId('progressWrap'),
    progressFill: byId('progressFill'),
    progressText: byId('progressText'),
    result: byId('result'),
    resultTitle: byId('resultTitle'),
    resultMessage: byId('resultMessage'),
    repoLink: byId('repoLink'),
  };

  // State ----------------------------------------------------------------
  let token = localStorage.getItem('sd_token') || null;
  let username = localStorage.getItem('sd_username') || null;
  let tags = [];
  let uploads = []; // { name, size, base64 }

  const currentYear = new Date().getFullYear();
  const MAX_FILE_BYTES = 5 * 1024 * 1024;

  const DEFAULT_SECTIONS = {
    what: 'A project built for Hack Club Stardance, an online summer program where teens build technical projects and ship them to the world.',
    how: 'Open `index.html` in a browser. The live preview in the studio is the same markdown that this README renders from.',
    features: [
      'Live markdown preview that rebuilds as you type',
      'Tag list with add and remove',
      'Zero dependency backend for GitHub auth',
      'Sequential push of every file to a new repo',
    ].join('\n'),
    about: 'Built with plain HTML, CSS and JavaScript. The backend is a small Express server that handles GitHub OAuth so the client secret never reaches the browser.',
    made: 'Made for Hack Club Stardance, ' + currentYear + '.',
  };

  // Auth -----------------------------------------------------------------
  // If GitHub bounced us back with a code, trade it for a token right away,
  // then scrub the URL so the code never sits in the address bar.
  function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setAuthError('Authorization was cancelled or refused.');
    }

    if (!code) {
      return;
    }

    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    setAuthState('Connecting...');

    fetch('/callback?code=' + encodeURIComponent(code))
      .then(function (res) {
        return res.json();
      })
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
      .catch(function () {
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
    localStorage.removeItem('sd_token');
    localStorage.removeItem('sd_username');
    els.authText.textContent = 'Not connected';
    els.authBadge.classList.remove('authed', 'error');
    els.signOutBtn.classList.add('hidden');
    lockShip();
  }

  // Ask GitHub who we are so the repo is created under the right owner.
  // Returns a promise so ship() can await it. If this fails we keep going:
  // GitHub will reject the repo creation anyway if the token is bad, which
  // is the real signal.
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
        refreshShipState();
      })
      .catch(function () {
        persistProfile();
        refreshShipState();
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

  // Uploads --------------------------------------------------------------
  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function addUpload(file) {
    if (file.size > MAX_FILE_BYTES) {
      els.uploadError.textContent = file.name + ' is over 5 MB, which the studio skips to keep uploads fast.';
      return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      // Reading as a data URL keeps binary files intact; strip the prefix
      // and keep the base64 payload, which is what the GitHub API wants.
      const dataUrl = reader.result;
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);

      // Same name twice just replaces the earlier one.
      uploads = uploads.filter(function (u) { return u.name !== file.name; });
      uploads.push({ name: file.name, size: file.size, base64: base64 });
      renderFiles();
      renderPreview();
    };
    reader.readAsDataURL(file);
  }

  function removeUpload(name) {
    uploads = uploads.filter(function (u) { return u.name !== name; });
    renderFiles();
    renderPreview();
  }

  function renderFiles() {
    els.fileList.innerHTML = '';

    if (!uploads.length) {
      const empty = document.createElement('li');
      empty.className = 'file-empty';
      empty.textContent = 'No files yet. Pick your project files above.';
      els.fileList.appendChild(empty);
      return;
    }

    uploads.forEach(function (u) {
      const item = document.createElement('li');
      item.className = 'file-item';

      const info = document.createElement('span');
      info.className = 'file-info';
      info.textContent = u.name + ' (' + formatBytes(u.size) + ')';

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'file-remove';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove ' + u.name);
      remove.addEventListener('click', function () { removeUpload(u.name); });

      item.appendChild(info);
      item.appendChild(remove);
      els.fileList.appendChild(item);
    });

    els.uploadError.textContent = '';
  }

  els.fileInput.addEventListener('change', function () {
    Array.prototype.forEach.call(els.fileInput.files, addUpload);
    els.fileInput.value = '';
  });

  // Markdown generation --------------------------------------------------
  // User text is entity-escaped so it can't leak raw HTML into the README.
  // The preview renders from that already-escaped markdown.
  function escapeMd(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderPreview() {
    const project = els.projectName.value.trim() || 'My Stardance Project';
    const tagline = els.tagline.value.trim();
    const description = els.description.value.trim();

    const md = buildMarkdown(project, tagline, description, tags);
    els.preview.innerHTML = simpleMarkdown(md);

    const filled = els.projectName.value.trim() || els.description.value.trim();
    els.previewEmpty.classList.toggle('hidden', Boolean(filled));

    persistProfile();
    renderFilesSummary();
    refreshShipState();
  }

  function sectionValues() {
    return {
      what: els.secWhat.value.trim(),
      how: els.secHow.value.trim(),
      features: els.secFeatures.value.trim(),
      about: els.secAbout.value.trim(),
      made: els.secMade.value.trim(),
    };
  }

  function buildMarkdown(project, tagline, description, tagList) {
    const lines = [];
    const sec = sectionValues();

    lines.push('# ' + escapeMd(project));
    if (tagline) {
      lines.push('');
      lines.push('*' + escapeMd(tagline) + '*');
    }
    lines.push('');

    if (description) {
      lines.push(escapeMd(description).replace(/\n/g, '\n\n'));
      lines.push('');
    }

    if (sec.what) {
      lines.push('## What is this?');
      lines.push('');
      lines.push(escapeMd(sec.what).replace(/\n/g, '\n\n'));
      lines.push('');
    }

    if (sec.how) {
      lines.push('## How to run it');
      lines.push('');
      lines.push(escapeMd(sec.how).replace(/\n/g, '\n\n'));
      lines.push('');
    }

    if (sec.features) {
      const features = sec.features.split('\n').map(function (f) { return f.trim(); }).filter(Boolean);
      if (features.length) {
        lines.push('## Features');
        lines.push('');
        features.forEach(function (f) { lines.push('- ' + escapeMd(f)); });
        lines.push('');
      }
    }

    if (tagList.length) {
      lines.push('## Tags');
      lines.push('');
      lines.push('`' + tagList.join('`, `') + '`');
      lines.push('');
    }

    if (sec.about) {
      lines.push('## About');
      lines.push('');
      lines.push(escapeMd(sec.about).replace(/\n/g, '\n\n'));
      lines.push('');
    }

    if (sec.made) {
      lines.push(escapeMd(sec.made));
      lines.push('');
    }

    return lines.join('\n');
  }

  function renderFilesSummary() {
    const names = ['README.md'].concat(uploads.map(function (u) { return u.name; }));
    els.previewFiles.textContent = names.join(', ');
  }

  // A tiny markdown renderer, just enough for the README we generate.
  // The input is already entity-escaped by buildMarkdown, so we only apply
  // inline styles instead of escaping everything again.
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
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  // Only used for raw code fences, which buildMarkdown never emits.
  function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Wire up every input to rebuild the preview immediately.
  ['repoName', 'projectName', 'tagline', 'description', 'secWhat', 'secHow', 'secFeatures', 'secAbout', 'secMade'].forEach(function (id) {
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
      els.projectName.value.trim() &&
      uploads.length > 0
    );
    els.shipBtn.disabled = !ready;
  }

  // Reliable string to base64 for the generated README. This handles emoji
  // and other multibyte characters that plain btoa would break on.
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

  // Write one file to the repo. On a 422 for README.md it is almost always
  // because the auto-init commit already created one, so fetch its sha and
  // retry before giving up.
  async function writeFile(repoFull, name, contentEncoded) {
    const url = 'https://api.github.com/repos/' + repoFull + '/contents/' + name;
    const payload = {
      message: 'Add ' + name,
      content: contentEncoded,
    };

    try {
      await githubFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (err.status === 422 && name === 'README.md') {
        const existing = await githubFetch(url, { headers: {} });
        payload.sha = existing.sha;
        await githubFetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        throw err;
      }
    }
  }

  async function ship() {
    lockShip();
    els.result.classList.add('hidden');

    const repo = els.repoName.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const project = els.projectName.value.trim();
    const tagline = els.tagline.value.trim();
    const description = els.description.value.trim();

    if (!uploads.length) {
      els.resultTitle.textContent = 'Nothing to ship';
      els.resultMessage.textContent = 'Add at least one project file before shipping.';
      els.result.classList.remove('hidden');
      refreshShipState();
      return;
    }

    // README.md is generated; everything else is whatever the user uploaded.
    const files = { 'README.md': buildMarkdown(project, tagline, description, tags) };
    uploads.forEach(function (u) {
      files[u.name] = u.base64;
    });

    try {
      setProgress(4, 'Resolving your profile');
      if (!username) {
        await resolveProfile();
      }

      setProgress(10, 'Creating repository: ' + repo);

      const repoData = await githubFetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: repo,
          description: tagline || project,
          private: false,
          auto_init: true,
        }),
      });

      // GitHub creates the repo asynchronously; give it a moment so the
      // default branch exists before we write files to it.
      await new Promise(function (resolve) { setTimeout(resolve, 1200); });

      const owner = repoData.owner.login;
      const repoFull = owner + '/' + repo;
      els.previewRepo.textContent = repoFull;

      let done = 0;
      const total = Object.keys(files).length;

      for (const name of Object.keys(files)) {
        done += 1;
        const percent = 26 + Math.round((done / total) * 68);
        setProgress(percent, 'Writing ' + name);

        const contentEncoded = name === 'README.md' ? toBase64(files[name]) : files[name];
        await writeFile(repoFull, name, contentEncoded);
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
  // Pre-fill the editable README sections with the defaults.
  els.secWhat.value = DEFAULT_SECTIONS.what;
  els.secHow.value = DEFAULT_SECTIONS.how;
  els.secFeatures.value = DEFAULT_SECTIONS.features;
  els.secAbout.value = DEFAULT_SECTIONS.about;
  els.secMade.value = DEFAULT_SECTIONS.made;

  if (token) {
    setAuthState('Connected');
    resolveProfile();
    goToStep(1);
  } else {
    lockShip();
  }

  handleCallback();

  // First render so empty states and the README preview look right.
  renderPreview();
})();