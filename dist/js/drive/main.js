/* ==========================================================================
   Drive — bootstrap
   --------------------------------------------------------------------------
   <html data-view="drive|classic"> is decided by a tiny inline script in the
   head (so there's no flash). This module adds the view toggle and, in drive
   view, loads the 3D scene. If anything about WebGL goes wrong the page drops
   back to the classic layout, which never depended on any of this.
   ========================================================================== */

const root = document.documentElement;
const VIEW_KEY = 'jl-view';

function canDrive() {
  return typeof window.WebGL2RenderingContext !== 'undefined';
}

function setView(view) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch (e) {
    /* ignore */
  }
  // drop any ?view= override so the saved choice is what loads
  window.location.replace(window.location.pathname + window.location.hash);
}

function buildViewToggle() {
  if (!canDrive()) return;
  const drive = root.getAttribute('data-view') === 'drive';
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'view-toggle';
  b.textContent = drive ? 'Classic view' : 'Take the drive';
  b.setAttribute('aria-label', drive ? 'Switch to the classic page layout' : 'Switch to the 3D driving view');
  b.addEventListener('click', () => setView(drive ? 'classic' : 'drive'));
  document.body.appendChild(b);
}

function fallBack(err) {
  if (err) console.warn('[drive] falling back to the classic view:', err);
  root.setAttribute('data-view', 'classic');
  root.classList.remove('drive-ready', 'is-gaming', 'hud-wide', 'hud-compact');
  document.querySelectorAll('.drive-canvas, .hud, .hud-nav, .hud-spacer, .game, .start-btn, .view-toggle').forEach((n) => n.remove());
  document.querySelectorAll('.hud-panel').forEach((n) => {
    n.classList.remove('hud-panel', 'is-active', 'is-before', 'is-after');
    n.style.translate = '';
    if (n.firstElementChild) n.firstElementChild.style.transform = '';
  });
}

async function boot() {
  let engine;
  try {
    const [{ Engine }, { Hud }, { Game }] = await Promise.all([import('./engine.js'), import('./hud.js'), import('./game.js')]);

    const canvas = document.createElement('canvas');
    canvas.className = 'drive-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);

    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const mobile = coarse || Math.min(window.screen.width, window.screen.height) < 700;
    engine = new Engine(canvas, { mobile });
    const hud = new Hud(engine);
    const game = new Game(engine, hud);

    // the real, focusable control sitting on top of the 3D start button
    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'start-btn';
    startBtn.innerHTML = '<span>Push to start</span>';
    const START_LABEL = 'Engine start: play the driving game';
    startBtn.setAttribute('aria-label', START_LABEL);
    startBtn.addEventListener('click', () => {
      engine.startPressed = 1;
      game.toggle();
      const on = game.active;
      startBtn.setAttribute('aria-label', on ? 'Engine stop: leave the driving game' : START_LABEL);
      startBtn.firstElementChild.textContent = on ? 'Push to stop' : 'Push to start';
      if (on) startBtn.blur(); // keys now belong to the pedals
    });
    document.body.appendChild(startBtn);
    game.onExit = () => {
      startBtn.setAttribute('aria-label', START_LABEL);
      startBtn.firstElementChild.textContent = 'Push to start';
    };

    let startKey = '';
    engine.onLayout = (L) => {
      hud.layout(L);
      game.layout(engine.layout(true));
    };
    engine.onFrame = () => {
      hud.frameSync();
      // whole pixels, and only when it has actually moved: the 3D button shivers with the road
      const s = engine.startScreen;
      const size = Math.round(Math.max(44, s.r * 2.1));
      const key = `${Math.round(s.x - size / 2)},${Math.round(s.y - size / 2)},${size},${s.visible}`;
      if (key !== startKey) {
        startKey = key;
        startBtn.style.width = startBtn.style.height = size + 'px';
        startBtn.style.transform = `translate3d(${Math.round(s.x - size / 2)}px,${Math.round(s.y - size / 2)}px,0)`;
        startBtn.style.visibility = s.visible ? 'visible' : 'hidden';
      }
    };

    // light theme = overcast afternoon, dark theme = the same road at night
    const syncTheme = (instant) => engine.setNight(root.getAttribute('data-theme') === 'dark', instant);
    syncTheme(true);
    new MutationObserver(() => syncTheme(false)).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

    if ('ResizeObserver' in window) new ResizeObserver(() => engine.resize()).observe(canvas);
    window.addEventListener('resize', () => engine.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => engine.resize(), 250));

    if (!coarse) {
      window.addEventListener(
        'pointermove',
        (e) => engine.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1),
        { passive: true },
      );
    }

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      engine.stop();
      fallBack('WebGL context lost');
      buildViewToggle();
    });

    engine.resize();
    engine.step(1 / 60);
    engine.render();
    engine.start();
    root.classList.add('drive-ready');
    // browser chrome matches the cabin rather than the classic page's paper colour
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', '#05080a');
    window.__drive = { engine, hud, game };
  } catch (err) {
    if (engine) {
      try {
        engine.dispose();
      } catch (e) {
        /* already gone */
      }
    }
    fallBack(err);
    buildViewToggle();
  }
}

if (root.getAttribute('data-view') === 'drive' && canDrive()) {
  buildViewToggle();
  boot();
} else {
  root.setAttribute('data-view', 'classic');
  buildViewToggle();
}
