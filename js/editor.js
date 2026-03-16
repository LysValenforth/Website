// ── Auth Guard ────────────────────────────────────────────────────────────────
(function() {
  const auth     = firebase.auth();
  const overlay  = document.getElementById('login-overlay');
  const loginBtn = document.getElementById('login-btn');
  const emailEl  = document.getElementById('login-email');
  const passEl   = document.getElementById('login-password');
  const errorEl  = document.getElementById('login-error');
  const signOutBtn = document.getElementById('btn-sign-out');

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }
  auth.onAuthStateChanged(function(user) {
    if (user) {
      overlay.style.display = 'none';
    } else {
      overlay.style.display = 'flex';
      setTimeout(() => emailEl && emailEl.focus(), 100);
    }
  });

  // Login button
  loginBtn && loginBtn.addEventListener('click', async function() {
    const email    = emailEl.value.trim();
    const password = passEl.value;
    errorEl.style.display = 'none';

    if (!email || !password) { showError('Please enter your email and password.'); return; }

    loginBtn.disabled    = true;
    loginBtn.textContent = 'Signing in…';

    try {
      await auth.signInWithEmailAndPassword(email, password);
      passEl.value = '';
    } catch (err) {
      loginBtn.disabled    = false;
      loginBtn.textContent = 'Sign in';
      const msgs = {
        'auth/user-not-found':   'No account found with that email.',
        'auth/wrong-password':   'Incorrect password.',
        'auth/invalid-email':    'Invalid email address.',
        'auth/too-many-requests':'Too many attempts. Try again later.',
      };
      showError(msgs[err.code] || 'Sign in failed. Please try again.');
    }
  });

  // Allow Enter key to submit
  [emailEl, passEl].forEach(el => el && el.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') loginBtn.click();
  }));

  // Sign out button
  signOutBtn && signOutBtn.addEventListener('click', function() {
    auth.signOut();
  });
}());

let currentPostId     = null;
let currentCollection = 'posts';
let isSaving          = false;
let isDirty           = false;
let lastSavedAt       = null;
let wordCountTimer    = null;

const MEDIAHUB_CATS = ['beats', 'movies', 'tvshows'];
const CODE_CAT      = 'code';

// ── Per-category field panel IDs ─────────────────────────────────────────────
const MEDIAHUB_PANELS = {
  beats:   'mediahub-beats-fields',
  movies:  'mediahub-movies-fields',
  tvshows: 'mediahub-tvshows-fields',
  code:    'mediahub-code-fields',
};

let currentCategoryFilter = null; // null = show all, 'code' = show only code
let currentSubCatFilter   = 'all'; // for sidebar pills: 'all' | 'blog'|'poem'|'story' | 'beats'|'movies'|'tvshows'

// ── Code image preview ───────────────────────────────────────────────────────

function updateCodeImagePreview(url) {
  const wrap = document.getElementById('code-image-preview-wrap');
  const img  = document.getElementById('code-image-preview-img');
  if (!wrap || !img) return;
  if (url) {
    img.src = url;
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
    img.src = '';
  }
}

// ── Dirty flag ────────────────────────────────────────────────────────────────

function markDirty() {
  if (!currentPostId) return;
  isDirty = true;
  setSaveStatus('unsaved');
}

function markClean() {
  isDirty    = false;
  lastSavedAt = Date.now();
  updateLastSavedLabel();
}

function updateLastSavedLabel() {
  if (!lastSavedAt) return;
  const secs = Math.round((Date.now() - lastSavedAt) / 1000);
  const label = secs < 10 ? 'just now'
              : secs < 60 ? `${secs}s ago`
              : secs < 3600 ? `${Math.round(secs / 60)}m ago`
              : 'a while ago';
  ['save-status-text', 'save-status-text2'].forEach(id => {
    const el = document.getElementById(id);
    if (el && !isDirty) el.textContent = `Saved ${label}`;
  });
}

// ── Word / character count ────────────────────────────────────────────────────

function updateWordCount() {
  clearTimeout(wordCountTimer);
  wordCountTimer = setTimeout(() => {
    const sections  = document.querySelectorAll('#editor-sections [contenteditable]');
    let text = '';
    sections.forEach(el => text += ' ' + (el.textContent || ''));
    text = text.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const chars = text.replace(/\s/g, '').length;
    const el = document.getElementById('word-count-display');
    if (el) el.textContent = words ? `${words} words · ${chars} chars` : '';
  }, 300);
}


// ── Editor Mode (writing | mediahub | gallery) ───────────────────────────────
// Controls whether the canvas + toolbar are visible or replaced with a panel msg

function setEditorMode(mode) {
  const toolbar  = document.querySelector('.editor-toolbar-top');
  const canvas   = document.querySelector('.editor-canvas');
  const noPost   = document.getElementById('no-post-msg');
  const modeMsg  = document.getElementById('editor-mode-msg');

  if (mode === 'writing') {
    if (toolbar)  toolbar.style.display  = '';
    if (canvas)   canvas.style.display   = '';
    if (modeMsg)  modeMsg.style.display  = 'none';
  } else {
    // mediahub or gallery — hide the page canvas entirely
    if (toolbar)  toolbar.style.display  = 'none';
    if (canvas)   canvas.style.display   = 'none';
    if (modeMsg) {
      modeMsg.style.display = 'flex';
      const icon  = modeMsg.querySelector('.mode-msg-icon');
      const title = modeMsg.querySelector('.mode-msg-title');
      const sub   = modeMsg.querySelector('.mode-msg-sub');
      if (mode === 'code') {
        if (icon)  icon.innerHTML  = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>';
        if (title) title.textContent = 'Code Project';
        if (sub)   sub.textContent   = 'Fill in the details, links and image in the right panel, then hit Save.';
      } else if (mode === 'mediahub') {
        if (icon)  icon.innerHTML  = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/></svg>';
        if (title) title.textContent = 'MediaHub Item';
        if (sub)   sub.textContent   = 'Fill in all the details in the right panel, then hit Save.';
      } else {
        if (icon)  icon.innerHTML  = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><polyline points="21,15 16,10 5,21"/></svg>';
        if (title) title.textContent = 'Gallery Manager';
        if (sub)   sub.textContent   = 'Use the right panel to create collections and manage photos.';
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  injectGalleryTab();  
  injectGalleryPanel();
  loadPostsList();
  bindEditorControls();
  bindFormatting();
  bindImageUpload();
  bindSidebarTabs();
  bindCategoryChange();
  bindSlugAutoFill();
  bindTipsCollapse();
  bindSidebarCatPills();
  showSidebarCatFilter('posts'); // default tab is Posts

  // Load item from URL params
  const params   = new URLSearchParams(window.location.search);
  const urlId    = params.get('id');
  const urlColl  = params.get('collection') || 'posts';
  if (urlId) {
    currentCollection = urlColl;
    setActiveTab(urlColl === 'mediahub' ? 'mediahub' : 'posts');
    loadPostIntoEditor(urlId);
  }
  updatePreviewButton();

  setInterval(autoSave, 5000);

  // Refresh "Saved Xm ago" label every 30s
  setInterval(updateLastSavedLabel, 30000);

  // Ctrl+S / Cmd+S to save
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    if (e.key === 's') {
      e.preventDefault();
      saveCurrentPost();
      return;
    }
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      showTemplatePicker();
      return;
    }
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (currentPostId) window.open(`post.html?id=${currentPostId}`, '_blank');
      return;
    }
    if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      if (typeof duplicateLastFocusedSection === 'function') duplicateLastFocusedSection();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveLastFocusedSection(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveLastFocusedSection(1);
      return;
    }
  });

  // Warn before leaving with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Mark dirty when any right-panel field changes
  document.querySelectorAll('.field-input, .field-select').forEach(el => {
    el.addEventListener('input',  markDirty);
    el.addEventListener('change', markDirty);
  });

  // Code image preview — live update when URL field changes
  document.getElementById('code-image-url')?.addEventListener('input', (e) => {
    updateCodeImagePreview(e.target.value.trim());
  });
  document.getElementById('code-image-url')?.addEventListener('change', (e) => {
    updateCodeImagePreview(e.target.value.trim());
  });
});

