/* Shared helpers for the masking apps (decision lab + plateau practice).
   Language comes from <html lang="tr|en">. */
(function (global) {
    'use strict';

    const LANG = (document.documentElement.lang || 'tr').slice(0, 2).toLowerCase() === 'en' ? 'en' : 'tr';

    // Interaural attenuation (dB) used by both apps. Bone conduction is taken as 0 dB.
    const IA = { supra: 40, insert: 50 };

    const SVG_NS = 'http://www.w3.org/2000/svg';
    const RED = '#dc2626';
    const BLUE = '#2563eb';

    function svg(tag, attrs, text) {
        const node = document.createElementNS(SVG_NS, tag);
        for (const key in attrs) node.setAttribute(key, attrs[key]);
        if (text !== undefined) node.textContent = text;
        return node;
    }

    /* ---------- Single-frequency audiogram strip ---------- */
    const G = { w: 440, h: 520, top: 44, bottom: 14, left: 40, right: 12, min: -10, max: 120 };
    const CX = (G.left + G.w - G.right) / 2;
    const SLOT_X = { L2: CX - 150, L1: CX - 75, R1: CX + 75, R2: CX + 150 };

    function stripY(db) {
        const clamped = Math.max(G.min, Math.min(G.max, db));
        return G.top + (clamped - G.min) / (G.max - G.min) * (G.h - G.top - G.bottom);
    }

    function drawSymbol(parent, sym) {
        const y = stripY(sym.nr ? G.max : sym.db);
        const right = sym.kind.indexOf('R') !== -1;
        const color = right ? RED : BLUE;
        const stroke = { stroke: color, 'stroke-width': 2.6, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
        const bx = right ? CX - 24 : CX + 24;   // bone symbols sit beside the line
        const dir = right ? -1 : 1;
        const group = svg('g', {});
        const base = sym.kind.replace(/[RL]/, '');

        if (base === 'ac') {
            if (right) {
                group.appendChild(svg('circle', Object.assign({ cx: CX, cy: y, r: 9 }, stroke)));
            } else {
                group.appendChild(svg('path', Object.assign({ d: `M${CX - 8} ${y - 8}L${CX + 8} ${y + 8}M${CX + 8} ${y - 8}L${CX - 8} ${y + 8}` }, stroke)));
            }
        } else if (base === 'acm') {
            if (right) {
                group.appendChild(svg('path', Object.assign({ d: `M${CX} ${y - 11}L${CX - 11} ${y + 8}L${CX + 11} ${y + 8}Z` }, stroke)));
            } else {
                group.appendChild(svg('rect', Object.assign({ x: CX - 9, y: y - 9, width: 18, height: 18 }, stroke)));
            }
        } else if (base === 'bc') {
            group.appendChild(svg('path', Object.assign({ d: `M${bx - dir * 7} ${y - 9}L${bx + dir * 5} ${y}L${bx - dir * 7} ${y + 9}` }, stroke)));
        } else if (base === 'bcm') {
            group.appendChild(svg('path', Object.assign({ d: `M${bx - dir * 6} ${y - 10}L${bx + dir * 3} ${y - 10}L${bx + dir * 3} ${y + 10}L${bx - dir * 6} ${y + 10}` }, stroke)));
        }

        if (sym.nr) {
            // "no response" arrow pointing down and away from the midline
            const ax = (base.indexOf('bc') === 0 ? bx : CX) + dir * 10;
            const ay = y + 10;
            group.appendChild(svg('path', Object.assign({ d: `M${ax} ${ay}l${dir * 10} 10m${-dir * 7} 0h${dir * 7}v-7` }, stroke)));
        }
        parent.appendChild(group);
    }

    function drawDim(parent, dim) {
        const x = SLOT_X[dim.slot];
        const leftSide = dim.slot.charAt(0) === 'L';
        const y1 = stripY(dim.from);
        const y2 = stripY(dim.to);
        const color = dim.active ? dim.color : '#94a3b8';
        const width = dim.active ? 2.6 : 1.4;
        const group = svg('g', {});

        if (dim.caption) {
            group.appendChild(svg('text', {
                // outer captions on the upper row, inner ones on the lower row, so long labels never collide
                x: x, y: dim.slot.charAt(1) === '2' ? G.top - 17 : G.top - 5, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 600,
                fill: dim.active ? dim.color : '#94a3b8'
            }, dim.caption));
        }
        if (y1 !== y2) {
            const line = { x1: x, x2: x, y1: y1, y2: y2, stroke: color, 'stroke-width': width };
            if (!dim.active) line['stroke-dasharray'] = '4 4';
            group.appendChild(svg('line', line));
        }
        [y1, y2].forEach(function (yy) {
            group.appendChild(svg('line', { x1: x - 6, x2: x + 6, y1: yy, y2: yy, stroke: color, 'stroke-width': width }));
        });
        group.appendChild(svg('text', {
            x: leftSide ? x - 9 : x + 9,
            y: (y1 + y2) / 2 + 4,
            'text-anchor': leftSide ? 'end' : 'start',
            'font-size': 12,
            'font-weight': dim.active ? 700 : 500,
            fill: color
        }, dim.label));
        parent.appendChild(group);
    }

    /* opts: { labels: {right, left}, symbols: [{kind, db, nr}], dims: [{slot, from, to, label, caption, color, active}] }
       kind: acR | acL | bcR | bcL (unmasked), acmR | acmL | bcmR | bcmL (masked) */
    function drawStrip(svgEl, opts) {
        // fontScale > 1 (plateau app, for projection) enlarges the text and moves the
        // ear labels over their own half so they cannot collide with "dB HL".
        const fs = opts.fontScale || 1;
        svgEl.setAttribute('viewBox', `0 0 ${G.w} ${G.h}`);
        svgEl.replaceChildren();

        svgEl.appendChild(svg('rect', {
            x: G.left, y: G.top, width: G.w - G.left - G.right, height: G.h - G.top - G.bottom,
            fill: '#fff', stroke: '#e2e8f0', 'stroke-width': 1.5, rx: 6
        }));
        for (let db = G.min; db <= G.max; db += 10) {
            const y = stripY(db);
            if (db !== G.min && db !== G.max) {
                svgEl.appendChild(svg('line', {
                    x1: G.left, x2: G.w - G.right, y1: y, y2: y,
                    stroke: db === 0 ? '#cbd5e1' : '#eef2f7', 'stroke-width': db === 0 ? 1.4 : 1
                }));
            }
            svgEl.appendChild(svg('text', { x: G.left - 6, y: y + 4 * fs, 'text-anchor': 'end', 'font-size': 11 * fs, fill: fs > 1 ? '#64748b' : '#94a3b8' }, String(db)));
        }
        svgEl.appendChild(svg('line', { x1: CX, x2: CX, y1: G.top, y2: G.h - G.bottom, stroke: '#cbd5e1', 'stroke-width': 1 }));
        if (fs > 1) {
            svgEl.appendChild(svg('text', { x: 2, y: G.top - 10, 'font-size': 10 * fs, fill: '#64748b' }, 'dB HL'));
            if (opts.labels) {
                svgEl.appendChild(svg('text', { x: (G.left + CX) / 2 + 10, y: G.top - 10, 'text-anchor': 'middle', 'font-size': 12 * fs, 'font-weight': 700, fill: RED }, opts.labels.right));
                svgEl.appendChild(svg('text', { x: (CX + G.w - G.right) / 2, y: G.top - 10, 'text-anchor': 'middle', 'font-size': 12 * fs, 'font-weight': 700, fill: BLUE }, opts.labels.left));
            }
        } else {
            svgEl.appendChild(svg('text', { x: G.left - 6, y: 13, 'text-anchor': 'end', 'font-size': 10, fill: '#94a3b8' }, 'dB HL'));
            if (opts.labels) {
                svgEl.appendChild(svg('text', { x: G.left + 4, y: 13, 'font-size': 12, 'font-weight': 700, fill: RED }, opts.labels.right));
                svgEl.appendChild(svg('text', { x: G.w - G.right - 4, y: 13, 'text-anchor': 'end', 'font-size': 12, 'font-weight': 700, fill: BLUE }, opts.labels.left));
            }
        }
        (opts.dims || []).forEach(function (dim) { drawDim(svgEl, dim); });
        (opts.symbols || []).forEach(function (sym) { drawSymbol(svgEl, sym); });
    }

    /* Standard page header: title, subtitle, language switch, back link. */
    function headerHTML(cfg) {
        const other = LANG === 'tr'
            ? `<span>TR</span><a href="${cfg.altHref}" lang="en" hreflang="en">EN</a>`
            : `<a href="${cfg.altHref}" lang="tr" hreflang="tr">TR</a><span>EN</span>`;
        return `
            <div class="ml-head">
                <div>
                    <h1 class="ml-title">${cfg.title}</h1>
                    <p class="ml-subtitle">${cfg.subtitle}</p>
                </div>
                <div class="ml-head-actions">
                    ${cfg.extra || ''}
                    <a class="ml-link" href="apps.html"><i class="fas fa-table-cells" aria-hidden="true"></i> ${LANG === 'tr' ? 'Uygulamalar' : 'Apps'}</a>
                    <div class="ml-lang" aria-label="${LANG === 'tr' ? 'Dil' : 'Language'}">${other}</div>
                </div>
            </div>`;
    }

    global.ML = { LANG: LANG, IA: IA, RED: RED, BLUE: BLUE, svg: svg, drawStrip: drawStrip, headerHTML: headerHTML };
})(window);
