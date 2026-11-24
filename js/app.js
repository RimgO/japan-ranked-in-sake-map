(function () {
  const SK = (window.SK = {sel: null, mode: 'score'});
  const FALL = ['#3b78c2', '#d98a2b', '#4a9d6f', '#b0589a', '#8a7a3d', '#c2553b'];
  const col = (i) => (dash.colors && dash.colors[i]) || FALL[i % FALL.length];
  const SWEET = '#d1495b', DRY = '#2e7fb8', MID = '#a9a59c';
  const RICE = ['山田錦', '美山錦', 'ひとごこち', '雄町', '五百万石', '地元品種', '記載なし'];
  const WATER = {'軟水': '#3aa0c9', 'ミネラル分あり': '#c98a2b', '弱硬水': '#a0522d'};
  const TASTE = {'甘口寄り': SWEET, 'どちらとも': MID, '辛口寄り': DRY};
  const smvScale = d3.scaleLinear().domain([-8, 0, 8]).range([SWEET, MID, DRY]).clamp(true);
  const num = (v) => (v == null || v === '' ? null : +v);
  const fmtSmv = (v) => (v == null ? '非公開' : (v > 0 ? '+' : v < 0 ? '-' : '±') + Math.abs(v));
  const fmtAcid = (v) => (v == null ? '非公開' : v.toFixed(1));
  const norm = (d) => Object.assign({}, d, {
    lat: num(d.lat), lon: num(d.lon), score: num(d.score), reviews: num(d.reviews),
    rank: num(d.rank), smv: num(d.smv), acid: num(d.acid)
  });
  const riceColor = (r) => { const i = RICE.indexOf(r); return i < 0 || r === '記載なし' ? null : col(i); };
  const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//.test(u) ? u : null);

  function ready(el) {
    const k = dash.data('kura');
    if (k.status === 'ok') return k.data.map(norm);
    el.replaceChildren();
    el.textContent = k.status === 'error' ? 'データを読み込めませんでした。' : '—';
    return null;
  }
  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function pick(brand) {
    SK.sel = SK.sel === brand ? null : brand;
    ['map', 'scatter', 'strip', 'detail', 'sankey'].forEach((n) => dash.draw(n));
  }
  SK.pick = pick;
  function chip(parent, color, label, hollow) {
    const c = h('span', 'sk-chip');
    const sw = h('span', 'sk-sw' + (hollow ? ' sk-hol' : ''));
    if (!hollow) sw.style.background = color;
    c.append(sw, h('span', null, label));
    parent.append(c);
  }
  function tipFor(el) {
    const tip = h('div', 'sk-tip');
    tip.hidden = true;
    el.append(tip);
    return {
      show(d, x, y, lines) {
        tip.replaceChildren(h('strong', null, d.brand), ...lines.map((t) => h('span', null, t)));
        tip.hidden = false;
        const w = tip.offsetWidth, hh = tip.offsetHeight, W = el.clientWidth;
        let lx = x + 12, ly = y - hh - 10;
        if (lx + w > W) lx = Math.max(0, x - w - 12);
        if (ly < 0) ly = y + 14;
        tip.style.left = lx + 'px';
        tip.style.top = ly + 'px';
      },
      hide() { tip.hidden = true; }
    };
  }
  // greedy label placement: returns the subset of labels that do not collide
  function placeLabels(items, W) {
    const boxes = [], out = [];
    items.forEach((it) => {
      const w = it.text.length * 11 + 4;
      let x = it.x + it.r + 3, anchor = 'start';
      if (x + w > W) { x = it.x - it.r - 3; anchor = 'end'; }
      const bx = anchor === 'start' ? x : x - w;
      const b = [bx, it.y - 7, bx + w, it.y + 7];
      if (bx < 0) return;
      if (!it.force && boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) return;
      boxes.push(b);
      out.push({x, y: it.y + 4, anchor, text: it.text});
    });
    return out;
  }
  function drawLabels(svg, labels) {
    svg.append('g').selectAll('text').data(labels).join('text')
      .attr('class', 'sk-lab').attr('x', (d) => d.x).attr('y', (d) => d.y)
      .attr('text-anchor', (d) => d.anchor).text((d) => d.text).style('pointer-events', 'none');
  }

  dash.calc('summary', {
    title: '蔵の集計',
    description: '蔵の数、最多の県、日本酒度の中央値、甘口寄りの蔵数、仕込み水の記載数を数えたもの。',
    inputs: ['kura'],
    fn: (kura) => {
      const rows = (kura || []).map(norm);
      const smv = rows.filter((d) => d.smv != null).map((d) => d.smv);
      const byPref = d3.rollups(rows, (v) => v.length, (d) => d.pref).sort((a, b) => b[1] - a[1]);
      return [{
        n: rows.length,
        topPref: byPref.length ? byPref[0][0] : null,
        topPrefN: byPref.length ? byPref[0][1] : null,
        nSmv: smv.length,
        medSmv: smv.length ? d3.median(smv) : null,
        nSweetSmv: smv.filter((v) => v < 0).length,
        nSweetTaste: rows.filter((d) => d.taste === '甘口寄り').length,
        nWater: rows.filter((d) => d.water && d.water !== '記載なし').length,
        nWaterClass: rows.filter((d) => d.water_class && d.water_class !== '記載なし').length,
        nSoft: rows.filter((d) => d.water_class === '軟水').length
      }];
    }
  });

  dash.draw('fig', (el) => {
    const s = dash.data('summary');
    const row = s.status === 'ok' && s.data && s.data[0];
    const f = el.dataset.field;
    const v = row ? row[f] : null;
    el.textContent = v == null ? '—' : f === 'medSmv' ? fmtSmv(v) : String(v);
  });

  function enc(d, mode, rs) {
    if (mode === 'taste') return {fill: TASTE[d.taste] || MID, r: 6.5};
    if (mode === 'smv') return d.smv == null ? {hollow: true, r: 4.5} : {fill: smvScale(d.smv), r: 6.5};
    if (mode === 'rice') { const c = riceColor(d.rice); return c ? {fill: c, r: 6.5} : {hollow: true, r: 4.5}; }
    if (mode === 'water') return WATER[d.water_class] ? {fill: WATER[d.water_class], r: 7} : {hollow: true, r: 4.5};
    return {fill: col(0), r: rs(d.score)};
  }
  function valueLine(d, mode) {
    if (mode === 'taste') return '味の傾向: ' + d.taste;
    if (mode === 'smv') return '日本酒度: ' + fmtSmv(d.smv) + (d.product ? '(' + d.product + ')' : '');
    if (mode === 'rice') return '米: ' + d.rice;
    if (mode === 'water') return '仕込み水: ' + d.water_class;
    return '評価 ' + d.score.toFixed(2) + '(' + d.reviews + '件)';
  }

  dash.draw('map', (el) => {
    const data = ready(el);
    if (!data) return;
    el.replaceChildren();
    const mode = SK.mode;
    const W = Math.max(260, el.clientWidth), pad = 8;
    const my = (l) => Math.log(Math.tan(Math.PI / 4 + (l * Math.PI) / 360));
    const lon0 = 128.8, lon1 = 146, y0 = my(30.7), y1 = my(45.7);
    const s = (W - 2 * pad) / (((lon1 - lon0) * Math.PI) / 180);
    const H = Math.round((y1 - y0) * s + 2 * pad);
    const P = (lon, lat) => [pad + (((lon - lon0) * Math.PI) / 180) * s, pad + (y1 - my(lat)) * s];
    const svg = d3.select(el).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H).attr('width', '100%')
      .attr('role', 'img').attr('aria-label', '評価の高い日本酒の蔵 ' + data.length + ' か所を日本地図に置いた図');
    const land = svg.append('g');
    const jp = dash.data('japan');
    const raw = jp.status === 'ok' ? jp.data : null;
    const geo = Array.isArray(raw) ? raw : (raw && raw.rings) || [];
    geo.forEach((r) => {
      let p = '';
      for (let i = 0; i < r.length; i += 2) {
        const q = P(r[i] / 100, r[i + 1] / 100);
        p += (i ? 'L' : 'M') + q[0].toFixed(1) + ',' + q[1].toFixed(1);
      }
      land.append('path').attr('class', 'sk-land').attr('d', p + 'Z');
    });
    const ext = d3.extent(data, (d) => d.score);
    const rs = d3.scaleSqrt().domain(ext).range([4, 11]);
    const pts = data.map((d) => { const q = P(d.lon, d.lat); return {d, x: q[0], y: q[1], e: enc(d, mode, rs)}; })
      .sort((a, b) => (a.e.hollow ? 0 : 1) - (b.e.hollow ? 0 : 1) || a.d.score - b.d.score);
    const tip = tipFor(el);
    const g = svg.append('g');
    pts.forEach((p) => {
      if (p.d.kura === '大木代吉本店') g.append('circle').attr('class', 'sk-ring').attr('cx', p.x).attr('cy', p.y).attr('r', p.e.r + 5);
      const c = g.append('circle').attr('cx', p.x).attr('cy', p.y).attr('r', p.e.r)
        .attr('class', 'sk-dot' + (p.e.hollow ? ' sk-hollow' : '') + (SK.sel === p.d.brand ? ' sk-on' : ''));
      if (!p.e.hollow) c.style('fill', p.e.fill);
    });
    g.selectAll('circle.sk-hit').data(pts).join('circle').attr('class', 'sk-hit')
      .attr('cx', (p) => p.x).attr('cy', (p) => p.y).attr('r', 13)
      .on('pointerenter pointermove', (ev, p) => tip.show(p.d, (p.x / W) * el.clientWidth, (p.y / W) * el.clientWidth, [p.d.kura + '・' + p.d.pref + p.d.city, valueLine(p.d, mode)]))
      .on('pointerleave', () => tip.hide())
      .on('click', (ev, p) => pick(p.d.brand));
    const top = pts.slice().sort((a, b) => (SK.sel === b.d.brand) - (SK.sel === a.d.brand) || a.d.rank - b.d.rank)
      .filter((p, i) => i < (W < 480 ? 9 : 16) || SK.sel === p.d.brand)
      .map((p) => ({x: p.x, y: p.y, r: p.e.r, text: p.d.brand, force: SK.sel === p.d.brand}));
    drawLabels(svg, placeLabels(top, W));

    const lg = h('div', 'sk-legend');
    if (mode === 'score') {
      lg.append(h('span', null, '円が大きいほど評価点が高い(' + ext[0].toFixed(2) + '〜' + ext[1].toFixed(2) + ')'));
    } else if (mode === 'smv') {
      const bar = h('span', 'sk-bar');
      bar.style.background = 'linear-gradient(90deg,' + SWEET + ',' + MID + ',' + DRY + ')';
      lg.append(h('span', null, '甘口 -8'), bar, h('span', null, '+8 辛口'));
      chip(lg, null, '非公開・記載なし(' + data.filter((d) => d.smv == null).length + ')', true);
    } else {
      const key = mode === 'taste' ? 'taste' : mode === 'rice' ? 'rice' : 'water_class';
      const order = mode === 'taste' ? Object.keys(TASTE) : mode === 'rice' ? RICE : ['軟水', 'ミネラル分あり', '弱硬水', '記載なし'];
      order.forEach((name, i) => {
        const n = data.filter((d) => d[key] === name).length;
        if (!n) return;
        const c = mode === 'taste' ? TASTE[name] : mode === 'rice' ? riceColor(name) : WATER[name];
        chip(lg, c, name + '(' + n + ')', !c);
      });
    }
    el.append(lg);
  });

  dash.draw('detail', (el) => {
    const k = dash.data('kura');
    el.replaceChildren();
    if (k.status !== 'ok' || !SK.sel) return;
    const d = k.data.map(norm).find((r) => r.brand === SK.sel);
    if (!d) return;
    el.append(h('h3', null, d.brand), h('div', 'sk-sub', d.kura + '・' + d.pref + d.city + ' / 総合 ' + d.rank + '位・評価 ' + d.score.toFixed(2) + '(' + d.reviews + '件)'));
    const dl = h('dl', 'sk-dl');
    const add = (t, v) => dl.append(h('dt', null, t), h('dd', null, v));
    add('代表商品', d.product || '数値の記載なし');
    add('日本酒度', fmtSmv(d.smv));
    add('酸度', fmtAcid(d.acid));
    add('味の傾向', d.taste);
    add('米', d.rice_note || d.rice);
    add('仕込み水', d.water + (d.water_class !== '記載なし' ? '(' + d.water_class + ')' : ''));
    el.append(dl);
    const u = safeUrl(d.url);
    if (u) {
      const p = h('p', 'sk-note');
      const a = h('a', null, 'SAKETIMEの銘柄ページ');
      a.href = u; a.target = '_blank'; a.rel = 'noopener';
      p.append(a);
      el.append(p);
    }
  });

  dash.draw('scatter', (el) => {
    const all = ready(el);
    if (!all) return;
    el.replaceChildren();
    const data = all.filter((d) => d.smv != null && d.acid != null);
    const W = Math.max(260, el.clientWidth), H = Math.round(Math.min(440, Math.max(300, W * 0.78)));
    const m = {t: 20, r: 16, b: 46, l: 38};
    const xe = d3.extent(data, (d) => d.smv), ye = d3.extent(data, (d) => d.acid);
    const x = d3.scaleLinear().domain([Math.min(-8, xe[0] - 1), Math.max(8, xe[1] + 1)]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([Math.min(1.1, ye[0] - 0.1), Math.max(2, ye[1] + 0.1)]).range([H - m.b, m.t]);
    const svg = d3.select(el).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H).attr('width', '100%')
      .attr('role', 'img').attr('aria-label', data.length + ' 蔵の代表商品を日本酒度と酸度で置いた散布図');
    const xt = x.ticks(W < 420 ? 6 : 10), yt = y.ticks(5);
    svg.append('g').selectAll('line').data(yt).join('line').attr('class', 'sk-grid')
      .attr('x1', m.l).attr('x2', W - m.r).attr('y1', (v) => y(v)).attr('y2', (v) => y(v));
    svg.append('line').attr('class', 'sk-ref').attr('x1', x(0)).attr('x2', x(0)).attr('y1', m.t).attr('y2', H - m.b);
    svg.append('g').selectAll('text').data(xt).join('text').attr('x', (v) => x(v)).attr('y', H - m.b + 16)
      .attr('text-anchor', 'middle').text((v) => (v > 0 ? '+' + v : v));
    svg.append('g').selectAll('text').data(yt).join('text').attr('x', m.l - 6).attr('y', (v) => y(v) + 4)
      .attr('text-anchor', 'end').text((v) => v.toFixed(1));
    svg.append('text').attr('x', m.l).attr('y', H - 8).text('← 甘口(日本酒度)');
    svg.append('text').attr('x', W - m.r).attr('y', H - 8).attr('text-anchor', 'end').text('辛口 →');
    svg.append('text').attr('x', m.l - 30).attr('y', 12).text('酸度');
    [['甘口・酸高め', m.l + 6, m.t + 12, 'start'], ['辛口・酸高め', W - m.r - 6, m.t + 12, 'end'],
     ['甘口・酸低め', m.l + 6, H - m.b - 8, 'start'], ['辛口・酸低め', W - m.r - 6, H - m.b - 8, 'end']]
      .forEach((c) => svg.append('text').attr('class', 'sk-corner').attr('x', c[1]).attr('y', c[2]).attr('text-anchor', c[3]).text(c[0]));
    const tip = tipFor(el);
    const pts = data.map((d) => ({d, x: x(d.smv), y: y(d.acid)}));
    const g = svg.append('g');
    pts.forEach((p) => {
      const c = riceColor(p.d.rice);
      const dot = g.append('circle').attr('cx', p.x).attr('cy', p.y).attr('r', 6)
        .attr('class', 'sk-dot' + (c ? '' : ' sk-hollow') + (SK.sel === p.d.brand ? ' sk-on' : ''));
      if (c) dot.style('fill', c);
    });
    g.selectAll('circle.sk-hit').data(pts).join('circle').attr('class', 'sk-hit')
      .attr('cx', (p) => p.x).attr('cy', (p) => p.y).attr('r', 12)
      .on('pointerenter pointermove', (ev, p) => tip.show(p.d, (p.x / W) * el.clientWidth, (p.y / W) * el.clientWidth,
        [p.d.product, '日本酒度 ' + fmtSmv(p.d.smv) + '・酸度 ' + fmtAcid(p.d.acid), '米: ' + p.d.rice]))
      .on('pointerleave', () => tip.hide())
      .on('click', (ev, p) => pick(p.d.brand));
    const labs = pts.slice().sort((a, b) => (SK.sel === b.d.brand) - (SK.sel === a.d.brand) || a.d.rank - b.d.rank)
      .map((p) => ({x: p.x, y: p.y, r: 6, text: p.d.brand, force: SK.sel === p.d.brand}));
    drawLabels(svg, placeLabels(labs, W));
    const lg = h('div', 'sk-legend');
    RICE.forEach((name) => {
      const n = data.filter((d) => d.rice === name).length;
      if (n) chip(lg, riceColor(name), name + '(' + n + ')', !riceColor(name));
    });
    el.append(lg);
  });

  dash.draw('strip', (el) => {
    const all = ready(el);
    if (!all) return;
    el.replaceChildren();
    const data = all.filter((d) => d.smv != null);
    const groups = d3.groups(data, (d) => d.rice).map(([name, rows]) => ({name, rows, med: d3.median(rows, (d) => d.smv)}))
      .sort((a, b) => a.med - b.med);
    const W = Math.max(260, el.clientWidth), rowH = 46, m = {t: 8, r: 16, b: 40, l: 96};
    const H = m.t + m.b + rowH * groups.length;
    const xe = d3.extent(data, (d) => d.smv);
    const x = d3.scaleLinear().domain([Math.min(-8, xe[0] - 1), Math.max(8, xe[1] + 1)]).range([m.l, W - m.r]);
    const svg = d3.select(el).append('svg').attr('viewBox', '0 0 ' + W + ' ' + H).attr('width', '100%')
      .attr('role', 'img').attr('aria-label', '米の種類ごとに ' + data.length + ' 蔵の日本酒度を並べた図');
    const xt = x.ticks(W < 420 ? 5 : 9);
    svg.append('g').selectAll('line').data(xt).join('line').attr('class', 'sk-grid')
      .attr('x1', (v) => x(v)).attr('x2', (v) => x(v)).attr('y1', m.t).attr('y2', H - m.b);
    svg.append('line').attr('class', 'sk-ref').attr('x1', x(0)).attr('x2', x(0)).attr('y1', m.t).attr('y2', H - m.b);
    svg.append('g').selectAll('text').data(xt).join('text').attr('x', (v) => x(v)).attr('y', H - m.b + 16)
      .attr('text-anchor', 'middle').text((v) => (v > 0 ? '+' + v : v));
    svg.append('text').attr('x', m.l).attr('y', H - 6).text('← 甘口(日本酒度)');
    svg.append('text').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').text('辛口 →');
    const tip = tipFor(el);
    const pts = [];
    groups.forEach((gr, gi) => {
      const cy = m.t + rowH * gi + rowH / 2;
      svg.append('text').attr('x', 0).attr('y', cy - 2).style('fill', 'var(--color-fg)').text(gr.name);
      svg.append('text').attr('x', 0).attr('y', cy + 12).text(gr.rows.length + ' 蔵・中央値 ' + fmtSmv(gr.med));
      svg.append('line').attr('x1', x(gr.med)).attr('x2', x(gr.med)).attr('y1', cy - 17).attr('y2', cy + 17)
        .style('stroke', 'var(--color-fg)').style('stroke-width', 1.5);
      const levels = [];
      gr.rows.slice().sort((a, b) => a.smv - b.smv).forEach((d) => {
        const px = x(d.smv);
        let lv = 0;
        while (levels[lv] != null && px - levels[lv] < 11) lv++;
        levels[lv] = px;
        const off = (lv % 2 ? -1 : 1) * Math.ceil(lv / 2) * 9;
        pts.push({d, x: px, y: cy + off});
      });
    });
    const g = svg.append('g');
    pts.forEach((p) => {
      const c = riceColor(p.d.rice);
      const dot = g.append('circle').attr('cx', p.x).attr('cy', p.y).attr('r', 5)
        .attr('class', 'sk-dot' + (c ? '' : ' sk-hollow') + (SK.sel === p.d.brand ? ' sk-on' : ''));
      if (c) dot.style('fill', c);
    });
    g.selectAll('circle.sk-hit').data(pts).join('circle').attr('class', 'sk-hit')
      .attr('cx', (p) => p.x).attr('cy', (p) => p.y).attr('r', 10)
      .on('pointerenter pointermove', (ev, p) => tip.show(p.d, (p.x / W) * el.clientWidth, (p.y / W) * el.clientWidth,
        [p.d.product || '', '日本酒度 ' + fmtSmv(p.d.smv), '米: ' + p.d.rice]))
      .on('pointerleave', () => tip.hide())
      .on('click', (ev, p) => pick(p.d.brand));
    if (SK.sel) {
      const p = pts.find((q) => q.d.brand === SK.sel);
      if (p) drawLabels(svg, placeLabels([{x: p.x, y: p.y - 12, r: 0, text: p.d.brand, force: true}], W));
    }
  });

  function fillRows(tb, rows, cells) {
    tb.replaceChildren();
    rows.forEach((d) => {
      const tr = document.createElement('tr');
      tr.dataset.key = encodeURIComponent(d.brand);
      cells.forEach((c) => {
        const td = h('td', c.cls || null);
        const v = c.f(d);
        if (c.link && safeUrl(d.url)) {
          const a = h('a', null, v);
          a.href = d.url; a.target = '_blank'; a.rel = 'noopener';
          td.append(a);
        } else td.textContent = v;
        tr.append(td);
      });
      tb.append(tr);
    });
  }
  function tableState(tb, n) {
    const k = dash.data('kura');
    if (k.status === 'ok') return k.data.map(norm);
    tb.replaceChildren();
    const tr = document.createElement('tr'), td = h('td', null, k.status === 'error' ? 'データを読み込めませんでした。' : '—');
    td.colSpan = n; tr.append(td); tb.append(tr);
    return null;
  }
  dash.draw('rows', (tb) => {
    const data = tableState(tb, 10);
    if (!data) return;
    fillRows(tb, data.slice().sort((a, b) => a.rank - b.rank || b.score - a.score), [
      {f: (d) => String(d.rank), cls: 'sk-num'}, {f: (d) => d.brand, link: true}, {f: (d) => d.kura}, {f: (d) => d.pref},
      {f: (d) => d.score.toFixed(2), cls: 'sk-num'}, {f: (d) => d.product || '—'},
      {f: (d) => fmtSmv(d.smv), cls: 'sk-num'}, {f: (d) => fmtAcid(d.acid), cls: 'sk-num'},
      {f: (d) => d.rice}, {f: (d) => d.taste}
    ]);
  });
  dash.draw('wrows', (tb) => {
    const data = tableState(tb, 6);
    if (!data) return;
    const ord = ['軟水', 'ミネラル分あり', '弱硬水', '記載なし'];
    fillRows(tb, data.filter((d) => d.water && d.water !== '記載なし')
      .sort((a, b) => ord.indexOf(a.water_class) - ord.indexOf(b.water_class) || a.rank - b.rank), [
      {f: (d) => d.brand}, {f: (d) => d.pref}, {f: (d) => (d.water_class === '記載なし' ? '—' : d.water_class)},
      {f: (d) => d.water, cls: 'sk-wraptd'}, {f: (d) => fmtSmv(d.smv), cls: 'sk-num'}, {f: (d) => d.taste}
    ]);
  });

  document.querySelectorAll('#sk-mode').forEach((sel) => {
    sel.addEventListener('change', () => { SK.mode = sel.value; dash.draw('map'); });
  });
})();