// ── Sidebar Tabs ──────────────────────────────────────────────────────────────

function bindSidebarTabs() {
  document.querySelectorAll('.sidebar-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const which = tab.dataset.tab;

      if (which === 'gallery') {
        setActiveTab('gallery');
        showGalleryPanel(true);
        setEditorMode('gallery');
        return;
      }

      showGalleryPanel(false);
      setActiveTab(which);

      if (which === 'code') {
        currentCollection = 'mediahub';
        currentCategoryFilter = 'code';
        setEditorMode('code');
      } else {
        currentCategoryFilter = which === 'mediahub' ? 'mediahub-only' : null;
        currentCollection = which === 'mediahub' ? 'mediahub' : 'posts';
        setEditorMode(which === 'mediahub' ? 'mediahub' : 'writing');
      }

      // Show correct sub-category pills, reset selection
      currentSubCatFilter = 'all';
      showSidebarCatFilter(which);

      loadPostsList();
    });
  });
}

function setActiveTab(which) {
  document.querySelectorAll('.sidebar-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === which);
  });
}

// ── Sidebar sub-category filter pills ────────────────────────────────────────
function showSidebarCatFilter(tab) {
  const postsPills = document.getElementById('sidebar-cat-filter-posts');
  const mediaPills = document.getElementById('sidebar-cat-filter-mediahub');
  if (postsPills) postsPills.style.display = tab === 'posts'     ? '' : 'none';
  if (mediaPills) mediaPills.style.display = tab === 'mediahub'  ? '' : 'none';

  // Reset active state on all pills in whichever group is now showing
  const active = tab === 'posts' ? postsPills : tab === 'mediahub' ? mediaPills : null;
  if (active) {
    active.querySelectorAll('.sidebar-cat-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.cat === 'all');
    });
  }
}

function bindSidebarCatPills() {
  ['sidebar-cat-filter-posts', 'sidebar-cat-filter-mediahub'].forEach(id => {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    wrap.querySelectorAll('.sidebar-cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        currentSubCatFilter = pill.dataset.cat;
        wrap.querySelectorAll('.sidebar-cat-pill').forEach(p =>
          p.classList.toggle('active', p.dataset.cat === currentSubCatFilter)
        );
        loadPostsList();
      });
    });
  });
}

// ── Posts List ────────────────────────────────────────────────────────────────

async function loadPostsList() {
  const list = document.getElementById('posts-list');
  if (!list) return;
  list.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';

  try {
    let items = currentCollection === 'mediahub'
      ? await getAllMediaHub()
      : await getAllPosts();

    // Filter by category if set
    if (currentCategoryFilter === 'code') {
      items = items.filter(i => i.category === 'code');
    } else if (currentCategoryFilter === 'mediahub-only') {
      items = items.filter(i => i.category !== 'code');
    }

    // Apply sidebar sub-category pill filter
    if (currentSubCatFilter && currentSubCatFilter !== 'all') {
      items = items.filter(i => (i.category || '').toLowerCase() === currentSubCatFilter);
    }

    const searchInput = document.getElementById('sidebar-search');

    function render(all) {
      if (all.length === 0) {
        list.innerHTML = '<p class="empty-posts">No items yet. Create one!</p>';
        return;
      }
      list.innerHTML = '';
      all.forEach(item => {
        const el  = document.createElement('div');
        const isDraft    = item.published === false;
        const isFeatured = !!item.featured;
        el.className = 'post-list-item'
          + (item.id === currentPostId ? ' active' : '')
          + (isDraft ? ' is-draft' : '');
        el.dataset.id = item.id;
        const date = item.date
          ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '';
        const draftBadge    = isDraft    ? '<span class="post-list-draft">Draft</span>' : '';
        const featuredBadge = isFeatured ? '<span class="post-list-featured"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;display:inline-block;vertical-align:middle;margin-right:3px;"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg></span>' : '';
        el.innerHTML = `
          <div class="post-list-title">${featuredBadge}${item.title} ${draftBadge}</div>
          <div class="post-list-meta">
            <span class="post-list-category">${item.category || currentCollection}</span>
            <span>${date}</span>
          </div>
        `;
        el.addEventListener('click', () => loadPostIntoEditor(item.id));
        list.appendChild(el);
      });
    }

    render(items);

    if (searchInput) {
      // Clone to remove stale listeners from prior renders
      const fresh = searchInput.cloneNode(true);
      searchInput.parentNode.replaceChild(fresh, searchInput);
      fresh.addEventListener('input', () => {
        const q = fresh.value.toLowerCase();
        render(items.filter(i =>
          i.title.toLowerCase().includes(q) ||
          (i.creator || '').toLowerCase().includes(q) ||
          (i.genre   || '').toLowerCase().includes(q)
        ));
      });
    }
  } catch (err) {
    console.error('loadPostsList error:', err);
    list.innerHTML = '<p class="empty-posts" style="color:var(--alert-red);">Error loading items.</p>';
  }
}

// ── Load Item into Editor ─────────────────────────────────────────────────────

