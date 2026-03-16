// ── MediaHub JS ───────────────────────────────────────────────────────────────

function _mhDebounce(fn, delay) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };
}

document.addEventListener('DOMContentLoaded', () => {
  const category = document.body.dataset.mediahub;
  if (category && category !== 'beats') {
    loadMediaHubPage(category);
  }
});

// ── Page loader (movies / tvshows) ────────────────────────────────────────────

async function loadMediaHubPage(category) {
  const grid        = document.getElementById('mediahub-grid');
  const searchInput = document.getElementById('search-input');
  if (!grid) return;

  // Show skeleton while loading
  renderSkeletons(grid, 8);

  if (typeof getMediaHubByCategory !== 'function') {
    grid.innerHTML = '<p class="error-text">Firebase not configured.</p>';
    return;
  }

  let items = [];
  try {
    items = (await getMediaHubByCategory(category)).filter(i => i.category !== 'code');
  } catch (e) {
    grid.innerHTML = '<p class="error-text">Could not load items. Check Firebase config.</p>';
    return;
  }

  let activeGenre  = 'all';
  let activeStatus = 'all';
  let activeRating = 'all';
  let activeSort   = 'date';
  let searchQuery  = '';

  // ── Search + filter toolbar ─────────────────────────────────────────────────
  // Move search input into a unified toolbar with filter + sort
  const searchWrap = searchInput ? searchInput.closest('.search-wrap') : null;
  const filterBar  = document.createElement('div');
  filterBar.className = 'mh-filter-bar';
  if (searchWrap) {
    grid.parentNode.insertBefore(filterBar, searchWrap);
    // Move search into toolbar
    searchWrap.style.display = 'none';
  } else {
    grid.parentNode.insertBefore(filterBar, grid);
  }

  function getGenres(list) {
    return ['all', ...new Set(
      list.flatMap(i => (i.genre||'').split(',').map(g=>g.trim()).filter(Boolean))
    )];
  }

  function buildFilterBar() {
    const genres     = getGenres(items);
    const hasRatings = items.some(i => i.rating);

    filterBar.innerHTML = `
      <div class="mhfb-toolbar">
        <div class="mhfb-search-wrap">
          <svg class="mhfb-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="mhfb-search-input" id="mhfb-search" placeholder="Search ${category === 'tvshows' ? 'shows' : 'films'}…" value="${searchQuery}">
        </div>

        <div class="mhfb-controls">
          <div class="mhfb-filter-wrap">
            <button class="mhfb-filter-btn" id="mhfb-filter-toggle">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
              Filters
              <span class="mhfb-active-count" id="mhfb-active-count" style="display:none">0</span>
            </button>

            <div class="mhfb-popover" id="mhfb-popover" style="display:none">
              <div class="mhfb-pop-row">
                <span class="mhfb-pop-label">Genre</span>
                <div class="mhfb-pop-pills" id="genre-pills">
                  ${genres.map(g=>`<button class="mhfb-ppill${g===activeGenre?' active':''}" data-genre="${g}">${g==='all'?'All':g}</button>`).join('')}
                </div>
              </div>
              <div class="mhfb-pop-row">
                <span class="mhfb-pop-label">Status</span>
                <div class="mhfb-pop-pills" id="status-pills">
                  ${[{v:'all',l:'All'},{v:'watched',l:'Watched'},{v:'watching',l:'Watching'},{v:'want',l:'Want'}]
                    .map(s=>`<button class="mhfb-ppill mhfb-ppill-status${s.v===activeStatus?' active':''}" data-status="${s.v}">${s.l}</button>`).join('')}
                </div>
              </div>
              ${hasRatings ? `
              <div class="mhfb-pop-row">
                <span class="mhfb-pop-label">Rating</span>
                <div class="mhfb-pop-pills" id="rating-pills">
                  ${[{v:'all',l:'Any'},{v:'5',l:'5+'},{v:'7',l:'7+'},{v:'9',l:'9+'}]
                    .map(r=>`<button class="mhfb-ppill${r.v===activeRating?' active':''}" data-rating="${r.v}">${r.l} ★</button>`).join('')}
                </div>
              </div>` : ''}
              <div class="mhfb-pop-footer">
                <button class="mhfb-pop-clear" id="mh-clear">Clear filters</button>
              </div>
            </div>
          </div>

          <div class="mhfb-sort-pills">
            ${[{v:'date',l:'Latest'},{v:'rating-high',l:'Rating ↓'},{v:'title',l:'A–Z'}]
              .map(s=>`<button class="mhfb-spill${s.v===activeSort?' active':''}" data-sort="${s.v}">${s.l}</button>`).join('')}
          </div>
        </div>

        <span class="mhfb-count" id="mh-count"></span>
      </div>`;

    // Popover toggle
    const toggleBtn = filterBar.querySelector('#mhfb-filter-toggle');
    const popover   = filterBar.querySelector('#mhfb-popover');
    toggleBtn?.addEventListener('click', e => {
      e.stopPropagation();
      const open = popover.style.display !== 'none';
      popover.style.display = open ? 'none' : 'block';
      toggleBtn.classList.toggle('active', !open);
    });
    document.addEventListener('click', e => {
      if (!filterBar.contains(e.target)) {
        if (popover) popover.style.display = 'none';
        toggleBtn?.classList.remove('active');
      }
    });

    // Search
    filterBar.querySelector('#mhfb-search')?.addEventListener('input', _mhDebounce(e => {
      searchQuery = e.target.value.toLowerCase().trim();
      updateActiveCount(); applyFilters();
    }, 180));

    // Genre / status / rating / sort
    filterBar.querySelectorAll('[data-genre]').forEach(b => b.addEventListener('click', () => {
      activeGenre = b.dataset.genre;
      filterBar.querySelectorAll('[data-genre]').forEach(x => x.classList.toggle('active', x.dataset.genre === activeGenre));
      updateActiveCount(); applyFilters();
    }));
    filterBar.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', () => {
      activeStatus = b.dataset.status;
      filterBar.querySelectorAll('[data-status]').forEach(x => x.classList.toggle('active', x.dataset.status === activeStatus));
      updateActiveCount(); applyFilters();
    }));
    filterBar.querySelectorAll('[data-rating]').forEach(b => b.addEventListener('click', () => {
      activeRating = b.dataset.rating;
      filterBar.querySelectorAll('[data-rating]').forEach(x => x.classList.toggle('active', x.dataset.rating === activeRating));
      updateActiveCount(); applyFilters();
    }));
    filterBar.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => {
      activeSort = b.dataset.sort;
      filterBar.querySelectorAll('[data-sort]').forEach(x => x.classList.toggle('active', x.dataset.sort === activeSort));
      applyFilters();
    }));
    filterBar.querySelector('#mh-clear')?.addEventListener('click', () => {
      activeGenre='all'; activeStatus='all'; activeRating='all'; activeSort='date'; searchQuery='';
      buildFilterBar(); applyFilters();
    });

    updateActiveCount();
  }

  function updateActiveCount() {
    const n = (activeGenre!=='all'?1:0)+(activeStatus!=='all'?1:0)+(activeRating!=='all'?1:0)+(searchQuery?1:0);
    const badge = filterBar.querySelector('#mhfb-active-count');
    if (badge) { badge.textContent=n; badge.style.display=n?'':'none'; }
    const btn = filterBar.querySelector('#mhfb-filter-toggle');
    if (btn) btn.classList.toggle('has-filters', n > 0);
  }

  function applyFilters() {
    let list = [...items];
    if (searchQuery) list = list.filter(i =>
      (i.title||'').toLowerCase().includes(searchQuery) ||
      (i.creator||'').toLowerCase().includes(searchQuery) ||
      (i.genre||'').toLowerCase().includes(searchQuery) ||
      (i.description||'').toLowerCase().includes(searchQuery) ||
      (i.stars||'').toLowerCase().includes(searchQuery)
    );
    if (activeGenre !== 'all')  list = list.filter(i => (i.genre||'').split(',').map(g=>g.trim()).includes(activeGenre));
    if (activeStatus !== 'all') list = list.filter(i => (i.status||'') === activeStatus);
    if (activeRating !== 'all') { const min=parseInt(activeRating); list=list.filter(i=>parseInt(i.rating||0)>=min); }
    list.sort((a,b) => {
      if (activeSort==='rating-high') return (parseInt(b.rating)||0)-(parseInt(a.rating)||0);
      if (activeSort==='title')       return (a.title||'').localeCompare(b.title||'');
      return new Date(b.date||0)-new Date(a.date||0);
    });
    const isFiltered = activeGenre!=='all'||activeStatus!=='all'||activeRating!=='all'||activeSort!=='date'||searchQuery;
    renderGrid(list, isFiltered);
  }

  function renderGrid(list, isFiltered) {
    const countEl = filterBar.querySelector('#mh-count');
    if (countEl) countEl.textContent = isFiltered
      ? `${list.length} of ${items.length}`
      : `${items.length} ${items.length===1?'title':'titles'}`;

    if (!list.length) { grid.innerHTML = buildEmptyState(category, activeGenre, activeStatus, searchQuery); return; }
    grid.innerHTML = '';
    list.forEach(item => { const c = buildMediaCard(item, category); if (c) grid.appendChild(c); });
    // Animate cards in with staggered entrance
    if (typeof stampCards === 'function') stampCards(grid);
  }

  buildFilterBar();
  applyFilters();
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function renderSkeletons(grid, count) {
  grid.innerHTML = Array.from({length: count}, () =>
    `<div class="media-card media-card-vertical mh-skeleton">
       <div class="mh-skel-poster"></div>
       <div class="mh-skel-body">
         <div class="mh-skel-pill"></div>
         <div class="mh-skel-title"></div>
         <div class="mh-skel-line"></div>
       </div>
     </div>`
  ).join('');
}

