

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var sliders = new Map();


  var SLIDER_DEFAULTS = {
    cellAlign: 'left',
    contain: true,
    pageDots: false,
    prevNextButtons: false,
    imagesLoaded: true,
    pauseAutoPlayOnHover: true,
    accessibility: true
  };

  function readOptions(el) {
    var raw = el.getAttribute('data-cs-slider');
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.warn('[cs] bad slider options', el, err);
      return {};
    }
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function initSlider(el) {
    if (sliders.has(el) || typeof window.Flickity !== 'function') return;

    var options = Object.assign({}, SLIDER_DEFAULTS, readOptions(el));
    if (reduceMotion || window.Shopify && window.Shopify.designMode) options.autoPlay = false;

    var flkty = new window.Flickity(el, options);
    sliders.set(el, flkty);

    var wrap = el.closest('[data-cs-slider-wrap]');
    if (wrap) bindControls(wrap, flkty, options);
    if (el.hasAttribute('data-cs-parallax') && !reduceMotion) bindParallax(flkty);
    if (el.querySelector('.cs-cell')) equaliseHeights(el, flkty);
  }

  // cells are absolutely positioned by Flickity, so stretch them to the tallest one after measuring
  function equaliseHeights(el, flkty) {
    var timer = null;

    function run() {
      if (sliders.get(el) !== flkty) return; // destroyed in the theme editor
      el.classList.remove('is-equal');
      flkty.resize();
      el.classList.add('is-equal');
    }

    run();
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(run, 200);
    });
    // late-loading images / fonts can change heights
    window.addEventListener('load', run, { once: true });
  }

  // shifts each cell's [data-cs-parallax-layer] against its distance from the viewport centre
  function bindParallax(flkty) {
    var cells = flkty.cells.map(function (cell) {
      return {
        el: cell.element,
        layer: cell.element.querySelector('[data-cs-parallax-layer]')
      };
    });

    function update() {
      var box = flkty.viewport.getBoundingClientRect();
      var centre = box.left + box.width / 2;
      cells.forEach(function (cell) {
        if (!cell.layer) return;
        var rect = cell.el.getBoundingClientRect();
        var offset = rect.left + rect.width / 2 - centre;
        cell.layer.style.transform = 'translate3d(' + (offset * -0.12).toFixed(1) + 'px, 0, 0)';
      });
    }

    flkty.on('scroll', update);
    update();
  }

  function bindControls(wrap, flkty, options) {
    var prev = wrap.querySelector('[data-cs-prev]');
    var next = wrap.querySelector('[data-cs-next]');
    var bar = wrap.querySelector('[data-cs-progress]');
    var current = wrap.querySelector('[data-cs-current]');
    var total = wrap.querySelector('[data-cs-total]');
    var tabs = wrap.querySelectorAll('[data-cs-goto]');

    if (prev) prev.addEventListener('click', function () { flkty.previous(); });
    if (next) next.addEventListener('click', function () { flkty.next(); });

    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () {
        flkty.select(parseInt(tab.getAttribute('data-cs-goto'), 10) || 0);
      });
    });

    if (bar) {
      flkty.on('scroll', function (progress) {
        var p = Math.max(0, Math.min(1, progress));
        bar.style.transform = 'scaleX(' + (p || 0.02) + ')';
      });
    }

    function sync() {
      // watchCSS sliders are not active on every breakpoint
      if (!flkty.slides || !flkty.slides.length) return;

      var index = flkty.selectedIndex;
      var count = flkty.slides.length;

      if (current) current.textContent = pad(index + 1);
      if (total) total.textContent = pad(count);

      if (!options.wrapAround) {
        if (prev) prev.disabled = index === 0;
        if (next) next.disabled = index === count - 1;
      }

      Array.prototype.forEach.call(tabs, function (tab) {
        var active = parseInt(tab.getAttribute('data-cs-goto'), 10) === index;
        tab.classList.toggle('is-active', active);
        tab.setAttribute(tab.getAttribute('role') === 'tab' ? 'aria-selected' : 'aria-current', active ? 'true' : 'false');
      });

      wrap.classList.remove('is-ticking');
      // restart css autoplay timers (hero tabs)
      void wrap.offsetWidth;
      wrap.classList.add('is-ticking');
    }

    flkty.on('change', sync);
    flkty.on('ready', sync);
    sync();

    if (bar) bar.style.transform = 'scaleX(' + (flkty.slides && flkty.slides.length ? 1 / flkty.slides.length : 0) + ')';
  }

  function destroySlider(el) {
    var flkty = sliders.get(el);
    if (!flkty) return;
    flkty.destroy();
    sliders.delete(el);
  }

  /* ---------------------------------------------------------------------- */
  /* Count-up numbers                       */
  /* ---------------------------------------------------------------------- */

  var NUMBER_PATTERN = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/;

  function countUp(el) {
    if (el.hasAttribute('data-cs-counted')) return;
    el.setAttribute('data-cs-counted', '');

    var original = el.textContent.trim();
    var match = original.match(NUMBER_PATTERN);
    if (!match || reduceMotion) return;

    var prefix = match[1];
    var raw = match[2];
    var suffix = match[3];
    var target = parseFloat(raw.replace(/,/g, ''));
    var decimals = raw.indexOf('.') > -1 ? raw.split('.')[1].length : 0;
    var grouped = raw.indexOf(',') > -1;
    var duration = Math.min(2200, 900 + String(Math.round(target)).length * 160);
    var start = null;

    if (!target) return;

    function format(value) {
      return grouped
        ? value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : value.toFixed(decimals);
    }

    function frame(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = prefix + format(target * eased) + suffix;
      if (t < 1) {
        window.requestAnimationFrame(frame);
      } else {
        el.textContent = original;
      }
    }

    el.textContent = prefix + format(0) + suffix;
    window.requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------------- */
  /* Scroll reveal                                                           */
  /* ---------------------------------------------------------------------- */

  var observer = null;

  function reveal(el) {
    el.classList.add('is-in');
    Array.prototype.forEach.call(el.querySelectorAll('[data-cs-count]'), countUp);
    if (el.hasAttribute('data-cs-count')) countUp(el);
  }

  function watchReveal(scope) {
    var items = scope.querySelectorAll('[data-cs-reveal], [data-cs-count]');

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(items, reveal);
      return;
    }

    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          reveal(entry.target);
          observer.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    }

    Array.prototype.forEach.call(items, function (item) {
      observer.observe(item);
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Tabs                                                                    */
  /* ---------------------------------------------------------------------- */

  function initTabs(root) {
    if (root.hasAttribute('data-cs-tabs-ready')) return;
    root.setAttribute('data-cs-tabs-ready', '');

    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));

    function activate(tab, focus) {
      tabs.forEach(function (t) {
        var selected = t === tab;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        t.setAttribute('aria-selected', selected ? 'true' : 'false');
        t.setAttribute('tabindex', selected ? '0' : '-1');
        if (panel) panel.hidden = !selected;
      });
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { activate(tab); });
      tab.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var step = e.key === 'ArrowRight' ? 1 : -1;
        activate(tabs[(i + step + tabs.length) % tabs.length], true);
      });
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Boot                                                                    */
  /* ---------------------------------------------------------------------- */

  function init(scope) {
    scope = scope || document;
    Array.prototype.forEach.call(scope.querySelectorAll('[data-cs-slider]'), initSlider);
    Array.prototype.forEach.call(scope.querySelectorAll('[data-cs-tabs]'), initTabs);
    watchReveal(scope);
  }

  function teardown(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('[data-cs-slider]'), destroySlider);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-cs-scroll-top]');
    if (!btn) return;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });
  
  document.documentElement.classList.add('cs-js');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }

  /* theme editor */
  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
  document.addEventListener('shopify:section:unload', function (e) { teardown(e.target); });

  document.addEventListener('shopify:block:select', function (e) {
    var cell = e.target.closest('[data-cs-index]');
    var slider = e.target.closest('[data-cs-slider]');
    if (!cell || !slider || !sliders.has(slider)) return;
    var flkty = sliders.get(slider);
    flkty.pausePlayer && flkty.pausePlayer();
    flkty.select(parseInt(cell.getAttribute('data-cs-index'), 10) || 0, false, true);
  });

  window.CS = window.CS || {};
  window.CS.init = init;
  window.CS.sliders = sliders;
})();