async function loadPostIntoEditor(id) {
  try {
    const item = currentCollection === 'mediahub'
      ? await getMediaHubById(id)
      : await getPostById(id);

    if (!item) { showToast('Item not found.', 'error'); return; }

    currentPostId = id;

    // Common fields
    safeSet('post-title-input', item.title);
    safeSet('post-date', item.date ? item.date.slice(0, 10) : '');

    const category = item.category || (currentCollection === 'mediahub' ? 'beats' : 'blog');
    const sel = document.getElementById('post-category');
    if (sel) sel.value = category;

    // Slug, excerpt, cover, published (writing posts only)
    safeSet('post-slug-input',    item.slug    || slugify(item.title || ''));
    safeSet('post-excerpt-input', item.excerpt || '');
    safeSet('post-cover-input',   item.coverImage || '');
    const pubToggle = document.getElementById('post-published-toggle');
    if (pubToggle) pubToggle.checked = item.published !== false; // default true

    // Show/hide the right mediahub panel
    if (currentCollection === 'mediahub') {
      showMediaHubFields(category);
      fillMediaHubFields(category, item);
      setEditorMode(category === 'code' ? 'code' : 'mediahub');
    } else {
      showMediaHubFields(null);
      setEditorMode('writing');
    }

    // Show canvas (only matters when in writing mode)
    document.getElementById('no-post-msg').style.display         = 'none';
    document.getElementById('editor-canvas-inner').style.display = 'block';

    // Rebuild sections
    const container = document.getElementById('editor-sections');
    container.innerHTML = '';
    if (item.sections && item.sections.length > 0) {
      item.sections.forEach(sec => addSection(sec));
    } else if (currentCollection !== 'mediahub') {
      addSection({ type: 'text', content: item.content || '' });
    }

    setSaveStatus('saved');
    markClean();
    highlightActivePost(id);
    updateWordCount();
    updatePreviewButton();
    refreshSectionOrderList();

    // Load featured flag
    const featuredToggle = document.getElementById('post-featured-toggle');
    if (featuredToggle) featuredToggle.checked = !!item.featured;

    // Load cover image preview
    const coverVal = document.getElementById('post-cover-input')?.value?.trim();
    if (coverVal) {
      const coverImg  = document.getElementById('post-cover-preview-img');
      const coverWrap = document.getElementById('post-cover-preview-wrap');
      if (coverImg)  coverImg.src = coverVal;
      if (coverWrap) coverWrap.style.display = 'block';
    }

    const url = new URL(window.location);
    url.searchParams.set('id', id);
    url.searchParams.set('collection', currentCollection);
    window.history.replaceState({}, '', url);
  } catch (err) {
    console.error('loadPostIntoEditor error:', err);
    showToast('Failed to load item.', 'error');
  }
}

