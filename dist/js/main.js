/* ==========================================================================
   jordanliebling.dev — Main JavaScript
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * 0. DARK MODE TOGGLE
   * ------------------------------------------------------------------ */
  var toggle = document.querySelector('.theme-toggle');
  var icon = toggle && toggle.querySelector('.theme-toggle__icon');

  function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (icon) icon.textContent = dark ? '\u263E' : '\u263C';
  }

  // Restore saved preference, fall back to system preference
  var saved = localStorage.getItem('theme');
  if (saved) {
    applyTheme(saved === 'dark');
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme(true);
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      applyTheme(!isDark);
      localStorage.setItem('theme', !isDark ? 'dark' : 'light');
    });
  }

  // Hide toggle on scroll (mobile only), reappear after 1.5s idle
  if (toggle) {
    var scrollTimer = null;
    var mobileQuery = window.matchMedia('(max-width: 767px)');

    window.addEventListener('scroll', function () {
      if (!mobileQuery.matches) return;
      toggle.classList.add('hidden');
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        toggle.classList.remove('hidden');
      }, 1500);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
   * 1. TYPING ANIMATION
   * ------------------------------------------------------------------ */
  const PHRASES = [
    'Senior Software Engineer.',
    'AI enablement advocate.',
    'Building Capitol-Watch',
    'Full-stack builder.',
    'Passionate about DevX.',
    'Making teams faster with AI.',
  ];

  const typedEl = document.querySelector('.hero__typed');
  if (typedEl) {
    let phraseIdx = 0;
    let charIdx = 0;
    let deleting = false;

    const TYPE_SPEED = 55;
    const DELETE_SPEED = 40;
    const PAUSE_TYPED = 3000;
    const PAUSE_DELETED = 500;

    function tick() {
      const phrase = PHRASES[phraseIdx];

      if (!deleting) {
        charIdx++;
        typedEl.textContent = phrase.substring(0, charIdx);
        if (charIdx === phrase.length) {
          deleting = true;
          setTimeout(tick, PAUSE_TYPED);
          return;
        }
        setTimeout(tick, TYPE_SPEED);
      } else {
        charIdx--;
        typedEl.textContent = phrase.substring(0, charIdx);
        if (charIdx === 0) {
          deleting = false;
          phraseIdx = (phraseIdx + 1) % PHRASES.length;
          setTimeout(tick, PAUSE_DELETED);
          return;
        }
        setTimeout(tick, DELETE_SPEED);
      }
    }

    tick();
  }

  /* ------------------------------------------------------------------
   * 2. STOCK TICKER
   * ------------------------------------------------------------------
   * Edit this array to add, remove, or reorder ticker items.
   * Set `link` to make an item clickable.
   * ------------------------------------------------------------------ */
  const TICKER_ITEMS = [
    { icon: '//', text: 'Building AI product features with Claude, GPT, Gemini & more' },
    { icon: '>>', text: 'Championed AI tooling for large a dev team' },
    { icon: '**', text: 'capitol-watch.com now live', link: 'https://capitol-watch.com' },
    { icon: '##', text: 'Enterprise application builder' },
    { icon: '!!', text: 'Exploring MCP servers & agentic workflows' },
    { icon: '>>', text: '8+ years full-stack experience' },
  ];

  const tickerTrack = document.querySelector('.ticker__track');
  if (tickerTrack) {
    function createTickerItem(item) {
      const tag = item.link ? 'a' : 'span';
      const el = document.createElement(tag);
      el.className = 'ticker__item';
      if (item.link) {
        el.href = item.link;
        el.target = '_blank';
        el.rel = 'noopener';
      }
      el.innerHTML =
        '<span class="ticker__icon">' + item.icon + '</span> ' + item.text;
      return el;
    }

    function buildSet() {
      var frag = document.createDocumentFragment();
      TICKER_ITEMS.forEach(function (item, i) {
        frag.appendChild(createTickerItem(item));
        if (i < TICKER_ITEMS.length - 1) {
          var sep = document.createElement('span');
          sep.className = 'ticker__separator';
          sep.textContent = '\u2022';
          frag.appendChild(sep);
        }
      });
      return frag;
    }

    // Two copies for seamless loop
    tickerTrack.appendChild(buildSet());

    // Add separator between sets
    var midSep = document.createElement('span');
    midSep.className = 'ticker__separator';
    midSep.textContent = '\u2022';
    tickerTrack.appendChild(midSep);

    tickerTrack.appendChild(buildSet());

    // Calculate duration based on content width
    requestAnimationFrame(function () {
      var halfWidth = tickerTrack.scrollWidth / 2;
      var pxPerSec = 50;
      tickerTrack.style.animationDuration = (halfWidth / pxPerSec) + 's';
    });
  }

  /* ------------------------------------------------------------------
   * 3. SCROLL FADE-IN
   * ------------------------------------------------------------------ */
  var fadeEls = document.querySelectorAll('.about__card, .project-card');

  if (fadeEls.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    fadeEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    // Fallback: show everything immediately
    fadeEls.forEach(function (el) {
      el.classList.add('visible');
    });
  }
})();
