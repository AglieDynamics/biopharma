'use strict';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const scrollBehavior = () => (reducedMotion.matches ? 'auto' : 'smooth');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ---------- Mobile menu ---------- */
function initMenu() {
  const toggle = document.getElementById('menu-toggle');
  const nav = document.getElementById('site-nav');
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}

/* ---------- Current section in the nav ---------- */
function initScrollSpy() {
  const links = new Map(
    [...document.querySelectorAll('.site-nav a[href^="#"]:not(.nav-cta)')]
      .map((link) => [link.getAttribute('href').slice(1), link]),
  );
  // Watch every section so ones without a nav link (hero, thesis, ...) clear the highlight.
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link, id) => {
        if (id === entry.target.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main > section').forEach((section) => observer.observe(section));
}

/* ---------- Tabs (WAI-ARIA tabs pattern, automatic activation) ---------- */
function initTabs() {
  const steps = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  document.querySelectorAll('[data-tabs]').forEach((root) => {
    const tabs = [...root.querySelectorAll(':scope > .tab-list > [role="tab"]')];
    const select = (tab) => {
      tabs.forEach((candidate) => {
        const selected = candidate === tab;
        candidate.setAttribute('aria-selected', String(selected));
        candidate.tabIndex = selected ? 0 : -1;
        document.getElementById(candidate.getAttribute('aria-controls')).classList.toggle('is-selected', selected);
      });
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (event) => {
        let next;
        if (event.key in steps) next = tabs[(index + steps[event.key] + tabs.length) % tabs.length];
        else if (event.key === 'Home') [next] = tabs;
        else if (event.key === 'End') next = tabs[tabs.length - 1];
        if (!next) return;
        event.preventDefault();
        select(next);
        next.focus();
      });
    });
  });
}

/* ---------- Bar charts, drawn from the data table that ships with each one ---------- */
function createBarChart(figure) {
  const table = document.getElementById(figure.dataset.source);
  const rows = [...table.tBodies[0].rows];
  const max = Number(figure.dataset.max);
  const unit = figure.dataset.unit;
  const ticks = figure.dataset.ticks.split(',');
  const series = figure.dataset.series ? figure.dataset.series.split(',') : [null];
  const position = (value) => `${(Math.min(value / max, 1) * 100).toFixed(3)}%`;

  const plot = figure.querySelector('.viz-plot');
  plot.textContent = '';
  plot.dataset.seriesCount = String(series.length);

  const grid = el('div', 'viz-grid');
  grid.style.gridRow = `1 / span ${rows.length}`;
  ticks.forEach((tick) => {
    const line = el('span', 'viz-gridline');
    line.style.left = position(Number(tick));
    grid.append(line);
  });
  plot.append(grid);

  const marks = [];
  rows.forEach((row, index) => {
    const highlighted = row.dataset.key === figure.dataset.highlight;
    const label = el('span', 'viz-label', row.cells[0].textContent.trim());
    const area = el('div', 'viz-area');
    label.style.gridRow = String(index + 1);
    area.style.gridRow = String(index + 1);
    label.classList.toggle('is-highlight', highlighted);
    area.classList.toggle('is-highlight', highlighted);
    series.forEach((name) => {
      const line = el('div', 'viz-line');
      if (name) line.dataset.series = name;
      const bar = el('span', 'viz-bar');
      const track = el('span', 'viz-value-track');
      const value = el('span', 'viz-value');
      track.append(value);
      line.append(bar, track);
      area.append(line);
      marks.push({ row, name, bar, track, value });
    });
    plot.append(label, area);
  });

  const axis = el('div', 'viz-axis');
  axis.style.gridRow = String(rows.length + 1);
  ticks.forEach((tick, index) => {
    // The unit rides on the last tick only, so narrow axes stay legible.
    const label = el('span', 'viz-tick', index === ticks.length - 1 ? `${tick}${unit}` : tick);
    label.style.left = position(Number(tick));
    axis.append(label);
  });
  plot.append(axis);

  return (scenario) => {
    marks.forEach(({ row, name, bar, track, value }) => {
      const cell = [...row.cells].find((candidate) => candidate.tagName === 'TD'
        && (!scenario || candidate.dataset.scenario === scenario)
        && (!name || candidate.dataset.series === name));
      const text = cell.textContent.trim();
      const offset = position(Number(cell.dataset.value));
      // Values below the table's precision ("<0.5") get a 2px trace so the row never reads as empty.
      bar.style.width = text.startsWith('<') ? '2px' : offset;
      track.style.transform = `translateX(${offset})`;
      value.textContent = `${text}${unit}`;
    });
  };
}

