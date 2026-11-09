/* ==========================================================================
   Drive — windshield HUD
   --------------------------------------------------------------------------
   The page's own sections become HUD panels pinned to the glass. The document
   keeps its natural scroll bar (a spacer supplies the height); scrolling
   moves between panels, reads through any panel taller than the glass, and
   nudges the car along the road.
   ========================================================================== */

import { IMPERIAL, UNITS, clamp, fmtSpeed } from './util.js';

const TITLES = {
  hero: 'DRIVER',
  bio: 'ABOUT ME',
  stack: 'TECH STACK',
  about: 'WHAT I DO',
  projects: 'SIDE PROJECTS',
  footer: 'CONTACT',
};

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export class Hud {
  /** @param {import('./engine.js').Engine} engine */
  constructor(engine) {
    this.engine = engine;
    this.root = document.documentElement;
    this.enabled = true;
    this.active = -1;
    this.lastY = window.scrollY;
    this.total = 0;
    this.wide = true;
    this._textAt = 0;
    this._raf = 0;
    this._measureTimer = 0;

    this.panels = Array.from(document.querySelectorAll('body > section:not(.sr-only), body > footer')).map((node) => {
      const key = node.id || 'footer';
      node.classList.add('hud-panel');
      return { el: node, content: node.firstElementChild, key, title: TITLES[key] || key.toUpperCase(), start: 0, lead: 0, overflow: 0, tail: 0, len: 0, offset: 0 };
    });

    this._build();

    this._onScroll = this._onScroll.bind(this);
    this._apply = this._apply.bind(this);
    window.addEventListener('scroll', this._onScroll, { passive: true });
    document.addEventListener('focusin', (e) => this._onFocus(e));

    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(() => this._scheduleMeasure());
      for (const p of this.panels) ro.observe(p.content);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this._scheduleMeasure());
    window.addEventListener('load', () => this._scheduleMeasure());
  }

  _build() {
    const n = this.panels.length;
    const temp = IMPERIAL ? '52°F' : '11°C';
    this.engine.screenState.temp = temp;

    const hud = (this.hud = el('div', 'hud'));
    hud.setAttribute('aria-hidden', 'true');
    hud.innerHTML = `
      <div class="hud__frame">
        <div class="hud__bar">
          <span class="hud__idx"></span>
          <span class="hud__title"></span>
          <span class="hud__ticks">${'<i></i>'.repeat(n)}</span>
          <span class="hud__meta"><b class="hud__speed">0</b> ${UNITS.speed}</span>
        </div>
        <i class="hud__corner hud__corner--tl"></i><i class="hud__corner hud__corner--tr"></i>
        <i class="hud__corner hud__corner--bl"></i><i class="hud__corner hud__corner--br"></i>
        <div class="hud__thumb"><i></i></div>
        <div class="hud__hint">Scroll to drive <svg width="10" height="14" viewBox="0 0 20 28" fill="none"><path d="M10 4 L10 20 M4 15 L10 21 L16 15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      </div>
      <div class="hud__cluster">
        <div class="hud__big"><b>0</b><span>${UNITS.speed}</span></div>
        <div class="hud__sub"><span class="hud__gear">D2</span><span>RAIN ${temp}</span><span>WIPERS AUTO</span></div>
        <div class="hud__way"><span class="hud__way-label">NEXT</span> <b></b></div>
      </div>`;
    document.body.appendChild(hud);
    this.frame = hud.querySelector('.hud__frame');
    this.cluster = hud.querySelector('.hud__cluster');
    this.$idx = hud.querySelector('.hud__idx');
    this.$title = hud.querySelector('.hud__title');
    this.$ticks = Array.from(hud.querySelectorAll('.hud__ticks i'));
    this.$speed = hud.querySelector('.hud__speed');
    this.$big = hud.querySelector('.hud__big b');
    this.$gear = hud.querySelector('.hud__gear');
    this.$way = hud.querySelector('.hud__way b');
    this.$wayLabel = hud.querySelector('.hud__way-label');
    this.$thumb = hud.querySelector('.hud__thumb');
    this.$thumbBar = hud.querySelector('.hud__thumb i');

    this.spacer = el('div', 'hud-spacer');
    this.spacer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.spacer);

    const nav = (this.nav = el('nav', 'hud-nav'));
    nav.setAttribute('aria-label', 'Sections');
    this.navButtons = this.panels.map((p, i) => {
      const b = el('button', 'hud-nav__dot', `<span>${p.title}</span>`);
      b.type = 'button';
      b.setAttribute('aria-label', 'Go to ' + p.title.toLowerCase());
      b.addEventListener('click', () => this.goTo(i));
      nav.appendChild(b);
      return b;
    });
    document.body.appendChild(nav);

    // a quiet nudge toward the easter egg at the end of the route
    const foot = this.panels[n - 1];
    if (foot && !foot.content.querySelector('.hud-egg')) {
      foot.content.appendChild(el('p', 'hud-egg', 'P.S. The start button on the dash isn&rsquo;t just for show.'));
    }
  }

  /* ------------------------------------------------------------- layout */

  /** @param {ReturnType<import('./engine.js').Engine['layout']>} L */
  layout(L) {
    this.L = L;
    const W = L.width;
    const vh = window.innerHeight;
    const ticker = document.querySelector('.ticker');
    const tickH = ticker ? ticker.offsetHeight : 0;
    const wide = W >= 1180 && W / vh >= 1.15;
    this.wide = wide;
    let x;
    let w;
    const top = tickH + (wide ? 22 : 10);
    let bottom = Math.min(L.cowlTop, vh) - (wide ? 20 : 10);
    if (wide) {
      x = Math.round(W * 0.52);
      w = Math.min(W - Math.max(72, W * 0.05) - x, 800);
    } else {
      x = Math.max(10, Math.round(W * 0.035));
      w = W - 2 * x;
    }
    if (bottom - top < 250) bottom = top + 250; // tiny windows: let it overlap the dash rather than vanish
    const h = Math.round(bottom - top);
    const s = this.root.style;
    s.setProperty('--hud-x', x + 'px');
    s.setProperty('--hud-y', top + 'px');
    s.setProperty('--hud-w', Math.round(w) + 'px');
    s.setProperty('--hud-h', h + 'px');
    s.setProperty('--hud-bottom', Math.round(bottom) + 'px');
    this.root.classList.toggle('hud-wide', wide);
    this.root.classList.toggle('hud-compact', !wide);
    this.measure();
  }

  _scheduleMeasure() {
    clearTimeout(this._measureTimer);
    this._measureTimer = setTimeout(() => this.measure(), 60);
  }

  /** Work out how much scrolling each panel needs. */
  measure() {
    if (!this.L) return;
    const vh = window.innerHeight;
    const dwell = clamp(vh * 0.5, 300, 520);
    let at = 0;
    const last = this.panels.length - 1;
    this.panels.forEach((p, i) => {
      const view = p.el.clientHeight;
      const need = p.content.offsetHeight;
      p.overflow = Math.max(0, Math.ceil(need - view + 14));
      p.lead = i === 0 ? 0 : dwell / 2;
      p.tail = i === last ? 60 : dwell / 2;
      p.len = p.lead + p.overflow + p.tail;
      p.start = at;
      at += p.len;
    });
    this.total = at;
    this.spacer.style.height = Math.ceil(at - 20 + vh) + 'px';
    this._apply(true);
  }

  /* ------------------------------------------------------------- scroll */

  _onScroll() {
    const y = window.scrollY;
    const dy = y - this.lastY;
    // a jump (nav dot, focus, Home/End) is not a push on the throttle
    if (this.enabled && Math.abs(dy) < window.innerHeight * 0.9) this.engine.cruise.feed(dy);
    this.lastY = y;
    if (!this._raf) this._raf = requestAnimationFrame(this._apply);
  }

  _apply(force) {
    this._raf = 0;
    if (!this.panels.length) return;
    const y = clamp(window.scrollY, 0, Math.max(0, this.total - 1));
    let idx = this.panels.length - 1;
    for (let i = 0; i < this.panels.length; i++) {
      if (y < this.panels[i].start + this.panels[i].len) {
        idx = i;
        break;
      }
    }
    const p = this.panels[idx];
    const offset = clamp(y - p.start - p.lead, 0, p.overflow);
    if (offset !== p.offset || force === true) {
      p.offset = offset;
      p.content.style.transform = offset ? `translate3d(0,${-offset}px,0)` : '';
    }
    if (p.overflow > 0) {
      const view = p.el.clientHeight;
      const size = clamp(view / (view + p.overflow), 0.12, 1);
      this.$thumb.style.opacity = '1';
      this.$thumbBar.style.height = (size * 100).toFixed(1) + '%';
      this.$thumbBar.style.top = ((offset / p.overflow) * (1 - size) * 100).toFixed(1) + '%';
    } else {
      this.$thumb.style.opacity = '0';
    }
    p.el.classList.toggle('has-more-above', offset > 2);
    p.el.classList.toggle('has-more-below', offset < p.overflow - 2);
    // the "scroll to drive" tab bows out once they've done it
    this.frame.classList.toggle('is-scrolled', window.scrollY > 12);
    if (idx !== this.active) this._activate(idx);
  }

  _activate(idx) {
    this.active = idx;
    const n = this.panels.length;
    this.panels.forEach((p, i) => {
      p.el.classList.toggle('is-active', i === idx);
      p.el.classList.toggle('is-before', i < idx);
      p.el.classList.toggle('is-after', i > idx);
      if (i !== idx) {
        // park the others at the end they'll be entered from
        p.offset = i < idx ? p.overflow : 0;
        p.content.style.transform = p.offset ? `translate3d(0,${-p.offset}px,0)` : '';
        p.el.style.translate = '';
      }
      this.navButtons[i].classList.toggle('is-active', i === idx);
      this.navButtons[i].setAttribute('aria-current', i === idx ? 'true' : 'false');
      this.$ticks[i].className = i < idx ? 'is-done' : i === idx ? 'is-on' : '';
    });
    const p = this.panels[idx];
    const pad = (v) => (v < 10 ? '0' : '') + v;
    this.$idx.textContent = pad(idx + 1) + '/' + pad(n);
    this.$title.textContent = p.title;
    const next = this.panels[idx + 1];
    this.$wayLabel.textContent = next ? 'NEXT' : 'ROUTE';
    this.$way.textContent = next ? next.title : 'COMPLETE';
    this.frame.classList.remove('is-switching');
    void this.frame.offsetWidth; // restart the scan-line flash
    this.frame.classList.add('is-switching');
    const st = this.engine.screenState;
    st.title = p.title;
    st.footer = 'WAYPOINT ' + (idx + 1) + ' / ' + n;
    this.root.setAttribute('data-hud-panel', p.key);
  }

  goTo(i) {
    const p = this.panels[clamp(i, 0, this.panels.length - 1)];
    // panels switch as a unit, so jump: an animated scroll would flick through every panel on the way
    window.scrollTo({ top: Math.ceil(p.start + (i === 0 ? 0 : 2)), behavior: 'instant' });
  }

  /** Keyboard focus landing anywhere in a panel brings that spot onto the glass. */
  _onFocus(e) {
    if (!this.enabled) return;
    const i = this.panels.findIndex((p) => p.el.contains(e.target));
    if (i < 0) return;
    const p = this.panels[i];
    p.el.scrollTop = 0; // the browser may have scrolled the clipped panel itself; we do that with transforms
    const view = p.el.clientHeight;
    const box = e.target.getBoundingClientRect();
    const origin = p.content.getBoundingClientRect().top;
    const top = box.top - origin;
    const bottom = box.bottom - origin;
    const shown = i === this.active ? p.offset : i < this.active ? p.overflow : 0;
    if (i === this.active && top >= shown + 20 && bottom <= shown + view - 20) return;
    const want = clamp(top - view * 0.3, 0, p.overflow);
    window.scrollTo({ top: Math.ceil(p.start + p.lead + want + (i === 0 && want === 0 ? 0 : 1)), behavior: 'instant' });
  }

  /* -------------------------------------------------------------- frame */

  /** Called every rendered frame. */
  frameSync() {
    const e = this.engine;
    if (!this.enabled) return;
    const tr = `${e.hudShift.x.toFixed(1)}px ${e.hudShift.y.toFixed(1)}px`;
    this.frame.style.translate = tr;
    this.cluster.style.translate = tr;
    const p = this.panels[this.active];
    if (p) p.el.style.translate = tr;
    if (e.time - this._textAt > 0.12) {
      this._textAt = e.time;
      const v = String(fmtSpeed(e.car.v));
      if (this.$speed.textContent !== v) {
        this.$speed.textContent = v;
        this.$big.textContent = v;
      }
      const g = 'D' + e.gear;
      if (this.$gear.textContent !== g) this.$gear.textContent = g;
    }
  }

  setEnabled(on) {
    this.enabled = on;
    this.root.classList.toggle('is-gaming', !on);
    // while the game has the screen, the page behind it is out of reach of Tab and screen readers
    document.querySelectorAll('.hud-panel, .ticker, .hud-nav, .view-toggle, .theme-toggle, body > .sr-only').forEach((n) => {
      n.inert = !on;
    });
    if (on) {
      this.lastY = window.scrollY;
      this._apply(true);
    }
  }
}