function highlightActivePost(id) {
  document.querySelectorAll('.post-list-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
}

// ── MediaHub field show/hide and fill ─────────────────────────────────────────

function showMediaHubFields(category) {
  // Hide all panels first
  Object.values(MEDIAHUB_PANELS).forEach(panelId => {
    const el = document.getElementById(panelId);
    if (el) el.style.display = 'none';
  });
  if (!category) return;
  const panelId = MEDIAHUB_PANELS[category];
  if (panelId) {
    const el = document.getElementById(panelId);
    if (el) el.style.display = 'block';
  }
}

function fillMediaHubFields(category, item) {
  if (category === 'beats') {
    safeSet('beats-creator',     item.creator     || item.artistName || '');
    safeSet('beats-genre',       item.genre       || '');
    safeSet('beats-image-url',   item.imageURL    || '');
    safeSet('beats-description', item.description || '');
    safeSet('beats-song-link',   item.songLink    || '');
    safeSet('beats-artist-link', item.artistLink  || '');
    setAudioURL(item.audioURL || '');
  } else if (category === 'movies') {
    safeSet('movies-genre',       item.genre       || '');
    safeSet('movies-image-url',   item.imageURL    || '');
    safeSet('movies-description', item.description || '');
    safeSet('movies-creator',     item.creator     || '');
    safeSet('movies-stars',       item.stars       || '');
    safeSet('movies-notes',       item.notes       || '');
    safeSet('movies-info-link',   item.infoLink    || '');
    safeSet('movies-video-url',   item.videoURL    || '');
    const mRatingWrap = document.getElementById('movies-star-rating');
    if (mRatingWrap && mRatingWrap._setRating) mRatingWrap._setRating(parseInt(item.rating) || 0);
    else safeSet('movies-rating', item.rating || '');
  } else if (category === 'tvshows') {
    safeSet('tvshows-genre',       item.genre       || '');
    safeSet('tvshows-image-url',   item.imageURL    || '');
    safeSet('tvshows-description', item.description || '');
    safeSet('tvshows-creator',     item.creator     || '');
    safeSet('tvshows-stars',       item.stars       || '');
    safeSet('tvshows-notes',       item.notes       || '');
    safeSet('tvshows-info-link',   item.infoLink    || '');
    safeSet('tvshows-video-url',   item.videoURL    || '');
    const tvRatingWrap = document.getElementById('tvshows-star-rating');
    if (tvRatingWrap && tvRatingWrap._setRating) tvRatingWrap._setRating(parseInt(item.rating) || 0);
    else safeSet('tvshows-rating', item.rating || '');
  } else if (category === 'code') {
    safeSet('code-description', item.description || '');
    safeSet('code-image-url',   item.imageURL    || '');
    safeSet('code-github-url',  item.githubURL   || '');
    safeSet('code-live-url',    item.liveURL     || '');
    safeSet('code-tags',        item.tags        || '');
    const statusEl = document.getElementById('code-status');
    if (statusEl) statusEl.value = item.status || 'live';
    const bannerEl = document.getElementById('code-banner');
    if (bannerEl) bannerEl.value = item.banner || 'banner-green';
    // Show image preview if URL is set
    updateCodeImagePreview(item.imageURL || '');
  }
}

function safeSet(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || '';
}

// ── Category selector change ──────────────────────────────────────────────────

function bindCategoryChange() {
  const sel = document.getElementById('post-category');
  if (!sel) return;
  sel.addEventListener('change', () => {
    const cat     = sel.value;
    const isMedia = MEDIAHUB_CATS.includes(cat);
    if (isMedia) {
      showMediaHubFields(cat);
      setEditorMode(cat === 'code' ? 'code' : 'mediahub');
      if (currentPostId) {
        currentCollection = 'mediahub';
        setActiveTab('mediahub');
      }
    } else {
      showMediaHubFields(null);
      setEditorMode('writing');
    }
  });
}

// ── Create / Delete ───────────────────────────────────────────────────────────

async function createNewPost() {
  try {
    const isMedia = currentCollection === 'mediahub';
    let id;
    if (isMedia) {
      const defaultCat = currentCategoryFilter === 'code' ? 'code' : 'beats';
      id = await createMediaHub({
        title:    currentCategoryFilter === 'code' ? 'Untitled Project' : 'Untitled Media',
        category: defaultCat,
        date:     new Date().toISOString()
      });
    } else {
      id = await createPost({
        title:    'Untitled Post',
        content:  '',
        category: 'blog',
        date:     new Date().toISOString(),
        sections: [{ type: 'text', content: '' }]
      });
    }
    await loadPostsList();
    await loadPostIntoEditor(id);
    showToast('New item created!', 'success');
  } catch (err) {
    console.error('createNewPost error:', err);
    showToast('Failed to create item.', 'error');
  }
}

async function deleteCurrentPost() {
  if (!currentPostId) { showToast('No item selected.', 'warn'); return; }
  if (!confirm('Delete this item? This cannot be undone.')) return;

  try {
    if (currentCollection === 'mediahub') {
      await deleteMediaHub(currentPostId);
    } else {
      await deletePost(currentPostId);
    }

    currentPostId = null;

    document.getElementById('editor-sections').innerHTML          = '';
    document.getElementById('no-post-msg').style.display          = 'flex';
    document.getElementById('editor-canvas-inner').style.display  = 'none';
    document.getElementById('post-title-input').value             = '';
    showMediaHubFields(null);
    setSaveStatus('idle');

    const url = new URL(window.location);
    url.searchParams.delete('id');
    url.searchParams.delete('collection');
    window.history.replaceState({}, '', url);

    showToast('Deleted successfully.', 'success');
    await loadPostsList();
  } catch (err) {
    console.error('deleteCurrentPost error:', err);
    showToast('Delete failed.', 'error');
  }
}

// ── Slug helper ──────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

// Auto-fill slug from title if slug is still empty or matches old title slug
function bindSlugAutoFill() {
  const titleInput = document.getElementById('post-title-input');
  const slugInput  = document.getElementById('post-slug-input');
  if (!titleInput || !slugInput) return;
  let userEditedSlug = false;
  slugInput.addEventListener('input', () => { userEditedSlug = slugInput.value !== ''; });
  titleInput.addEventListener('input', () => {
    if (!userEditedSlug || slugInput.value === '') {
      slugInput.value = slugify(titleInput.value);
      userEditedSlug = false;
    }
  });
}

// ── Tips panel collapse ───────────────────────────────────────────────────────

function bindTipsCollapse() {
  const tipsSection = document.getElementById('tips-control-section');
  const tipsToggle  = document.getElementById('tips-toggle-btn');
  const tipsBody    = document.getElementById('tips-body');
  if (!tipsSection || !tipsToggle || !tipsBody) return;

  const collapsed = localStorage.getItem('editor-tips-collapsed') === 'true';
  if (collapsed) {
    tipsBody.style.display = 'none';
    tipsToggle.textContent = '+';
  }

  tipsToggle.addEventListener('click', () => {
    const isHidden = tipsBody.style.display === 'none';
    tipsBody.style.display = isHidden ? '' : 'none';
    tipsToggle.textContent = isHidden ? '−' : '+';
    localStorage.setItem('editor-tips-collapsed', (!isHidden).toString());
  });
}

// ── Gather post data for save ─────────────────────────────────────────────────

function gatherPostData() {
  const title    = document.getElementById('post-title-input').value.trim();
  const category = document.getElementById('post-category').value;
  const date     = document.getElementById('post-date').value || new Date().toISOString();

  if (category === 'beats') {
    return {
      title, category, date,
      creator:     document.getElementById('beats-creator').value.trim(),
      genre:       document.getElementById('beats-genre').value.trim(),
      imageURL:    document.getElementById('beats-image-url').value.trim(),
      description: document.getElementById('beats-description').value.trim(),
      songLink:    document.getElementById('beats-song-link').value.trim(),
      artistLink:  document.getElementById('beats-artist-link').value.trim(),
      audioURL:    document.getElementById('beats-audio-url').value.trim(),
      // Clear unused fields
      stars: '', videoURL: '', infoLink: ''
    };
  }

  if (category === 'movies') {
    return {
      title, category, date,
      genre:       document.getElementById('movies-genre').value.trim(),
      imageURL:    document.getElementById('movies-image-url').value.trim(),
      description: document.getElementById('movies-description').value.trim(),
      creator:     document.getElementById('movies-creator').value.trim(),
      stars:       document.getElementById('movies-stars').value.trim(),
      notes:       document.getElementById('movies-notes').value.trim(),
      infoLink:    document.getElementById('movies-info-link').value.trim(),
      videoURL:    document.getElementById('movies-video-url').value.trim(),
      rating:      document.getElementById('movies-rating')?.value || '',
      // Clear unused fields
      songLink: '', artistLink: ''
    };
  }

  if (category === 'tvshows') {
    return {
      title, category, date,
      genre:       document.getElementById('tvshows-genre').value.trim(),
      imageURL:    document.getElementById('tvshows-image-url').value.trim(),
      description: document.getElementById('tvshows-description').value.trim(),
      creator:     document.getElementById('tvshows-creator').value.trim(),
      stars:       document.getElementById('tvshows-stars').value.trim(),
      notes:       document.getElementById('tvshows-notes').value.trim(),
      infoLink:    document.getElementById('tvshows-info-link').value.trim(),
      videoURL:    document.getElementById('tvshows-video-url').value.trim(),
      rating:      document.getElementById('tvshows-rating')?.value || '',
      // Clear unused fields
      songLink: '', artistLink: ''
    };
  }

  if (category === 'code') {
    return {
      title, category, date,
      description: document.getElementById('code-description').value.trim(),
      imageURL:    document.getElementById('code-image-url').value.trim(),
      githubURL:   document.getElementById('code-github-url').value.trim(),
      liveURL:     document.getElementById('code-live-url').value.trim(),
      tags:        document.getElementById('code-tags').value.trim(),
      status:      document.getElementById('code-status').value,
      banner:      document.getElementById('code-banner').value,
      // Clear unused fields
      genre: '', creator: '', stars: '', songLink: '', artistLink: '', infoLink: '', videoURL: ''
    };
  }

  // (blog/poem/story)
  const sections  = gatherSections();
  const content   = sections.map(s => {
    const d = document.createElement('div');
    d.innerHTML = s.content;
    return d.textContent;
  }).join('\n\n');

  const slug        = document.getElementById('post-slug-input')?.value.trim() || slugify(title);
  const excerpt     = document.getElementById('post-excerpt-input')?.value.trim() || '';
  const coverImage  = document.getElementById('post-cover-input')?.value.trim() || '';
  const published   = document.getElementById('post-published-toggle')?.checked ?? true;
  const featured    = document.getElementById('post-featured-toggle')?.checked ?? false;

  return { title, category, date, slug, excerpt, coverImage, published, featured, sections, content };
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateBeforeSave() {
  const title = document.getElementById('post-title-input').value.trim();
  if (!title) {
    showToast('Title is required before saving.', 'warn');
    document.getElementById('post-title-input').focus();
    return false;
  }
  const cat = document.getElementById('post-category').value;
  if (cat === 'beats') {
    const creator = document.getElementById('beats-creator').value.trim();
    if (!creator) {
      showToast('Artist name is required.', 'warn');
      document.getElementById('beats-creator').focus();
      return false;
    }
  }
  return true;
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function saveCurrentPost() {
  if (!currentPostId) { showToast('Select or create an item first.', 'warn'); return; }
  if (isSaving) return;
  if (!validateBeforeSave()) return;

  isSaving = true;
  setSaveStatus('saving');
  try {
    const data = gatherPostData();
    if (currentCollection === 'mediahub') {
      await updateMediaHub(currentPostId, data);
    } else {
      await updatePost(currentPostId, data);
    }
    setSaveStatus('saved');
    markClean();
    showToast('Saved successfully.', 'success');
    await loadPostsList();
  } catch (err) {
    console.error('saveCurrentPost error:', err);
    setSaveStatus('unsaved');
    showToast('Save failed. Check console.', 'error');
  } finally {
    isSaving = false;
  }
}

async function autoSave() {
  if (!currentPostId || isSaving || !isDirty) return;
  isSaving = true;
  setSaveStatus('saving');
  try {
    const data = gatherPostData();
    if (currentCollection === 'mediahub') {
      await updateMediaHub(currentPostId, data);
    } else {
      await updatePost(currentPostId, data);
    }
    setSaveStatus('saved');
    markClean();
  } catch (err) {
    setSaveStatus('unsaved');
  } finally {
    isSaving = false;
  }
}

// ── Save Status ───────────────────────────────────────────────────────────────

function setSaveStatus(status) {
  const labels = { saving: 'Saving...', saved: 'Saved', unsaved: 'Unsaved changes', idle: '' };
  let label = labels[status] || '';
  if (status === 'saved' && lastSavedAt) {
    const secs = Math.round((Date.now() - lastSavedAt) / 1000);
    label = secs < 5 ? 'Saved just now' : label;
  }

  ['status-dot', 'status-dot2'].forEach(id => {
    const dot = document.getElementById(id);
    if (dot) dot.className = 'status-indicator ' + status;
  });
  ['save-status-text', 'save-status-text2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = label;
  });
}

// ── Controls Binding ──────────────────────────────────────────────────────────

function bindEditorControls() {
  document.getElementById('btn-new-post')?.addEventListener('click', () => showTemplatePicker());
  document.getElementById('btn-save-post')?.addEventListener('click', saveCurrentPost);
  document.getElementById('btn-preview-post')?.addEventListener('click', () => {
    if (currentPostId) window.open(`post.html?id=${currentPostId}`, '_blank');
  });
}

// ── Formatting Toolbar ────────────────────────────────────────────────────────

function bindFormatting() {
  // Standard execCommand buttons
  document.querySelectorAll('.format-btn[data-cmd]').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      const val = btn.dataset.val || null;
      document.execCommand(cmd, false, val);
    });
  });

  // Font family selector
  const fontSel = document.getElementById('toolbar-font-family');
  fontSel?.addEventListener('change', () => {
    document.execCommand('fontName', false, fontSel.value);
    fontSel.blur();
  });

  // Font size: – and + buttons + display
  let currentFontSize = 16;
  const sizeDisplay = document.getElementById('toolbar-font-size');

  function applyFontSize(px) {
    currentFontSize = Math.max(8, Math.min(72, px));
    if (sizeDisplay) sizeDisplay.value = currentFontSize;
    // execCommand fontSize uses 1-7 scale; use style instead
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      if (!range.collapsed) {
        document.execCommand('fontSize', false, '7');
        document.querySelectorAll('font[size="7"]').forEach(el => {
          el.removeAttribute('size');
          el.style.fontSize = currentFontSize + 'px';
        });
      }
    }
  }

  document.getElementById('toolbar-size-dec')?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    applyFontSize(currentFontSize - 2);
  });
  document.getElementById('toolbar-size-inc')?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    applyFontSize(currentFontSize + 2);
  });
  sizeDisplay?.addEventListener('change', () => {
    const v = parseInt(sizeDisplay.value);
    if (!isNaN(v)) applyFontSize(v);
  });

  // Text color
  const colorInput = document.getElementById('toolbar-text-color');
  colorInput?.addEventListener('input', () => {
    document.execCommand('foreColor', false, colorInput.value);
  });
  document.getElementById('toolbar-color-btn')?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    colorInput?.click();
  });

  // Highlight color
  const hlInput = document.getElementById('toolbar-highlight-color');
  hlInput?.addEventListener('input', () => {
    document.execCommand('hiliteColor', false, hlInput.value);
  });
  document.getElementById('toolbar-highlight-btn')?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    hlInput?.click();
  });

  // Indent
  document.getElementById('toolbar-indent-less')?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.execCommand('outdent', false, null);
  });
  document.getElementById('toolbar-indent-more')?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.execCommand('indent', false, null);
  });
}