// ── Empty state ───────────────────────────────────────────────────────────────

function buildEmptyState(category, genre, status, query) {
  const catIcons = {
    movies:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 4v16M16 4v16M2 9h4M18 9h4M2 15h4M18 15h4"/></svg>`,
    tvshows: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7L12 3l4 4"/><path d="M12 12v5M9 14.5h6"/></svg>`,
    beats:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 9l6 3-6 3V9z" fill="currentColor" stroke="none"/></svg>`,
  };
  const icon = catIcons[category] || '';
  let msg='', sub='';
  if (query)            { msg=`No results for "${query}"`; sub='Try a different search term.'; }
  else if (status!=='all') { msg=`Nothing ${status} yet`; sub=genre!=='all'?'Try removing the genre filter.':'Add something from the editor.'; }
  else if (genre!=='all')  { msg=`No ${genre} titles yet`; sub='Try a different genre.'; }
  else                    { msg='Nothing here yet'; sub=`Add your first ${category==='tvshows'?'show':'film'} from the editor.`; }
  return `<div class="mh-empty-state"><div class="mh-empty-icon">${icon}</div><p class="mh-empty-msg">${msg}</p><p class="mh-empty-sub">${sub}</p></div>`;
}

// ── Card builders ─────────────────────────────────────────────────────────────

