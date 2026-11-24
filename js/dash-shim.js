// Minimal stand-in for the dashboard runtime, so js/app.js runs as a plain static page.
(function () {
  const sources = {
    kura: window.SAKE_KURA || [],
    japan: window.JP_OUTLINE || {rings: []}
  };
  const calcs = {};
  const draws = {};

  function run(name) {
    const fn = draws[name];
    if (!fn) return;
    document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
      try { fn(el); } catch (e) { console.error('draw ' + name + ' failed', e); }
    });
  }

  window.dash = {
    colors: ['#3b78c2', '#d98a2b', '#4a9d6f', '#b0589a', '#8a7a3d', '#c2553b'],
    data(id) {
      if (id in sources) return {status: 'ok', data: sources[id]};
      const c = calcs[id];
      if (c) return {status: 'ok', data: c.fn(...c.inputs.map((i) => sources[i]))};
      return {status: 'missing', data: []};
    },
    calc(id, opts) { calcs[id] = opts; },
    draw(name, fn) {
      if (fn) { draws[name] = fn; return; }
      run(name);
    },
    onData() {},
    _runAll() { Object.keys(draws).forEach(run); }
  };

  let lastW = 0, timer = null;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const w = document.documentElement.clientWidth;
      if (w === lastW) return;
      lastW = w;
      ['map', 'scatter', 'strip'].forEach(run);
    }, 150);
  });
  document.addEventListener('DOMContentLoaded', () => {
    lastW = document.documentElement.clientWidth;
    window.dash._runAll();
  });
})();