function initCharts() {
  const filter = document.getElementById('scenario-filter');
  const selectedScenario = () => filter.querySelector('input:checked').value;
  const charts = [...document.querySelectorAll('.viz')].map((figure) => ({
    scoped: figure.dataset.filter === 'scenario',
    update: createBarChart(figure),
  }));
  charts.forEach(({ scoped, update }) => update(scoped ? selectedScenario() : null));
  filter.addEventListener('change', () => {
    charts.filter(({ scoped }) => scoped).forEach(({ update }) => update(selectedScenario()));
  });
}

/* ---------- Carousel buttons ---------- */
function initCarousels() {
  document.querySelectorAll('.carousel').forEach((track) => {
    const prev = document.querySelector(`[data-carousel-prev="${track.id}"]`);
    const next = document.querySelector(`[data-carousel-next="${track.id}"]`);
    // A couple of pixels of tolerance absorbs sub-pixel snap positions.
    const sync = () => {
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    };
    const move = (direction) => track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: scrollBehavior() });
    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  });
}

/* ---------- Count-up figures (first view only) ---------- */
function initCounters() {
  if (reducedMotion.matches) return;
  const counters = document.querySelectorAll('.count[data-count-to]');
  const format = (value, decimals) => value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const animate = (counter) => {
    const target = Number(counter.dataset.countTo);
    const decimals = Number(counter.dataset.decimals);
    const start = performance.now();
    const duration = 600;
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      counter.textContent = format(target * (1 - (1 - progress) ** 3), decimals);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(({ isIntersecting, target }) => {
      if (!isIntersecting) return;
      observer.unobserve(target);
      animate(target);
    });
  }, { threshold: 0.6 });
  counters.forEach((counter) => {
    counter.textContent = format(0, Number(counter.dataset.decimals));
    observer.observe(counter);
  });
}

/* ---------- FAQ topic filter ---------- */
function initFaqFilter() {
  const filter = document.getElementById('faq-filter');
  const items = document.querySelectorAll('.faq-item');
  filter.addEventListener('change', () => {
    const topic = filter.querySelector('input:checked').value;
    items.forEach((item) => {
      item.hidden = topic !== 'all' && item.dataset.topic !== topic;
    });
  });
}

/* ---------- Header shadow and scroll-progress dial ---------- */
function initScrollUi() {
  const header = document.getElementById('site-header');
  const dial = document.getElementById('scroll-dial');
  const progress = document.getElementById('dial-progress');
  const sections = [...document.querySelectorAll('main > section')];
  const circumference = 2 * Math.PI * progress.r.baseVal.value;
  progress.style.strokeDasharray = String(circumference);

  const nextSection = () => {
    const offset = header.getBoundingClientRect().bottom + 8;
    return sections.find((section) => section.getBoundingClientRect().top > offset);
  };

  let frame = 0;
  const render = () => {
    frame = 0;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? Math.min(window.scrollY / scrollable, 1) : 1;
    progress.style.strokeDashoffset = String(circumference * (1 - ratio));
    header.classList.toggle('is-scrolled', window.scrollY > 8);
    const atEnd = !nextSection();
    dial.classList.toggle('is-end', atEnd);
    dial.setAttribute('aria-label', atEnd ? 'Back to top' : 'Next section');
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  dial.addEventListener('click', () => {
    const target = nextSection();
    if (target) target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    else window.scrollTo({ top: 0, behavior: scrollBehavior() });
  });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  render();
}

initMenu();
initScrollSpy();
initTabs();
initCharts();
initCarousels();
initCounters();
initFaqFilter();
initScrollUi();