function buildMediaCard(item, category) {
  if (category === 'code')  return null;
  if (category === 'beats') return buildBeatCard(item);
  return buildMovieCard(item, category);
}

function buildMovieCard(item, category) {
  const card = document.createElement('div');
  card.className = 'media-card media-card-vertical';
  const statusMap = { watched:{label:'Watched',cls:'status-watched'}, watching:{label:'Watching',cls:'status-watching'}, want:{label:'Want',cls:'status-want'} };
  const si     = statusMap[item.status];
  const badge  = si ? `<span class="media-status-badge ${si.cls}">${si.label}</span>` : '';
  const poster = item.imageURL
    ? `<img class="media-card-poster" src="${item.imageURL}" alt="${item.title}" loading="lazy">`
    : `<div class="media-card-poster-placeholder"><img src="assets/icons/${category==='tvshows'?'tv':'movie'}.svg" style="width:48px;height:48px;opacity:0.3;" alt=""></div>`;
  const genres = (item.genre||'').split(',').map(g=>g.trim()).filter(Boolean).slice(0,2);
  const pills  = genres.map(g=>`<span class="mc-genre-pill">${g}</span>`).join('');
  card.innerHTML = `
    <div class="mc-poster-wrap">
      ${poster}${badge}
      <div class="mc-poster-overlay"><span class="mc-view-hint">View Details</span></div>
    </div>
    <div class="mc-body">
      ${pills?`<div class="mc-genres">${pills}</div>`:''}
      <h3 class="mc-title">${item.title}</h3>
      ${item.creator?`<p class="mc-director"><span class="mc-meta-label">${category==='tvshows'?'Creator':'Dir.'}</span> ${item.creator.split(',')[0].trim()}</p>`:''}
      ${item.stars?`<p class="mc-stars-row"><span class="mc-meta-label">Stars</span> ${item.stars.split(',').slice(0,2).join(', ')}</p>`:''}
    </div>`;
  card.addEventListener('click', () => openMediaModal(item, category));
  return card;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function ensureMediaModal() {
  if (document.getElementById('media-detail-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'media-detail-modal';
  modal.className = 'mdm-backdrop';
  modal.innerHTML = `
    <div class="mdm-box" role="dialog" aria-modal="true" aria-label="Media details">
      <button class="mdm-close" aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="mdm-inner">
        <div class="mdm-left" id="mdm-poster-col"></div>
        <div class="mdm-right" id="mdm-info-col"></div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) closeMediaModal(); });
  modal.querySelector('.mdm-close').addEventListener('click', closeMediaModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMediaModal(); });
}

function openMediaModal(item, category) {
  ensureMediaModal();
  const modal     = document.getElementById('media-detail-modal');
  const posterCol = document.getElementById('mdm-poster-col');
  const infoCol   = document.getElementById('mdm-info-col');

  // Poster
  posterCol.innerHTML = item.imageURL
    ? `<img class="mdm-poster" src="${item.imageURL}" alt="${item.title}">`
    : `<div class="mdm-poster-fallback"><img src="assets/icons/${category==='tvshows'?'tv':'movie'}.svg" style="width:56px;opacity:0.25;" alt=""></div>`;

  // Status badge
  const statusMap = { watched:{label:'Watched',cls:'status-watched'}, watching:{label:'Watching',cls:'status-watching'}, want:{label:'Want to Watch',cls:'status-want'} };
  const si    = statusMap[item.status];
  const badge = si ? `<span class="media-status-badge ${si.cls}" style="position:static;display:inline-flex;margin-bottom:10px;">${si.label}</span>` : '';

  // Genres
  const genres = (item.genre||'').split(',').map(g=>g.trim()).filter(Boolean);
  const pills  = genres.map(g=>`<span class="mc-genre-pill">${g}</span>`).join('');

  // Title (link if available)
  const titleEl = item.infoLink
    ? `<a href="${item.infoLink}" target="_blank" rel="noopener noreferrer" class="mdm-title-link">${item.title}</a>`
    : item.title;

  // Rating — clean number display, no star row spam
  let ratingHTML = '';
  if (item.rating) {
    const r = parseInt(item.rating);
    const filled = Array.from({length:r}, () => `<span class="mdm-star filled">★</span>`).join('');
    const empty  = Array.from({length:10-r}, () => `<span class="mdm-star">★</span>`).join('');
    ratingHTML = `
      <div class="mdm-rating-block">
        <span class="mdm-rating-score">${r}<span class="mdm-rating-denom">/10</span></span>
        <div class="mdm-stars">${filled}${empty}</div>
      </div>`;
  }

  // Trailer button
  const trailerBtn = item.videoURL
    ? `<button class="mdm-trailer-btn" id="mdm-trailer-btn">
         <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
         Watch Trailer
       </button>
       <div class="mdm-trailer-embed hidden" id="mdm-trailer-embed"></div>`
    : '';

  infoCol.innerHTML = `
    ${badge}
    <h2 class="mdm-title">${titleEl}</h2>
    ${pills ? `<div class="mc-genres mdm-genres">${pills}</div>` : ''}
    <div class="mdm-meta-block">
      ${item.creator ? `<p class="mdm-meta"><span class="mc-meta-label">${category==='tvshows'?'Creator':'Director'}</span>${item.creator}</p>` : ''}
      ${item.stars   ? `<p class="mdm-meta"><span class="mc-meta-label">Starring</span>${item.stars}</p>` : ''}
    </div>
    ${ratingHTML}
    ${item.description ? `<div class="mdm-review-block"><span class="mdm-section-label">Synopsis</span><p class="mdm-review-text">${item.description}</p></div>` : ''}
    ${item.notes ? `<div class="mdm-review-block"><span class="mdm-section-label">Why I Like It</span><p class="mdm-review-text">${item.notes}</p></div>` : ''}
    ${trailerBtn}`;

  if (item.videoURL) {
    const btn   = infoCol.querySelector('#mdm-trailer-btn');
    const embed = infoCol.querySelector('#mdm-trailer-embed');
    btn.addEventListener('click', () => {
      const isOpen = !embed.classList.contains('hidden');
      embed.innerHTML  = isOpen ? '' : `<div class="video-embed"><iframe src="${item.videoURL}" allowfullscreen loading="lazy"></iframe></div>`;
      embed.classList.toggle('hidden', isOpen);
      btn.innerHTML    = isOpen
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Watch Trailer`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Close Trailer`;
    });
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.body.classList.add('modal-open');
}

function closeMediaModal() {
  const modal = document.getElementById('media-detail-modal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
  document.body.classList.remove('modal-open');
  const embed = document.getElementById('mdm-trailer-embed');
  if (embed) { embed.innerHTML = ''; embed.classList.add('hidden'); }
}

// ── Beat card ─────────────────────────────────────────────────────────────────

function buildBeatCard(item) {
  const card    = document.createElement('article');
  card.className = 'mh-beat-card';
  const cover   = item.imageURL
    ? `<img class="mh-beat-cover" src="${item.imageURL}" alt="${item.title}" loading="lazy">`
    : `<div class="mh-beat-cover-fallback"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;opacity:0.35;"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/></svg></div>`;
  const titleEl = item.songLink
    ? `<a href="${item.songLink}" target="_blank" rel="noopener noreferrer" class="mh-beat-title">${item.title}</a>`
    : `<span class="mh-beat-title">${item.title}</span>`;
  const artistEl = item.creator
    ? (item.artistLink
        ? `<a href="${item.artistLink}" target="_blank" rel="noopener noreferrer" class="mh-beat-artist">${item.creator}</a>`
        : `<span class="mh-beat-artist">${item.creator}</span>`)
    : '';
  const audioEl = item.audioURL ? `<audio class="mh-beat-audio" controls preload="none" src="${item.audioURL}"></audio>` : '';
  card.innerHTML = `
    ${cover}
    <div class="mh-beat-body">
      ${item.genre ? `<span class="mc-genre-pill" style="align-self:flex-start;">${item.genre}</span>` : ''}
      <div class="mh-beat-title-row">${titleEl}${artistEl?`<span class="mh-beat-sep">·</span>${artistEl}`:''}</div>
      ${item.description ? `<p class="mh-beat-desc">${item.description}</p>` : ''}
      ${audioEl}
    </div>`;
  return card;
}