// ── Image Upload ──────────────────────────────────────────────────────────────

function bindImageUpload() {
  const area  = document.getElementById('btn-upload-image');
  const input = document.getElementById('image-upload-input');
  if (!area || !input) return;

  area.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    showToast('Uploading image...', 'info');
    setSaveStatus('saving');
    try {
      const url = await uploadImage(file, () => {});

      if (currentCollection === 'mediahub') {
        const cat = document.getElementById('post-category').value;
        const fieldMap = {
          beats:   'beats-image-url',
          movies:  'movies-image-url',
          tvshows: 'tvshows-image-url'
        };
        const fieldId = fieldMap[cat];
        if (fieldId) safeSet(fieldId, url);
      } else {
        addSection({ type: 'image', content: url });
      }

      setSaveStatus('unsaved');
      showToast('Image uploaded successfully.', 'success');
    } catch (err) {
      console.error('uploadImage error:', err);
      setSaveStatus('unsaved');
      showToast('Upload failed. Check console.', 'error');
    }
    input.value = '';
  });
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}


const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|flac|m4a|aac|opus)(\?.*)?$/i;

function isAudioURL(url) {
  try {
    const u = new URL(url.trim());
    if (u.hostname === 'cdn.discordapp.com') return true;
    if (AUDIO_EXTENSIONS.test(u.pathname)) return true;
    return false;
  } catch (e) {
    return false;
  }
}

function setAudioURL(url) {
  const hiddenInput = document.getElementById('beats-audio-url');
  const dropZone    = document.getElementById('beats-audio-drop');
  const label       = document.getElementById('beats-audio-drop-label');
  const preview     = document.getElementById('beats-audio-preview');
  const player      = document.getElementById('beats-audio-player');
  if (!hiddenInput) return;

  if (url) {
    hiddenInput.value  = url;
    player.src         = url;
    preview.style.display = 'block';
    dropZone.classList.add('has-audio');
    // Show just the filename from the URL for readability
    try {
      const parts = new URL(url).pathname.split('/');
      label.textContent = decodeURIComponent(parts[parts.length - 1]) || 'Audio loaded';
    } catch (e) {
      label.textContent = 'Audio loaded';
    }
  } else {
    hiddenInput.value     = '';
    player.src            = '';
    player.load();
    preview.style.display = 'none';
    dropZone.classList.remove('has-audio');
    label.textContent = 'Drag a Discord audio link here';
  }
}

function bindAudioDropZone() {
  const dropZone = document.getElementById('beats-audio-drop');
  if (!dropZone) return;

  // Drag over — highlight
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  // Drop — extract URL
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    // Try to get URL from drop data
    const url = (
      e.dataTransfer.getData('text/uri-list') ||
      e.dataTransfer.getData('text/plain') ||
      ''
    ).trim();

    if (!url) {
      showToast('No URL detected in drop.', 'warn');
      return;
    }

    if (!isAudioURL(url)) {
      showToast('Link does not appear to be an audio file.', 'warn');
      return;
    }

    setAudioURL(url);
    setSaveStatus('unsaved');
    showToast('Audio link added.', 'success');
  });

  // Clear button
  document.getElementById('beats-audio-clear')?.addEventListener('click', () => {
    setAudioURL('');
    setSaveStatus('unsaved');
  });
}

