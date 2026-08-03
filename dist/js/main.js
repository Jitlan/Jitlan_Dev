/* ==========================================================================
   jordanliebling.dev — Main JavaScript
   ========================================================================== */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
   * 0. DARK MODE TOGGLE
   * ------------------------------------------------------------------ */
  var toggle = document.querySelector('.theme-toggle');

  function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
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
      // Snap faces past the hover split to the new resting face until the cursor leaves.
      toggle.classList.add('theme-toggle--clicked');
    });
    toggle.addEventListener('mouseleave', function () {
      toggle.classList.remove('theme-toggle--clicked');
    });
    toggle.addEventListener('blur', function () {
      toggle.classList.remove('theme-toggle--clicked');
    });

    // Periodic peek: every 3s, briefly reveal the other face.
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!reducedMotion || !reducedMotion.matches) {
      setInterval(function () {
        if (document.hidden) return;
        if (toggle.matches(':hover, :focus-visible')) return;
        if (toggle.classList.contains('theme-toggle--clicked')) return;
        if (toggle.classList.contains('hidden')) return;
        toggle.classList.add('theme-toggle--peek');
        setTimeout(function () {
          toggle.classList.remove('theme-toggle--peek');
        }, 550);
      }, 3000);
    }
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
    'AI implementation expert.',
    'Teaching teams to ship with AI.',
    'Building VoteHound.',
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
    { icon: '>>', text: 'Championed AI tooling for a dev team of ~30' },
    { icon: '**', text: 'votehound.com — congressional activity tracker', link: 'https://votehound.com' },
    { icon: '**', text: 'endorsements.app — merit backed by real people', link: 'https://endorsements.app' },
    { icon: '##', text: 'Enterprise application builder' },
    { icon: '!!', text: 'Exploring MCP servers & agentic workflows' },
    { icon: '>>', text: '8+ years full-stack experience' },
    { icon: '++', text: 'Building an AI knowledge base in Obsidian — linking skills, prompts & workflows', isNew: true },
    { icon: '??', text: 'Evaluating which Scrum ceremonies remain essential in an AI-assisted workflow', isNew: true },
    { icon: '>>', text: 'Deploying coordinated agent teams via Claude Code remote-control mode', isNew: true },
    { icon: '//', text: 'Building agents and AI tooling for research and discovery workflows', isNew: true },
    { icon: '!!', text: 'Deepening expertise in agent harness design, token management, and model selection', isNew: true },
    { icon: '++', text: 'Building and exploring effective AI-enabled tooling for accelerating development', isNew: true },
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
      var label = item.isNew
        ? '<span class="ticker__new">NEW</span> <span class="ticker__wave">' + item.text + '</span>'
        : item.text;
      el.innerHTML =
        '<span class="ticker__icon">' + item.icon + '</span> ' + label;
      if (item.isNew) el.classList.add('ticker__item--new');
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
  var fadeEls = document.querySelectorAll('.about__card, .project-card, .bio__content');

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
