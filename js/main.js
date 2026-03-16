// Navigation, post loading, back-to-top

// ─── Debounce ──────────────────────────────────────────────────────────────────
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function stampCards(containerEl) {
  if (!containerEl) return;
  const cards = containerEl.querySelectorAll(
    '.card, .media-card, .beat-card, .mh-beat-card, .code-preview-card, .collection-card-gl, article'
  );
  cards.forEach((el, i) => {
    // Remove then re-add to restart the animation on re-render
    el.removeAttribute('data-sa-card');
    // Force reflow so the browser registers the removal
    void el.offsetWidth;
    el.dataset.saCard = String(Math.min(i, 15));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initBackToTop();
  initScrollSpy();

  const pageCategory = document.body.dataset.category;
  if (pageCategory) {
    loadPageContent(pageCategory);
  }

  // Media pages (movies, tvshows) are now handled by mediahub.js
  // Beats page uses its own inline React component

  if (document.getElementById('featured-grid')) {
    loadFeaturedPosts();
  }
});

// ─── Navigation (sidebar drawer on mobile) ────────────────────────────────────

function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const menu   = document.getElementById('nav-menu');

  // ── Inject backdrop dimmer ───────────────────────────────────────────────
  let backdrop = document.querySelector('.nav-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.appendChild(backdrop);
  }

  // ── Inject close (X) button INSIDE the sidebar ───────────────────────────
  if (menu && !menu.querySelector('.nav-close-btn')) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'nav-close-btn';
    closeBtn.setAttribute('aria-label', 'Close menu');
    closeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>`;
    menu.insertBefore(closeBtn, menu.firstChild);
    closeBtn.addEventListener('click', closeSidebar);
  }

  const allDropdowns = document.querySelectorAll('.dropdown');

  function openSidebar() {
    menu?.classList.add('open');
    toggle?.classList.add('is-open');      
    backdrop.classList.add('visible');
    const scrollY = window.scrollY;
    document.body.dataset.scrollY = scrollY;
    document.body.style.top = `-${scrollY}px`;
    document.body.classList.add('sidebar-open');
  }

  function closeSidebar() {
    menu?.classList.remove('open');
    toggle?.classList.remove('is-open');   // restores hamburger
    backdrop.classList.remove('visible');
    document.body.classList.remove('sidebar-open');
    const scrollY = parseInt(document.body.dataset.scrollY || '0');
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
    allDropdowns.forEach(d => d.classList.remove('open'));
  }

  if (toggle && menu) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.contains('open') ? closeSidebar() : openSidebar();
    });
  }

  // Tap backdrop → close
  backdrop.addEventListener('click', closeSidebar);

  // Close on resize to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeSidebar();
  });

  // ── Set active nav link based on current page ────────────────────────────
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    link.classList.remove('active');
    if (!href.startsWith('#') && href !== '' && href !== 'javascript:void(0)') {
      const linkPage = href.split('/').pop().split('?')[0].split('#')[0];
      if (linkPage === currentPath) link.classList.add('active');
    }
  });

  document.querySelectorAll('a[href^="#"]:not(.dropdown-toggle)').forEach(link => {
    link.addEventListener('click', function(e) {
      const hash = this.getAttribute('href');
      // Ignore bare "#" with no real target
      if (!hash || hash === '#') return;
      const isHome = currentPath === 'index.html' || currentPath === '';
      if (!isHome) {
        e.preventDefault();
        window.location.href = 'index.html' + hash;
      }
    });
  });

  // ── Dropdown: accordion on mobile, hover on desktop ──────────────────────
  allDropdowns.forEach(dd => {
    const link = dd.querySelector('.dropdown-toggle');
    if (link) {
      link.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
          e.preventDefault();
          e.stopPropagation();
          const isOpen = dd.classList.contains('open');
          allDropdowns.forEach(d => d.classList.remove('open'));
          if (!isOpen) dd.classList.add('open');
        }
      });
    }
  });

  // Close sidebar when a nav destination link or dropdown item is tapped
  menu?.querySelectorAll('.nav-link:not(.dropdown-toggle), .dropdown-item').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        setTimeout(closeSidebar, 60);
      }
    });
  });
}

// ─── Back To Top ──────────────────────────────────────────────────────────────

function initBackToTop() {
  var btn = document.getElementById('progressWrap');
  if (!btn) return;

  var path = btn.querySelector('.progress-wrap path') || btn.querySelector('.progress-circle path');

  if (path) {
    var pathLength = path.getTotalLength();
    path.style.transition = 'none';
    path.style.strokeDasharray  = pathLength + ' ' + pathLength;
    path.style.strokeDashoffset = pathLength;
    path.getBoundingClientRect(); // force reflow
    path.style.transition = 'stroke-dashoffset 10ms linear';

    function updateProgress() {
      var scroll  = window.scrollY;
      var height  = document.documentElement.scrollHeight - window.innerHeight;
      var progress = pathLength - (scroll * pathLength / height);
      path.style.strokeDashoffset = progress;
      btn.classList.toggle('active-progress', scroll > 50);
    }

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  } else {
    window.addEventListener('scroll', function() {
      btn.classList.toggle('active-progress', window.scrollY > 50);
    }, { passive: true });
  }

  btn.addEventListener('click', function(e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ─── Scroll-Spy (index.html only) ─────────────────────────────────────────────
// Highlights the correct nav link as you scroll through sections.

function initScrollSpy() {
  const isHome = (window.location.pathname.split('/').pop() || 'index.html') === 'index.html';
  if (!isHome) return;

  const sections = [
    { id: 'hero',    link: 'index.html'         },
    { id: 'about',   link: 'index.html#about'   },
    { id: 'contact', link: 'index.html#contact' },
  ];

  // Find the hero section — it has no id="hero" but is the first <section>
  const heroEl   = document.querySelector('.hero') || document.querySelector('section');
  const aboutEl  = document.getElementById('about');
  const contactEl= document.getElementById('contact');

  if (!heroEl) return;

  function getLink(href) {
    return document.querySelector(`.nav-link[href="${href}"]`);
  }

  function setActive(href) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const link = getLink(href);
    if (link) link.classList.add('active');
  }

  function onScroll() {
    const scrollY   = window.scrollY;
    const winH      = window.innerHeight;
    const threshold = winH * 0.45;

    if (contactEl && contactEl.getBoundingClientRect().top <= threshold) {
      setActive('index.html#contact');
      return;
    }
    if (aboutEl && aboutEl.getBoundingClientRect().top <= threshold) {
      setActive('index.html#about');
      return;
    }
    setActive('index.html');
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  // On load: always start with Home active at the top
  setActive('index.html');
  window.addEventListener('load', function() {
    if (window.scrollY < 50) setActive('index.html');
    else onScroll();
  });
}

// ─── Featured Posts (Home) ────────────────────────────────────────────────────

async function loadFeaturedPosts() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Loading works...</p></div>';

  if (typeof getAllPosts !== 'function') {
    grid.innerHTML = '<p class="error-text">Firebase not configured. Add your config to js/firebase.js.</p>';
    return;
  }

  try {
    const posts = await getAllPosts();
    if (posts.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><img src="assets/icons/home.svg" style="width:48px;height:48px;opacity:0.4;" alt=""></div><p>No posts yet. Start creating in the Editor!</p></div>';
      return;
    }
    grid.innerHTML = '';
    posts.slice(0, 6).forEach(post => grid.appendChild(buildCard(post, true)));
    stampCards(grid);
  } catch (e) {
    grid.innerHTML = '<p class="error-text">Could not load posts. Check your Firebase config in js/firebase.js.</p>';
  }
}

// ─── Sort Helper ──────────────────────────────────────────────────────────────

function sortByDate(posts, order) {
  return [...posts].sort((a, b) => {
    const da = a.date ? new Date(a.date) : 0;
    const db = b.date ? new Date(b.date) : 0;
    return order === 'oldest' ? da - db : db - da;
  });
}

// ─── Page Content (Blog / Poems / Stories) ────────────────────────────────────

const POSTS_PER_PAGE = 5;

async function loadPageContent(category) {
  const grid        = document.getElementById('posts-grid');
  const searchInput = document.getElementById('search-input');
  if (!grid) return;

  grid.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Loading...</p></div>';

  if (typeof getPostsByCategory !== 'function') {
    grid.innerHTML = '<p class="error-text">Firebase not configured. Add your config to js/firebase.js.</p>';
    return;
  }

  let allPosts = [];
  try {
    allPosts = await getPostsByCategory(category);
  } catch (e) {
    grid.innerHTML = '<p class="error-text">Could not load posts. Check your Firebase config.</p>';
    return;
  }

  // Default: newest first
  allPosts = sortByDate(allPosts, 'newest');

  let currentPage   = 1;
  let filteredPosts = allPosts;
  let sortOrder     = 'newest';

  // ── Sort controls ─────────────────────────────────────────────────────────
  // Wrap sort + grid in a shared column so they always align
  const colWrap = document.createElement('div');
  colWrap.className = 'posts-col-wrap';
  grid.parentNode.insertBefore(colWrap, grid);
  colWrap.appendChild(grid);

  const sortWrap = document.createElement('div');
  sortWrap.className = 'sort-wrap';
  sortWrap.innerHTML = `
    <span class="sort-label">Sort:</span>
    <button class="sort-btn active" data-sort="newest">Newest</button>
    <button class="sort-btn" data-sort="oldest">Oldest</button>
  `;
  colWrap.insertBefore(sortWrap, grid);

  sortWrap.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sortOrder = btn.dataset.sort;
      sortWrap.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const q = searchInput ? searchInput.value.toLowerCase() : '';
      filteredPosts = sortByDate(
        q ? allPosts.filter(p =>
          p.title.toLowerCase().includes(q) ||
          stripHTML(p.content || '').toLowerCase().includes(q)
        ) : allPosts,
        sortOrder
      );
      currentPage = 1;
      renderPage(filteredPosts, currentPage);
    });
  });

  // ── Pagination container ──────────────────────────────────────────────────
  let paginationEl = document.getElementById('pagination');
  if (!paginationEl) {
    paginationEl = document.createElement('div');
    paginationEl.id = 'pagination';
    paginationEl.className = 'pagination';
    colWrap.appendChild(paginationEl);
  }

  function renderPage(posts, page) {
    grid.innerHTML = '';
    paginationEl.innerHTML = '';

    if (posts.length === 0) {
      grid.innerHTML = '<div class="empty-state"><div class="empty-state-icon"><img src="assets/icons/blog.svg" style="width:40px;height:40px;opacity:0.4;" alt=""></div><p>No posts found.</p></div>';
      return;
    }

    const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);
    const start      = (page - 1) * POSTS_PER_PAGE;
    const pagePosts  = posts.slice(start, start + POSTS_PER_PAGE);

    pagePosts.forEach(post => grid.appendChild(buildCard(post, false)));
    stampCards(grid);

    if (totalPages <= 1) return;

    const prev = document.createElement('button');
    prev.className = 'pagination-btn' + (page === 1 ? ' disabled' : '');
    prev.innerHTML = 'Prev';
    prev.disabled  = page === 1;
    prev.addEventListener('click', () => {
      if (currentPage > 1) { currentPage--; renderPage(filteredPosts, currentPage); scrollToGrid(); }
    });
    paginationEl.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.className = 'pagination-btn pagination-num' + (i === page ? ' active' : '');
      btn.textContent = i;
      btn.addEventListener('click', () => {
        currentPage = i;
        renderPage(filteredPosts, currentPage);
        scrollToGrid();
      });
      paginationEl.appendChild(btn);
    }

    const next = document.createElement('button');
    next.className = 'pagination-btn' + (page === totalPages ? ' disabled' : '');
    next.innerHTML = 'Next';
    next.disabled  = page === totalPages;
    next.addEventListener('click', () => {
      if (currentPage < totalPages) { currentPage++; renderPage(filteredPosts, currentPage); scrollToGrid(); }
    });
    paginationEl.appendChild(next);

    const info = document.createElement('span');
    info.className = 'pagination-info';
    info.textContent = `Page ${page} of ${totalPages}`;
    paginationEl.appendChild(info);
  }

  function scrollToGrid() {
    grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  renderPage(filteredPosts, currentPage);

  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      const q = searchInput.value.toLowerCase();
      filteredPosts = sortByDate(
        q ? allPosts.filter(p =>
          p.title.toLowerCase().includes(q) ||
          stripHTML(p.content || '').toLowerCase().includes(q)
        ) : allPosts,
        sortOrder
      );
      currentPage = 1;
      renderPage(filteredPosts, currentPage);
    }, 200));
  }
}

// ─── Card Builder ──────────────────────────────────────────────────────────────

function buildCard(post, compact) {
  const card = document.createElement('div');
  const isPoem = post.category === 'poem';
  card.className = 'card';
  card.dataset.postcat = post.category || '';

  const date = post.date
    ? new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  const catIcons = {
    blog:    'assets/icons/blog.svg',
    poem:    'assets/icons/poem.svg',
    story:   'assets/icons/story.svg',
    beats:   'assets/icons/music.svg',
    movies:  'assets/icons/movie.svg',
    tvshows: 'assets/icons/tv.svg'
  };
  const catNames = { blog: 'Blog', poem: 'Poem', story: 'Story', beats: 'Beats', movies: 'Movie', tvshows: 'TV Show' };
  const icon     = catIcons[post.category]
    ? `<img src="${catIcons[post.category]}" style="width:14px;height:14px;display:block;opacity:0.8;flex-shrink:0;" alt="">`
    : '';
  const catLabel = `${icon}${catNames[post.category] || post.category}`;

  // Reading time
  const plainText = stripHTML(post.content || '');
  const words     = plainText.trim().split(/\s+/).filter(Boolean).length;
  const mins      = Math.max(1, Math.round(words / 200));
  const readTime  = `${mins} min read`;

  // Preview — 2 lines for poems, 120 chars for others
  const maxChars  = 120;
  const preview   = isPoem
    ? (() => { const lines = plainText.split('\n').filter(l => l.trim()); return lines.slice(0,2).join(' / ').slice(0, maxChars); })()
    : plainText.slice(0, maxChars);

  card.innerHTML = `
    ${!isPoem && post.imageURL ? `<img class="card-image" src="${post.imageURL}" alt="${post.title}" loading="lazy">` : ''}
    <span class="card-category">${catLabel}</span>
    <h3 class="card-title">${post.title}</h3>
    <div class="card-meta-row">
      ${date ? `<span class="card-date">${date}</span>` : ''}
      <span class="card-read-time">${readTime}</span>
    </div>
    ${!compact && preview ? `<p class="card-preview">${preview.slice(0,120)}&hellip;</p>` : ''}
    <a href="post.html?id=${post.id}" class="card-link">Read</a>
  `;
  return card;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripHTML(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent || d.innerText || '';
}

// ─── Editor Access ─────────────────────────────────────────────────────────────
// Editor is at editor.html — protected by Firebase Authentication.

(function() {
  let aimBuffer = '';
  let aimTimer  = null;

  document.addEventListener('keydown', function(e) {
    const el  = document.activeElement;
    const tag = el ? el.tagName.toLowerCase() : '';
    if (['input','textarea','select'].includes(tag) || el?.isContentEditable) {
      aimBuffer = '';
      return;
    }

    if (e.key.length !== 1) return;

    aimBuffer += e.key.toLowerCase();
    if (aimBuffer.length > 3) aimBuffer = aimBuffer.slice(-3);

    clearTimeout(aimTimer);
    aimTimer = setTimeout(function() { aimBuffer = ''; }, 2000);

    if (aimBuffer === 'aim') {
      aimBuffer = '';
      clearTimeout(aimTimer);
      if (window.location.pathname.endsWith('editor.html')) return;
      window.location.href = 'editor.html';
    }
  });
}());

// ─── Smooth Page Transitions ──────────────────────────────────────────────────

document.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (!href) return;

    // If clicking "Home" (index.html or index.html#) while already on index — just scroll top
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const isOnIndex   = currentPath === 'index.html' || currentPath === '';
    const hrefBase    = href.split('#')[0] || 'index.html';
    const isHomeLink  = hrefBase === 'index.html' || hrefBase === '';

    if (isOnIndex && isHomeLink && !href.includes('#')) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (
      !href.startsWith('#') &&
      !href.startsWith('mailto') &&
      !href.startsWith('javascript') &&
      href !== '' &&
      !this.hasAttribute('data-no-transition') &&
      !this.target
    ) {
      e.preventDefault();
      document.body.classList.add('page-exit');
      setTimeout(() => window.location.href = href, 300);
    }
  });
});