document.addEventListener('DOMContentLoaded', bindAudioDropZone);

// ── Template Picker ───────────────────────────────────────────────────────────

const TEMPLATES = {
  blank: [],
  poem: [
    { type: 'title',     content: 'Untitled Poem' },
    { type: 'text',      content: '' },
    { type: 'divider' },
    { type: 'text',      content: '' },
  ],
  blog: [
    { type: 'title',     content: 'Blog Post Title' },
    { type: 'paragraph', content: 'Write your intro here...' },
    { type: 'text',      content: '' },
  ],
  story: [
    { type: 'title',     content: 'Story Title' },
    { type: 'paragraph', content: 'Scene one...' },
    { type: 'divider' },
    { type: 'paragraph', content: 'Scene two...' },
  ],
};

const TEMPLATE_CATEGORY = { poem: 'poem', blog: 'blog', story: 'story', blank: 'blog' };

function showTemplatePicker() {
  // Only show for writing posts
  if (currentCollection === 'mediahub') { createNewPost(); return; }
  const modal = document.getElementById('template-picker-modal');
  if (!modal) { createNewPost(); return; }
  modal.style.display = 'flex';

  const handler = (e) => {
    const card = e.target.closest('[data-template]');
    if (!card) return;
    modal.style.display = 'none';
    modal.removeEventListener('click', handler);
    createNewPostFromTemplate(card.dataset.template);
  };
  modal.addEventListener('click', handler);

  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      modal.style.display = 'none';
      document.removeEventListener('keydown', keyHandler);
      modal.removeEventListener('click', handler);
      createNewPostFromTemplate('blank');
    }
  };
  document.addEventListener('keydown', keyHandler, { once: true });
}

async function createNewPostFromTemplate(templateKey) {
  const sections  = TEMPLATES[templateKey] || [];
  const category  = TEMPLATE_CATEGORY[templateKey] || 'blog';
  try {
    const id = await createPost({
      title:    'Untitled Post',
      content:  '',
      category,
      date:     new Date().toISOString(),
      sections: sections.length ? sections : [{ type: 'text', content: '' }],
    });
    await loadPostsList();
    await loadPostIntoEditor(id);
    showToast(`New ${templateKey !== 'blank' ? templateKey : 'post'} created.`, 'success');
  } catch (err) {
    console.error('createNewPostFromTemplate error:', err);
    showToast('Failed to create post.', 'error');
  }
}

// ── Section move via keyboard (Ctrl+↑↓) ──────────────────────────────────────

function moveLastFocusedSection(dir) {
  if (typeof lastFocusedSection === 'undefined' || !lastFocusedSection) return;
  const container = document.getElementById('editor-sections');
  if (!container) return;
  const sections = Array.from(container.querySelectorAll('.editor-section'));
  const idx = sections.indexOf(lastFocusedSection);
  if (idx === -1) return;
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= sections.length) return;
  if (dir === -1) {
    container.insertBefore(lastFocusedSection, sections[targetIdx]);
  } else {
    container.insertBefore(sections[targetIdx], lastFocusedSection);
  }
  lastFocusedSection.scrollIntoView({ block: 'nearest' });
  markDirty();
  refreshSectionOrderList();
}

// ── Section Order List (right panel) ─────────────────────────────────────────

function refreshSectionOrderList() {
  const panel   = document.getElementById('section-reorder-panel');
  const listEl  = document.getElementById('section-order-list');
  if (!panel || !listEl) return;

  const container = document.getElementById('editor-sections');
  if (!container) return;
  const sections = Array.from(container.querySelectorAll('.editor-section'));

  if (sections.length === 0) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  listEl.innerHTML = '';

  sections.forEach((sec, idx) => {
    const type    = sec.dataset.type || 'text';
    const content = sec.querySelector('[contenteditable]')?.textContent?.trim().slice(0, 30) || '';
    const label   = content || `(${type})`;

    const row = document.createElement('div');
    row.className        = 'sol-row';
    row.draggable        = true;
    row.dataset.idx      = idx;
    row.innerHTML = `
      <span class="sol-handle">⠿</span>
      <span class="sol-type">${type}</span>
      <span class="sol-label">${label}</span>
      <div class="sol-arrows">
        <button class="sol-btn" data-dir="-1" title="Move up">↑</button>
        <button class="sol-btn" data-dir="1"  title="Move down">↓</button>
      </div>`;

    row.querySelectorAll('.sol-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = parseInt(btn.dataset.dir);
        const secs = Array.from(container.querySelectorAll('.editor-section'));
        const i = parseInt(row.dataset.idx);
        const target = i + dir;
        if (target < 0 || target >= secs.length) return;
        if (dir === -1) container.insertBefore(secs[i], secs[target]);
        else            container.insertBefore(secs[target], secs[i]);
        markDirty();
        refreshSectionOrderList();
      });
    });

    // Drag-to-reorder
    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', idx);
      row.classList.add('dragging');
    });
    row.addEventListener('dragend',  () => row.classList.remove('dragging'));
    row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave',() => row.classList.remove('drag-over'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      const toIdx   = parseInt(row.dataset.idx);
      if (fromIdx === toIdx) return;
      const secs = Array.from(container.querySelectorAll('.editor-section'));
      const el   = secs[fromIdx];
      if (toIdx < fromIdx) container.insertBefore(el, secs[toIdx]);
      else                 container.insertBefore(el, secs[toIdx].nextSibling);
      markDirty();
      refreshSectionOrderList();
    });

    listEl.appendChild(row);
  });
}

// ── Preview button visibility ─────────────────────────────────────────────────

function updatePreviewButton() {
  const btn = document.getElementById('btn-preview-post');
  if (btn) btn.style.display = (currentPostId && currentCollection !== 'mediahub') ? '' : 'none';
}

// ── Gallery Tab & Panel ───────────────────────────────────────────────────────

function injectGalleryTab() {
  const tabsEl = document.querySelector('.sidebar-tabs');
  if (!tabsEl) return;
  const btn = document.createElement('button');
  btn.className     = 'sidebar-tab';
  btn.dataset.tab   = 'gallery';
  btn.textContent   = 'Gallery';
  btn.style.cssText = 'font-size:var(--text-sm);';
  tabsEl.appendChild(btn);
}

