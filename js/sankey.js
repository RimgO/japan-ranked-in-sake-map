// Sankey: 主な米 → 仕込み水 → 銘柄 → 日本酒度. One band = one brewery.
(function () {
  const RICE = ['山田錦', '美山錦', 'ひとごこち', '雄町', '五百万石', '地元品種', '記載なし'];
  const RICE_C = ['#3b78c2', '#d98a2b', '#4a9d6f', '#b0589a', '#8a7a3d', '#c2553b', '#a9a59c'];
  const WATER = ['軟水', 'ミネラル分あり', '弱硬水', '水源のみ記載', '記載なし'];
  const SMV = ['甘口(−4以下)', 'やや甘口(−3.9〜−0.1)', '中口(0〜+3)', '辛口(+4以上)', '非公開'];
  const SMV_C = ['#d1495b', '#e08a8f', '#a9a59c', '#2e7fb8', '#cfcac0'];
  const state = {color: 'rice', hover: null};

  const num = (v) => (v == null || v === '' ? null : +v);
  const waterOf = (d) => (d.water_class && d.water_class !== '記載なし' ? d.water_class
    : d.water && d.water !== '記載なし' ? '水源のみ記載' : '記載なし');
  const smvOf = (v) => (v == null ? SMV[4] : v <= -4 ? SMV[0] : v < 0 ? SMV[1] : v <= 3 ? SMV[2] : SMV[3]);
  const fmtSmv = (v) => (v == null ? '非公開' : (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v));

  function rows() {
    const k = dash.data('kura');
    if (k.status !== 'ok') return null;
    return k.data.map((d) => {
      const smv = num(d.smv);
      return {brand: d.brand, kura: d.kura, pref: d.pref, rank: num(d.rank), rice: RICE.includes(d.rice) ? d.rice : '記載なし',
        water: waterOf(d), waterName: d.water, smv, band: smvOf(smv)};
    });
  }

  function layout(data, W) {
    const cols = [
      {key: 'rice', order: RICE},
      {key: 'water', order: WATER},
      {key: 'brand', order: null},
      {key: 'band', order: SMV}
    ];
    // brands ordered so bands cross as little as possible
    const bi = (d) => [WATER.indexOf(d.water), SMV.indexOf(d.band), RICE.indexOf(d.rice), d.smv ?? 99];
    const brands = data.slice().sort((a, b) => {
      const x = bi(a), y = bi(b);
      for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
      return a.rank - b.rank;
    }).map((d) => d.brand);
    cols[2].order = brands;

    const unit = 14, gap = 10, top = 30;
    const labelL = W < 560 ? 92 : 110, labelR = W < 560 ? 112 : 136, nodeW = 10;
    const usable = Math.max(420, W) - labelL - labelR - nodeW;
    const xs = [labelL, labelL + usable * 0.30, labelL + usable * 0.62, labelL + usable];
    const present = cols.map((c) => c.order.filter((name) => data.some((d) => d[c.key] === name)));
    const totals = present.map((p, ci) => data.length * unit + (p.length - 1) * (ci === 2 ? 0 : gap));
    const maxH = Math.max(...totals);
    const nodes = {};
    cols.forEach((c, ci) => {
      let y = top + (maxH - totals[ci]) / 2;
      present[ci].forEach((name) => {
        const n = data.filter((d) => d[c.key] === name).length;
        nodes[ci + ':' + name] = {ci, name, x: xs[ci], y, h: n * unit, n, inUsed: 0, outUsed: 0};
        y += n * unit + (ci === 2 ? 0 : gap);
      });
    });
    // stack links inside nodes: order by the other end's position
    const links = [];
    for (let ci = 0; ci < 3; ci++) {
      const a = cols[ci].key, b = cols[ci + 1].key;
      const items = data.map((d) => ({d, s: nodes[ci + ':' + d[a]], t: nodes[(ci + 1) + ':' + d[b]]}));
      items.slice().sort((p, q) => p.s.y - q.s.y || p.t.y - q.t.y || brands.indexOf(p.d.brand) - brands.indexOf(q.d.brand))
        .forEach((it) => { it.y0 = it.s.y + it.s.outUsed; it.s.outUsed += unit; });
      items.slice().sort((p, q) => p.t.y - q.t.y || p.s.y - q.s.y || brands.indexOf(p.d.brand) - brands.indexOf(q.d.brand))
        .forEach((it) => { it.y1 = it.t.y + it.t.inUsed; it.t.inUsed += unit; });
      items.forEach((it) => links.push({d: it.d, x0: it.s.x + nodeW, x1: it.t.x, y0: it.y0, y1: it.y1, ci}));
    }
    return {nodes: Object.values(nodes), links, unit, nodeW, xs, top, H: top + maxH + 6, W: Math.max(420, W)};
  }

  function bandPath(l, u) {
    const mx = (l.x0 + l.x1) / 2;
    return 'M' + l.x0 + ',' + l.y0 + 'C' + mx + ',' + l.y0 + ' ' + mx + ',' + l.y1 + ' ' + l.x1 + ',' + l.y1 +
      'L' + l.x1 + ',' + (l.y1 + u) + 'C' + mx + ',' + (l.y1 + u) + ' ' + mx + ',' + (l.y0 + u) + ' ' + l.x0 + ',' + (l.y0 + u) + 'Z';
  }

  dash.draw('sankey', (el) => {
    const data = rows();
    el.replaceChildren();
    if (!data) { el.textContent = '—'; return; }
    const L = layout(data, el.clientWidth);
    const color = (d) => (state.color === 'rice' ? RICE_C[RICE.indexOf(d.rice)] : SMV_C[SMV.indexOf(d.band)]);
    const sel = (window.SK && window.SK.sel) || null;
    const focus = state.hover || (sel ? {key: 'brand', name: sel} : null);
    const on = (d) => !focus || d[focus.key] === focus.name;

    const svg = d3.select(el).append('svg').attr('viewBox', '0 0 ' + L.W + ' ' + L.H)
      .attr('width', L.W).attr('height', L.H).attr('role', 'img')
      .attr('aria-label', data.length + ' 蔵を、主な米・仕込み水・銘柄・日本酒度の順に流れでつないだサンキー図');
    ['主な米', '仕込み水', '銘柄', '日本酒度'].forEach((t, i) => {
      svg.append('text').attr('class', 'sk-colhead').attr('x', L.xs[i] + L.nodeW / 2).attr('y', 14)
        .attr('text-anchor', 'middle').text(t);
    });
    const tip = document.createElement('div');
    tip.className = 'sk-tip'; tip.hidden = true; el.append(tip);
    const showTip = (ev, title, lines) => {
      tip.replaceChildren();
      const s = document.createElement('strong'); s.textContent = title; tip.append(s);
      lines.forEach((t) => { const sp = document.createElement('span'); sp.textContent = t; tip.append(sp); });
      tip.hidden = false;
      const box = el.getBoundingClientRect();
      let x = ev.clientX - box.left + el.scrollLeft + 12, y = ev.clientY - box.top + 12;
      if (x + tip.offsetWidth > el.scrollLeft + el.clientWidth) x = ev.clientX - box.left + el.scrollLeft - tip.offsetWidth - 12;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    const hideTip = () => { tip.hidden = true; };
    const setHover = (h) => { state.hover = h; dash.draw('sankey'); };

    svg.append('g').selectAll('path').data(L.links).join('path')
      .attr('class', 'sk-flow').attr('d', (l) => bandPath(l, L.unit - 1))
      .style('fill', (l) => color(l.d)).style('opacity', (l) => (on(l.d) ? (focus ? 0.85 : 0.5) : 0.08))
      .on('pointermove', (ev, l) => showTip(ev, l.d.brand, [l.d.kura + '・' + l.d.pref, '米: ' + l.d.rice,
        '仕込み水: ' + (l.d.water === '記載なし' ? '記載なし' : l.d.waterName), '日本酒度: ' + fmtSmv(l.d.smv)]))
      .on('pointerleave', hideTip)
      .on('click', (ev, l) => window.SK && window.SK.pick && window.SK.pick(l.d.brand));

    const g = svg.append('g');
    L.nodes.forEach((n) => {
      const key = ['rice', 'water', 'brand', 'band'][n.ci];
      const isOn = !focus || (focus.key === key ? focus.name === n.name : data.some((d) => d[key] === n.name && on(d)));
      const r = g.append('rect').attr('class', 'sk-node').attr('x', n.x).attr('y', n.y)
        .attr('width', L.nodeW).attr('height', Math.max(2, n.h - (n.ci === 2 ? 1 : 0)))
        .style('opacity', isOn ? 1 : 0.3);
      if (n.ci === 0) r.style('fill', RICE_C[RICE.indexOf(n.name)]);
      if (n.ci === 3) r.style('fill', SMV_C[SMV.indexOf(n.name)]);
      const right = n.ci === 2 || n.ci === 3;
      const t = g.append('text').attr('class', 'sk-nlab' + (n.ci === 2 ? ' sk-brand' : ''))
        .attr('x', right ? n.x + L.nodeW + 5 : n.x - 5).attr('y', n.y + n.h / 2 + 4)
        .attr('text-anchor', right ? 'start' : 'end').style('opacity', isOn ? 1 : 0.35)
        .text(n.ci === 2 ? n.name : n.name + ' ' + n.n);
      if (n.ci === 2 && sel === n.name) t.style('font-weight', 700);
      // hit area for the whole node + label
      g.append('rect').attr('class', 'sk-hit')
        .attr('x', right ? n.x : n.x - (n.ci === 0 ? 92 : 110)).attr('y', n.y)
        .attr('width', L.nodeW + (n.ci === 2 ? 120 : n.ci === 3 ? 130 : n.ci === 0 ? 92 : 110)).attr('height', Math.max(8, n.h))
        .on('pointerenter', () => { if (n.ci !== 2) setHover({key, name: n.name}); })
        .on('pointermove', (ev) => {
          if (n.ci === 2) {
            const d = data.find((x) => x.brand === n.name);
            showTip(ev, d.brand, [d.kura + '・' + d.pref, '米: ' + d.rice, '日本酒度: ' + fmtSmv(d.smv)]);
          } else {
            showTip(ev, n.name, [n.n + ' 蔵']);
          }
        })
        .on('pointerleave', () => { hideTip(); if (n.ci !== 2 && state.hover) setHover(null); })
        .on('click', () => {
          if (n.ci === 2) { window.SK && window.SK.pick && window.SK.pick(n.name); return; }
          setHover(state.hover && state.hover.name === n.name ? null : {key, name: n.name});
        });
    });

    const lg = document.createElement('div');
    lg.className = 'sk-legend';
    const names = state.color === 'rice' ? RICE.filter((r) => data.some((d) => d.rice === r)) : SMV;
    names.forEach((name) => {
      const c = document.createElement('span'); c.className = 'sk-chip';
      const sw = document.createElement('span'); sw.className = 'sk-sw';
      sw.style.background = state.color === 'rice' ? RICE_C[RICE.indexOf(name)] : SMV_C[SMV.indexOf(name)];
      const tx = document.createElement('span'); tx.textContent = name;
      c.append(sw, tx); lg.append(c);
    });
    el.append(lg);
  });

  document.querySelectorAll('#sk-sankey-color').forEach((s) => {
    s.addEventListener('change', () => { state.color = s.value; dash.draw('sankey'); });
  });
})();
