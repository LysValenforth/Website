const { useState, useRef, useEffect } = React;

function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ─── Play/Pause SVG Button ──────────────────────────────────────────
function PlayPauseBtn({ isPlaying, onClick }) {
  return (
    <button
      className="play-pause-btn"
      type="button"
      aria-label={isPlaying ? 'Pause' : 'Play'}
      data-playing={isPlaying}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 100 100"
        width="54"
        height="54"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="7"
      >
        <circle cx="50" cy="50" r="46" opacity="0.15" />
        <line className="pp-line1" x1="42" y1="30" x2="42" y2="70" />
        <line className="pp-line2" x1="42" y1="70" x2="70" y2="50" />
        <line className="pp-line3" x1="70" y1="50" x2="42" y2="30" />
        <circle className="pp-ring1" cx="50" cy="50" r="46" />
        <path
          className="pp-ring2"
          strokeDasharray="55 365"
          strokeDashoffset="55"
          d="M 41.996 4.631 C 41.996 4.631 47.464 3.48 52.3 7.107 C 58.062 11.43 58 18 58 18 L 58 70"
        />
        <path
          className="pp-ring3"
          strokeDasharray="40 365"
          strokeDashoffset="40"
          d="M 41.996 4.631 C 41.996 4.631 47.464 3.48 52.3 7.107 C 58.062 11.43 58 18 58 18 L 58 76"
          transform="scale(1, -1)"
        />
      </svg>
    </button>
  );
}

// ─── Seek / Progress Bar ──────────────────────────────────────────────────────
function ProgressBar({ progress, duration, currentTime, onSeek }) {
  const trackRef = useRef(null);

  function handleClick(e) {
    if (!trackRef.current || !duration) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct * duration);
  }

  const pct = (progress * 100).toFixed(2) + '%';

  return (
    <div className="beat-progress-area">
      <span className="beat-time">{fmtTime(currentTime)}</span>
      <div className="beat-progress-track" ref={trackRef} onClick={handleClick}>
        <div className="beat-progress-fill" style={{ width: pct }} />
        <div className="beat-progress-thumb" style={{ left: pct }} />
      </div>
      <span className="beat-time">{fmtTime(duration)}</span>
    </div>
  );
}

// ─── Single Beat Card ─────────────────────────────────────────────────────────
function BeatCard({ item, activeId, onActivate, index }) {
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [volume,      setVolume]      = useState(0.85);
  const audioRef = useRef(null);

  useEffect(() => {
    if (activeId !== item.id && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, [activeId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime  = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    };
    const onLoad  = () => setDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate',     onTime);
    audio.addEventListener('loadedmetadata', onLoad);
    audio.addEventListener('ended',          onEnded);
    return () => {
      audio.removeEventListener('timeupdate',     onTime);
      audio.removeEventListener('loadedmetadata', onLoad);
      audio.removeEventListener('ended',          onEnded);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      onActivate(item.id); 
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }

  function handleSeek(t) {
    if (audioRef.current) audioRef.current.currentTime = t;
  }

  function handleVolume(e) {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }

  const waveBars = Array.from({ length: 26 }, (_, i) => (
    <span
      key={i}
      className="wave-bar"
      style={{
        animationDelay: `${(i * 0.065).toFixed(3)}s`,
        height: `${22 + Math.sin(i * 0.85) * 14 + Math.cos(i * 0.5) * 8}%`,
      }}
    />
  ));

  const title       = item.title       || 'Untitled';
  const artist      = item.creator     || '';   
  const genre       = item.genre       || 'Beat';
  const description = item.description || '';
  const coverURL    = item.imageURL    || '';  
  const audioSrc    = item.audioURL    || '';  

  return (
    <article
      className={`beat-card${isPlaying ? ' is-playing' : ''}`}
      data-sa-card={String(Math.min(index || 0, 15))}
    >
      {audioSrc && <audio ref={audioRef} src={audioSrc} preload="metadata" />}

      {/* Animated waveform backdrop (shows when playing) */}
      <div className="beat-waveform" aria-hidden="true">{waveBars}</div>

      <div className="beat-inner">
        {/* Cover art */}
        <div className="beat-cover-wrap">
          {coverURL
            ? <img className="beat-cover" src={coverURL} alt={title} />
            : <div className="beat-cover-fallback">🎵</div>
          }
          <div className="beat-cover-glow" />
        </div>

        {/* Info + controls */}
        <div className="beat-body">
          <span className="beat-genre">{genre}</span>

          <div className="beat-title-row">
            <h3 className="beat-title">{title}</h3>
            {artist && <span className="beat-artist">{artist}</span>}
          </div>

          {description && <p className="beat-desc">{description}</p>}

          <div className="beat-controls">
            <PlayPauseBtn isPlaying={isPlaying} onClick={togglePlay} />

            <div className="beat-right-controls">
              <ProgressBar
                progress={progress}
                duration={duration}
                currentTime={currentTime}
                onSeek={handleSeek}
              />
              <div className="beat-volume-row">
                <span className="beat-vol-icon">♪</span>
                <input
                  type="range"
                  className="beat-volume-slider"
                  min="0"
                  max="1"
                  step="0.02"
                  value={volume}
                  onChange={handleVolume}
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// ─── Beats App (root component) ───────────────────────────────────────────────
function BeatsApp({ initialItems }) {
  const [items,    setItems]    = useState(initialItems || []);
  const [filtered, setFiltered] = useState(initialItems || []);
  const [loading,  setLoading]  = useState(!initialItems);
  const [activeId, setActiveId] = useState(null);
  const listRef = useRef(null);

  // Re-stamp data-sa-card whenever filtered list changes so each
  // re-render (search, initial load) gets the staggered entrance.
  useEffect(() => {
    if (!listRef.current) return;
    const cards = listRef.current.querySelectorAll('.beat-card');
    cards.forEach((el, i) => {
      el.removeAttribute('data-sa-card');
      void el.offsetWidth;
      el.dataset.saCard = String(Math.min(i, 15));
    });
  }, [filtered]);

  useEffect(() => {
    if (initialItems) return;
    if (typeof getAllMediaHub === 'function') {
      getAllMediaHub()
        .then(all => {
          const beats = all.filter(i => i.category === 'beats');
          setItems(beats);
          setFiltered(beats);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    function onInput() {
      const q = searchInput.value.toLowerCase().trim();
      if (!q) { setFiltered(items); return; }
      setFiltered(
        items.filter(i =>
          (i.title   || '').toLowerCase().includes(q) ||
          (i.creator || '').toLowerCase().includes(q) ||
          (i.genre   || '').toLowerCase().includes(q)
        )
      );
    }

    searchInput.addEventListener('input', onInput);
    return () => searchInput.removeEventListener('input', onInput);
  }, [items]);

  if (loading) {
    return (
      <div className="beats-loading">
        <div className="beats-loading-spinner" />
        <p>Loading beats...</p>
      </div>
    );
  }

  if (!filtered.length) {
    return (
      <div className="beats-empty">
        <p style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎵</p>
        <p>{items.length ? 'No beats match your search.' : 'No beats added yet.'}</p>
      </div>
    );
  }

  return (
    <div className="beats-list-wrap" ref={listRef}>
      {filtered.map((item, idx) => (
        <BeatCard
          key={item.id}
          item={item}
          activeId={activeId}
          onActivate={setActiveId}
          index={idx}
        />
      ))}
    </div>
  );
}

(function mount() {
  const container = document.getElementById('mediahub-grid');
  if (!container) return;
  container.innerHTML = '';
  ReactDOM.createRoot(container).render(<BeatsApp initialItems={null} />);
})();