function injectGalleryPanel() {
  const editorControls = document.querySelector('.editor-controls');
  if (!editorControls) return;

  const panel = document.createElement('div');
  panel.id            = 'gallery-manager-panel';
  panel.style.cssText = 'display:none;width:100%;overflow-y:auto;padding:var(--space-sm);box-sizing:border-box;';
  panel.innerHTML = `
    <div class="control-section">
      <p class="control-section-title">New Collection</p>
      <label class="field-label" for="gallery-new-key">Collection Key</label>
      <input class="field-input" id="gallery-new-key" type="text" placeholder="e.g. nature, travel, people">
      <p style="font-size:10px;color:var(--text-secondary);margin:4px 0 var(--space-xs);">
        Lowercase letters only, no spaces. Used as the unique ID.
      </p>
      <label class="field-label" for="gallery-new-title">Display Title</label>
      <input class="field-input" id="gallery-new-title" type="text" placeholder="e.g. Nature & Landscapes">
      <label class="field-label" for="gallery-new-desc">Description</label>
      <input class="field-input" id="gallery-new-desc" type="text" placeholder="Short description">
      <button class="btn btn-primary" id="gallery-create-collection"
        style="margin-top:var(--space-xs);width:100%;display:flex;align-items:center;justify-content:center;gap:6px;">
        <img src="assets/icons/add.svg" style="width:14px;height:14px;filter:brightness(0) invert(1);"> Create Collection
      </button>
    </div>

    <div class="control-section">
      <p class="control-section-title">Manage Collection</p>
      <label class="field-label" for="gallery-col-select">Choose Collection</label>
      <select class="field-select" id="gallery-col-select">
        <option value="">-- select a collection --</option>
      </select>
    </div>

    <div class="control-section" id="gallery-meta-section" style="display:none;">
      <p class="control-section-title">Collection Info</p>
      <label class="field-label" for="gallery-col-title">Display Title</label>
      <input class="field-input" id="gallery-col-title" type="text" placeholder="e.g. Nature & Landscapes">
      <label class="field-label" for="gallery-col-desc-edit">Description</label>
      <input class="field-input" id="gallery-col-desc-edit" type="text" placeholder="Short description">
      <label class="field-label" for="gallery-col-cover">Cover Image URL</label>
      <input class="field-input" id="gallery-col-cover" type="text" placeholder="https://...">
      <div style="display:flex;gap:var(--space-xs);margin-top:var(--space-xs);">
        <button class="btn btn-secondary" id="gallery-save-meta"
          style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;">
          <img src="assets/icons/save.svg" style="width:14px;height:14px;"> Save Info
        </button>
        <button class="btn btn-secondary" id="gallery-delete-collection"
          style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;
                 background:var(--alert-red);color:var(--cream);border-color:var(--alert-red);">
          <img src="assets/icons/delete.svg" style="width:14px;height:14px;filter:brightness(0) invert(1);"> Delete
        </button>
      </div>
    </div>

    <div class="control-section" id="gallery-add-section" style="display:none;">
      <p class="control-section-title">Add Photo</p>
      <label class="field-label" for="gallery-photo-title">Photo Title</label>
      <input class="field-input" id="gallery-photo-title" type="text" placeholder="Mountain Vista">
      <label class="field-label" for="gallery-photo-caption">Caption</label>
      <input class="field-input" id="gallery-photo-caption" type="text" placeholder="Describe the shot">
      <label class="field-label" for="gallery-photo-src">Image URL</label>
      <input class="field-input" id="gallery-photo-src" type="text" placeholder="https://... or assets/photo.jpg">
      <div class="image-upload-area" id="gallery-upload-area" style="margin-top:var(--space-xs);">
        <div class="upload-icon"><img src="assets/icons/add.svg" style="width:28px;height:28px;"></div>
        <p class="upload-text">Or click to upload a file</p>
        <input type="file" id="gallery-upload-input" accept="image/*" style="display:none;">
      </div>
      <button class="btn btn-primary" id="gallery-add-photo"
        style="margin-top:var(--space-xs);width:100%;display:flex;align-items:center;justify-content:center;gap:6px;">
        <img src="assets/icons/add.svg" style="width:14px;height:14px;filter:brightness(0) invert(1);"> Add to Collection
      </button>
    </div>

    <div class="control-section" id="gallery-list-section" style="display:none;">
      <p class="control-section-title">Photos in Collection
        <span id="gallery-photo-count" style="color:var(--text-secondary);font-weight:normal;">(0)</span>
      </p>
      <div id="gallery-photos-list" style="display:flex;flex-direction:column;gap:var(--space-xs);"></div>
    </div>
  `;

  editorControls.appendChild(panel);

  document.getElementById('gallery-col-select')?.addEventListener('change', () => {
    const key = document.getElementById('gallery-col-select').value;
    toggleCollectionSections(!!key);
    if (key) loadGalleryForKey(key);
  });

  document.getElementById('gallery-create-collection')?.addEventListener('click', createGalleryCollection);
  document.getElementById('gallery-save-meta')?.addEventListener('click',         saveGalleryMeta);
  document.getElementById('gallery-delete-collection')?.addEventListener('click', deleteGalleryCollection);
  document.getElementById('gallery-add-photo')?.addEventListener('click',         addGalleryPhoto);

  const uploadArea  = document.getElementById('gallery-upload-area');
  const uploadInput = document.getElementById('gallery-upload-input');
  uploadArea?.addEventListener('click', () => uploadInput?.click());
  uploadInput?.addEventListener('change', async () => {
    const file = uploadInput.files[0];
    if (!file) return;
    showToast('Uploading photo...', 'info');
    try {
      const url = await uploadImage(file, () => {});
      document.getElementById('gallery-photo-src').value = url;
      showToast('Photo uploaded!', 'success');
    } catch (err) {
      showToast('Upload failed.', 'error');
    }
    uploadInput.value = '';
  });

  loadGalleryCollectionList();
}

function showGalleryPanel(visible) {
  const controlsContent = document.querySelector('.controls-content');
  const galleryPanel    = document.getElementById('gallery-manager-panel');

  // Sidebar elements that don't apply to gallery
  const searchWrap  = document.querySelector('.sidebar-search-wrap');
  const sideActions = document.querySelector('.sidebar-actions');
  const postsList   = document.getElementById('posts-list');

  if (visible) {
    showMediaHubFields(null);
    if (controlsContent) controlsContent.style.display = 'none';
    if (galleryPanel)    galleryPanel.style.display    = 'block';
    if (searchWrap)      searchWrap.style.display      = 'none';
    if (sideActions)     sideActions.style.display     = 'none';
    if (postsList)       postsList.style.display       = 'none';
    setEditorMode('gallery');
  } else {
    if (controlsContent) controlsContent.style.display = '';
    if (galleryPanel)    galleryPanel.style.display    = 'none';
    if (searchWrap)      searchWrap.style.display      = '';
    if (sideActions)     sideActions.style.display     = '';
    if (postsList)       postsList.style.display       = '';
    const sel = document.getElementById('post-category');
    if (sel) sel.dispatchEvent(new Event('change'));
  }
}

function toggleCollectionSections(visible) {
  ['gallery-meta-section', 'gallery-add-section', 'gallery-list-section'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = visible ? 'block' : 'none';
  });
}

async function loadGalleryCollectionList() {
  const sel = document.getElementById('gallery-col-select');
  if (!sel) return;
  try {
    const all = await getAllGalleryCollections();
    sel.innerHTML = '<option value="">-- select a collection --</option>';
    Object.entries(all).forEach(([key, data]) => {
      const opt = document.createElement('option');
      opt.value       = key;
      opt.textContent = data.title || key;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.error('loadGalleryCollectionList error:', err);
  }
}

async function createGalleryCollection() {
  const keyInput   = document.getElementById('gallery-new-key');
  const titleInput = document.getElementById('gallery-new-title');
  const descInput  = document.getElementById('gallery-new-desc');

  const key   = keyInput.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const title = titleInput.value.trim();
  const desc  = descInput.value.trim();

  if (!key)   { showToast('Collection key is required.', 'warn');   keyInput.focus();   return; }
  if (!title) { showToast('Display title is required.', 'warn');    titleInput.focus(); return; }

  try {
    await setGalleryCollection(key, { title, description: desc, photos: [] });
    showToast(`Collection "${title}" created!`, 'success');
    keyInput.value = ''; titleInput.value = ''; descInput.value = '';
    await loadGalleryCollectionList();
    const sel = document.getElementById('gallery-col-select');
    if (sel) { sel.value = key; sel.dispatchEvent(new Event('change')); }
  } catch (err) {
    console.error('createGalleryCollection error:', err);
    showToast('Failed to create collection.', 'error');
  }
}

async function deleteGalleryCollection() {
  const key = document.getElementById('gallery-col-select').value;
  if (!key) return;
  if (!confirm(`Delete the entire "${key}" collection? This cannot be undone.`)) return;
  try {
    await galleryDB.collection('gallery').doc(key).delete();
    showToast('Collection deleted.', 'success');
    toggleCollectionSections(false);
    await loadGalleryCollectionList();
  } catch (err) {
    console.error('deleteGalleryCollection error:', err);
    showToast('Failed to delete collection.', 'error');
  }
}

async function loadGalleryForKey(key) {
  const listEl  = document.getElementById('gallery-photos-list');
  const countEl = document.getElementById('gallery-photo-count');
  if (!listEl) return;

  listEl.innerHTML = '<p style="font-size:var(--text-xs);color:var(--text-secondary);">Loading...</p>';

  try {
    const data = await getGalleryCollection(key);
    document.getElementById('gallery-col-title').value      = data?.title       || '';
    document.getElementById('gallery-col-desc-edit').value  = data?.description || '';
    document.getElementById('gallery-col-cover').value      = data?.coverSrc    || '';

    const photos = data?.photos || [];
    countEl.textContent = `(${photos.length})`;
    listEl.innerHTML    = '';

    if (photos.length === 0) {
      listEl.innerHTML = '<p style="font-size:var(--text-xs);color:var(--text-secondary);font-style:italic;">No photos yet.</p>';
      return;
    }

    photos.forEach((photo, idx) => {
      const item = document.createElement('div');
      item.style.cssText = `
        display:flex;align-items:center;gap:8px;
        background:var(--bg-primary);border:1px solid var(--warm-beige);
        border-radius:var(--radius-md);padding:8px;font-size:var(--text-xs);
      `;
      item.innerHTML = `
        <img src="${photo.src}" alt="${photo.title}"
          style="width:44px;height:44px;object-fit:cover;border-radius:6px;
                 border:1px solid var(--warm-beige);flex-shrink:0;"
          onerror="this.style.background='var(--warm-beige)';this.src='';">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${photo.title || '(no title)'}
          </div>
          <div style="color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${photo.caption || ''}
          </div>
        </div>
        <button data-idx="${idx}" class="gallery-del-btn"
          style="width:24px;height:24px;border-radius:4px;border:none;
                 background:var(--alert-red);cursor:pointer;flex-shrink:0;
                 display:flex;align-items:center;justify-content:center;">
          <img src="assets/icons/delete.svg" style="width:13px;height:13px;filter:brightness(0) invert(1);">
        </button>
      `;
      item.querySelector('.gallery-del-btn').addEventListener('click', async () => {
        if (!confirm(`Delete "${photo.title || 'this photo'}"?`)) return;
        await removePhotoFromCollection(key, idx);
        showToast('Photo removed.', 'success');
        loadGalleryForKey(key);
      });
      listEl.appendChild(item);
    });
  } catch (err) {
    console.error('loadGalleryForKey error:', err);
    listEl.innerHTML = '<p style="color:var(--alert-red);font-size:var(--text-xs);">Error loading photos.</p>';
  }
}

async function addGalleryPhoto() {
  const key     = document.getElementById('gallery-col-select').value;
  const src     = document.getElementById('gallery-photo-src').value.trim();
  const title   = document.getElementById('gallery-photo-title').value.trim();
  const caption = document.getElementById('gallery-photo-caption').value.trim();

  if (!key) { showToast('Select a collection first.', 'warn'); return; }
  if (!src) { showToast('Image URL is required.', 'warn');     return; }

  try {
    await addPhotoToCollection(key, { src, title, caption });
    showToast('Photo added!', 'success');
    document.getElementById('gallery-photo-src').value     = '';
    document.getElementById('gallery-photo-title').value   = '';
    document.getElementById('gallery-photo-caption').value = '';
    loadGalleryForKey(key);
  } catch (err) {
    console.error('addGalleryPhoto error:', err);
    showToast('Failed to add photo.', 'error');
  }
}

async function saveGalleryMeta() {
  const key   = document.getElementById('gallery-col-select').value;
  const title = document.getElementById('gallery-col-title').value.trim();
  const desc  = document.getElementById('gallery-col-desc-edit').value.trim();
  const cover = document.getElementById('gallery-col-cover').value.trim();
  if (!key) return;
  try {
    await updateCollectionMeta(key, {
      title:       title || undefined,
      description: desc  || undefined,
      coverSrc:    cover || undefined
    });
    showToast('Collection info saved!', 'success');
    await loadGalleryCollectionList();
    document.getElementById('gallery-col-select').value = key;
    loadGalleryForKey(key);
  } catch (err) {
    console.error('saveGalleryMeta error:', err);
    showToast('Failed to save info.', 'error');
  }
}
// ── Media Poster Drag/Drop Upload ────────────────────────────────────────────
async function handleMediaFile(file, cat) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please upload an image file.', 'warn'); return;
  }
  const dropArea = document.getElementById(`${cat}-drop-area`);
  if (dropArea) dropArea.textContent = 'Uploading…';
  showToast('Uploading poster...', 'info');
  try {
    const url = await uploadImage(file, () => {});
    safeSet(`${cat}-image-url`, url);
    if (dropArea) dropArea.innerHTML = `<div style="color:var(--forest-green);font-size:var(--text-sm);font-weight:600;">✓ Uploaded — URL filled below</div>`;
    showToast('Poster uploaded!', 'success');
  } catch (err) {
    if (dropArea) dropArea.innerHTML = `<div style="color:var(--alert-red);font-size:var(--text-sm);">Upload failed</div>`;
    showToast('Upload failed: ' + err.message, 'error');
  }
}

function handleMediaDrop(event, cat) {
  event.preventDefault();
  const dropArea = document.getElementById(`${cat}-drop-area`);
  if (dropArea) dropArea.style.borderColor = 'var(--warm-beige)';
  const file = event.dataTransfer.files[0];
  if (file) handleMediaFile(file, cat);
}