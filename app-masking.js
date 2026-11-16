/* Maskeleme Karar Laboratuvarı / Masking Decision Laboratory
   Rules follow the lecture notes "Saf Ses Odyometride Maskeleme":
     Air:  TK_HE − TEK_KY ≥ IA                         → mask
     Bone: air-bone gap in the test ear > 10 dB
           OR TK_HE − TEK_KY > 10 dB                    → mask
     (TK = test ear, TEK = non-test ear, HE = air threshold, KY = bone threshold) */
(function () {
    'use strict';

    const { LANG, IA, RED, BLUE, drawStrip, headerHTML } = window.ML;
    const ABG_LIMIT = 10;
    const KEYS = ['rightAC', 'rightBC', 'leftAC', 'leftBC'];
    const DEFAULTS = { rightAC: 40, rightBC: 10, leftAC: 10, leftBC: 10 };

    // Ready-made cases (unmasked thresholds at one frequency).
    const PRESETS = [
        { rightAC: 40, rightBC: 10, leftAC: 10, leftBC: 10 },
        { rightAC: 65, rightBC: 10, leftAC: 10, leftBC: 10 },
        { rightAC: 50, rightBC: 50, leftAC: 50, leftBC: 50 },
        { rightAC: 50, rightBC: 10, leftAC: 45, leftBC: 10 },
        { rightAC: 35, rightBC: 35, leftAC: 80, leftBC: 35 },
        { rightAC: 10, rightBC: 10, leftAC: 50, leftBC: 10 }
    ];

    const STR = {
        tr: {
            title: 'Maskeleme Karar Laboratuvarı',
            subtitle: 'Vakayı oluştur, hangi eşiklerde maske gerektiğine karar ver ve kontrol et.',
            altHref: 'app-masking-en.html',
            next: 'Maske Uygulaması (plato)',
            nextHref: 'app-plateau-tr.html',
            transducer: 'Kulaklık tipi (IA)',
            supra: 'Kulak üstü (40 dB)',
            insert: 'Kulak içi (50 dB)',
            buildCase: 'Vaka oluştur (maskesiz eşikler)',
            right: 'SAĞ KULAK', left: 'SOL KULAK',
            rightShort: 'SAĞ', leftShort: 'SOL',
            air: 'Hava yolu', bone: 'Kemik yolu',
            preset: 'Hazır vaka', presetNone: 'Seç…', presetItem: 'Vaka',
            random: 'Rastgele vaka', reset: 'Sıfırla',
            audiogram: 'Odyogram (tek frekans)',
            legend: [['r', 'O', 'Sağ hava'], ['r', '<', 'Sağ kemik'], ['l', 'X', 'Sol hava'], ['l', '>', 'Sol kemik']],
            question: 'Hangisinde maske gerekir?',
            questionHint: 'Gerekli olanların hepsini işaretle. Hiçbiri gerekmiyorsa boş bırak.',
            opts: { rightAC: 'Sağ hava yolu', rightBC: 'Sağ kemik yolu', leftAC: 'Sol hava yolu', leftBC: 'Sol kemik yolu' },
            check: 'KONTROL ET',
            score: 'Tam doğru vaka', scoreReset: 'sıfırla',
            report: 'Analiz raporu',
            waiting: 'Kararını ver ve<br>“KONTROL ET” düğmesine bas.',
            allCorrect: 'Tam isabet! Dört kararın da doğru.',
            someWrong: n => `${n} karar hatalı. Hesapları incele.`,
            needed: 'GEREKLİ', notNeeded: 'GEREKMEZ',
            calcAC: (ear, other, ac, bc, d) => `${ear} hava (${ac}) − ${other} kemik (${bc}) = ${d} dB`,
            calcBC: (ear, ac, bc, d) => `${ear} hava (${ac}) − ${ear} kemik (${bc}) = ${d} dB (hava-kemik aralığı)`,
            whyACneed: (ia, other) => `Fark ≥ IA (${ia} dB): ton karşı kulağın kokleasına ulaşabilir. Maske gürültüsü ${other} kulağa verilir.`,
            whyACno: ia => `Fark < IA (${ia} dB): çapraz işitme beklenmez.`,
            whyBCneed: other => `Farklardan en az biri > ${ABG_LIMIT} dB: kemikte IA = 0 olduğundan bu kemik eşiğinin hangi kokleaya ait olduğu maskesiz bilinemez. Maske gürültüsü ${other} kulağa verilir.`,
            whyBCno: `İki fark da ≤ ${ABG_LIMIT} dB: maske gerekmez.`,
            earName: { right: 'Sağ', left: 'Sol' },
            earLower: { right: 'sol', left: 'sağ' },   // opposite ear, lower case
            stCorrect: 'Doğru karar', stIncorrect: 'Gereksiz işaretledin', stMissed: 'Atladın: maske gerekiyordu',
            capAC: 'hava − karşı kemik', capBC: 'hava − kemik aralığı',
            rules: 'Karar kuralları',
            rulesBody: `
                <ul>
                    <li><strong>Hava yolu:</strong> test kulağının hava yolu eşiği ile test edilmeyen kulağın kemik yolu eşiği arasındaki fark IA’ya eşit ya da büyükse maske gerekir.<br>
                        <span class="ml-formula">TK<sub>HE</sub> − TEK<sub>KY</sub> ≥ IA</span></li>
                    <li><strong>Kemik yolu:</strong> aynı kulakta 10 dB’den fazla hava-kemik aralığı <em>ya da</em> test kulağının hava yolu eşiği ile test edilmeyen kulağın kemik yolu eşiği arasında 10 dB’den fazla fark varsa maske gerekir.<br>
                        <span class="ml-formula">TK<sub>HE</sub> − TK<sub>KY</sub> &gt; 10 dB</span> ya da
                        <span class="ml-formula">TK<sub>HE</sub> − TEK<sub>KY</sub> &gt; 10 dB</span></li>
                    <li><strong>IA:</strong> kulak üstü (supra-aural) 40 dB, kulak içi (insert) 50 dB, kemik vibratörü 0 dB.</li>
                    <li><strong>Pratik öneri:</strong> kemik eşikleri henüz bilinmiyorsa iki kulağın hava yolu eşikleri arasında 40 dB fark olması maske şüphesi doğurur.</li>
                </ul>
                <p class="ml-note">TK: test kulağı · TEK: test edilmeyen kulak · HE: hava yolu eşiği · KY: kemik yolu eşiği</p>`
        },
        en: {
            title: 'Masking Decision Laboratory',
            subtitle: 'Build a case, decide which thresholds need masking, and check.',
            altHref: 'app-masking-tr.html',
            next: 'Masking Practice (plateau)',
            nextHref: 'app-plateau-en.html',
            transducer: 'Transducer (IA)',
            supra: 'Supra-aural (40 dB)',
            insert: 'Insert (50 dB)',
            buildCase: 'Build a case (unmasked thresholds)',
            right: 'RIGHT EAR', left: 'LEFT EAR',
            rightShort: 'RIGHT', leftShort: 'LEFT',
            air: 'Air conduction', bone: 'Bone conduction',
            preset: 'Ready-made case', presetNone: 'Choose…', presetItem: 'Case',
            random: 'Random case', reset: 'Reset',
            audiogram: 'Audiogram (single frequency)',
            legend: [['r', 'O', 'Right air'], ['r', '<', 'Right bone'], ['l', 'X', 'Left air'], ['l', '>', 'Left bone']],
            question: 'Which need masking?',
            questionHint: 'Select every threshold that needs masking. Leave empty if none do.',
            opts: { rightAC: 'Right air conduction', rightBC: 'Right bone conduction', leftAC: 'Left air conduction', leftBC: 'Left bone conduction' },
            check: 'CHECK',
            score: 'Fully correct cases', scoreReset: 'reset',
            report: 'Analysis report',
            waiting: 'Make your decision and<br>press “CHECK”.',
            allCorrect: 'Spot on! All four decisions are correct.',
            someWrong: n => `${n} decision${n > 1 ? 's are' : ' is'} wrong. Review the calculations.`,
            needed: 'REQUIRED', notNeeded: 'NOT NEEDED',
            calcAC: (ear, other, ac, bc, d) => `${ear} air (${ac}) − ${other} bone (${bc}) = ${d} dB`,
            calcBC: (ear, ac, bc, d) => `${ear} air (${ac}) − ${ear} bone (${bc}) = ${d} dB (air-bone gap)`,
            whyACneed: (ia, other) => `Difference ≥ IA (${ia} dB): the tone can reach the opposite cochlea. Masking noise goes to the ${other} ear.`,
            whyACno: ia => `Difference < IA (${ia} dB): cross hearing is not expected.`,
            whyBCneed: other => `At least one difference is > ${ABG_LIMIT} dB: with IA = 0 for bone, we cannot tell which cochlea this bone threshold belongs to without masking. Masking noise goes to the ${other} ear.`,
            whyBCno: `Both differences are ≤ ${ABG_LIMIT} dB: no masking needed.`,
            earName: { right: 'Right', left: 'Left' },
            earLower: { right: 'left', left: 'right' },
            stCorrect: 'Correct decision', stIncorrect: 'Selected, but not needed', stMissed: 'Missed: masking was needed',
            capAC: 'air − opposite bone', capBC: 'air − bone gap',
            rules: 'Decision rules',
            rulesBody: `
                <ul>
                    <li><strong>Air conduction:</strong> mask when the test-ear air threshold exceeds the non-test ear’s bone threshold by IA or more.<br>
                        <span class="ml-formula">AC(test) − BC(non-test) ≥ IA</span></li>
                    <li><strong>Bone conduction:</strong> mask when the air-bone gap in the same ear is greater than 10 dB, <em>or</em> when the test-ear air threshold exceeds the non-test ear’s bone threshold by more than 10 dB.<br>
                        <span class="ml-formula">AC(test) − BC(test) &gt; 10 dB</span> or
                        <span class="ml-formula">AC(test) − BC(non-test) &gt; 10 dB</span></li>
                    <li><strong>IA:</strong> supra-aural earphones 40 dB, insert earphones 50 dB, bone vibrator 0 dB.</li>
                    <li><strong>Practical tip:</strong> before bone thresholds are known, a 40 dB difference between the two air thresholds already raises the suspicion of cross hearing.</li>
                </ul>`
        }
    };
    const T = STR[LANG];

    const state = {
        transducer: 'supra',
        thresholds: Object.assign({}, DEFAULTS),
        selections: { rightAC: false, rightBC: false, leftAC: false, leftBC: false },
        checked: false,
        scored: false,          // has the current case already been counted?
        score: { correct: 0, total: 0 }
    };

    const root = document.getElementById('ml-app');
    const $ = sel => root.querySelector(sel);

    function sliderHTML(key, label, symbol) {
        return `
            <label class="ml-slider-label" for="${key}">
                <span>${label} (${symbol})</span>
                <span class="ml-slider-val" id="val-${key}"></span>
            </label>
            <input type="range" id="${key}" min="-10" max="120" step="5">`;
    }

    function build() {
        root.innerHTML = `
            ${headerHTML({
                title: T.title, subtitle: T.subtitle, altHref: T.altHref,
                extra: `<a class="ml-link" href="${T.nextHref}">${T.next} <i class="fas fa-arrow-right" aria-hidden="true"></i></a>`
            })}
            <div class="ml-layout">
                <div class="ml-col">
                    <section class="ml-panel">
                        <h2><i class="fas fa-headphones" aria-hidden="true"></i> ${T.transducer}</h2>
                        <div class="ml-toggle" id="transducer">
                            <button type="button" data-type="supra">${T.supra}</button>
                            <button type="button" data-type="insert">${T.insert}</button>
                        </div>
                    </section>
                    <section class="ml-panel">
                        <h2><i class="fas fa-sliders" aria-hidden="true"></i> ${T.buildCase}</h2>
                        <div class="ml-ear ml-ear--right">
                            <span class="ml-ear-title">${T.right}</span>
                            ${sliderHTML('rightAC', T.air, 'O')}
                            ${sliderHTML('rightBC', T.bone, '&lt;')}
                        </div>
                        <div class="ml-ear ml-ear--left">
                            <span class="ml-ear-title">${T.left}</span>
                            ${sliderHTML('leftAC', T.air, 'X')}
                            ${sliderHTML('leftBC', T.bone, '&gt;')}
                        </div>
                        <label class="ml-field-label" for="preset" style="margin-top:16px">${T.preset}</label>
                        <select class="ml-select" id="preset">
                            <option value="">${T.presetNone}</option>
                            ${PRESETS.map((_, i) => `<option value="${i}">${T.presetItem} ${i + 1}</option>`).join('')}
                        </select>
                        <div class="ml-btn-row" style="margin-top:10px">
                            <button type="button" class="ml-btn" id="randomBtn"><i class="fas fa-shuffle" aria-hidden="true"></i> ${T.random}</button>
                            <button type="button" class="ml-btn" id="resetBtn"><i class="fas fa-rotate-left" aria-hidden="true"></i> ${T.reset}</button>
                        </div>
                    </section>
                    <details class="ml-panel ml-rules">
                        <summary>${T.rules}</summary>
                        ${T.rulesBody}
                    </details>
                </div>

                <div class="ml-col">
                    <section class="ml-panel">
                        <h2><i class="fas fa-chart-line" aria-hidden="true"></i> ${T.audiogram}</h2>
                        <svg class="ml-strip" id="strip" role="img" aria-label="${T.audiogram}"></svg>
                        <div class="ml-legend">
                            ${T.legend.map(l => `<span><b class="${l[0]}">${l[1].replace('<', '&lt;').replace('>', '&gt;')}</b>${l[2]}</span>`).join('')}
                        </div>
                    </section>
                </div>

                <div class="ml-col">
                    <section class="ml-panel ml-panel--dark">
                        <h2><i class="fas fa-circle-question" aria-hidden="true"></i> ${T.question}</h2>
                        <div id="options">
                            ${KEYS.map(k => `
                                <button type="button" class="ml-option ${k.indexOf('right') === 0 ? 'is-right' : 'is-left'}" data-key="${k}" aria-pressed="false">
                                    <span>${T.opts[k]}</span><i class="far fa-square" aria-hidden="true"></i>
                                </button>`).join('')}
                        </div>
                        <p class="ml-note" style="color:#94a3b8;margin:0 0 12px">${T.questionHint}</p>
                        <button type="button" class="ml-btn ml-btn--primary" id="checkBtn">${T.check}</button>
                        <div class="ml-score">
                            <span>${T.score}: <strong id="score">0 / 0</strong></span>
                            <button type="button" id="scoreReset">${T.scoreReset}</button>
                        </div>
                    </section>
                    <section class="ml-panel">
                        <h2><i class="fas fa-clipboard-list" aria-hidden="true"></i> ${T.report}</h2>
                        <div id="report" aria-live="polite"></div>
                    </section>
                </div>
            </div>`;

        $('#transducer').addEventListener('click', e => {
            const btn = e.target.closest('button[data-type]');
            if (!btn) return;
            state.transducer = btn.dataset.type;
            caseChanged();
        });
        KEYS.forEach(key => {
            $('#' + key).addEventListener('input', e => {
                setThreshold(key, parseInt(e.target.value, 10));
                $('#preset').value = '';
                caseChanged();
            });
        });
        $('#preset').addEventListener('change', e => {
            if (e.target.value === '') return;
            state.thresholds = Object.assign({}, PRESETS[Number(e.target.value)]);
            clearSelections();
            caseChanged();
        });
        $('#randomBtn').addEventListener('click', () => {
            state.thresholds = randomCase();
            $('#preset').value = '';
            clearSelections();
            caseChanged();
        });
        $('#resetBtn').addEventListener('click', () => {
            state.transducer = 'supra';
            state.thresholds = Object.assign({}, DEFAULTS);
            $('#preset').value = '';
            clearSelections();
            caseChanged();
        });
        $('#options').addEventListener('click', e => {
            const btn = e.target.closest('button[data-key]');
            if (!btn) return;
            state.selections[btn.dataset.key] = !state.selections[btn.dataset.key];
            state.checked = false;
            render();
        });
        $('#checkBtn').addEventListener('click', check);
        $('#scoreReset').addEventListener('click', () => {
            state.score = { correct: 0, total: 0 };
            render();
        });
    }

    // Air conduction can never be better than bone conduction in the same ear.
    function setThreshold(key, value) {
        const t = state.thresholds;
        t[key] = value;
        const side = key.indexOf('right') === 0 ? 'right' : 'left';
        if (key.slice(-2) === 'AC' && t[side + 'BC'] > value) t[side + 'BC'] = value;
        if (key.slice(-2) === 'BC' && t[side + 'AC'] < value) t[side + 'AC'] = value;
    }

    function clearSelections() {
        KEYS.forEach(k => { state.selections[k] = false; });
    }

    function caseChanged() {
        state.checked = false;
        state.scored = false;
        render();
    }

    // A physically plausible unmasked audiogram: unmasked bone reflects the better cochlea,
    // and unmasked air cannot exceed IA + the opposite bone threshold.
    function randomCase() {
        const pick = arr => arr[Math.floor(Math.random() * arr.length)];
        const ia = IA[state.transducer];
        const bone = { right: pick([0, 5, 10, 15, 20, 30, 40, 50, 60]), left: pick([0, 5, 10, 15, 20, 30, 40, 50, 60]) };
        const gaps = [0, 0, 0, 5, 10, 15, 20, 30, 40, 50];
        const air = { right: Math.min(110, bone.right + pick(gaps)), left: Math.min(110, bone.left + pick(gaps)) };
        const best = Math.min(bone.right, bone.left);
        const rightAC = Math.min(air.right, ia + bone.left + pick([0, 0, 5]));
        const leftAC = Math.min(air.left, ia + bone.right + pick([0, 0, 5]));
        return {
            rightAC: rightAC, leftAC: leftAC,
            rightBC: Math.min(rightAC, best),
            leftBC: Math.min(leftAC, best)
        };
    }

    function evaluate() {
        const t = state.thresholds;
        const ia = IA[state.transducer];
        // diff: the quantity the rule is named after; cross: test-ear air − non-test-ear bone
        const res = {
            rightAC: { diff: t.rightAC - t.leftBC },
            leftAC: { diff: t.leftAC - t.rightBC },
            rightBC: { diff: t.rightAC - t.rightBC, cross: t.rightAC - t.leftBC },
            leftBC: { diff: t.leftAC - t.leftBC, cross: t.leftAC - t.rightBC }
        };
        res.rightAC.need = res.rightAC.diff >= ia;
        res.leftAC.need = res.leftAC.diff >= ia;
        res.rightBC.need = res.rightBC.diff > ABG_LIMIT || res.rightBC.cross > ABG_LIMIT;
        res.leftBC.need = res.leftBC.diff > ABG_LIMIT || res.leftBC.cross > ABG_LIMIT;
        KEYS.forEach(k => {
            const sel = state.selections[k];
            res[k].status = sel === res[k].need ? 'correct' : (sel ? 'incorrect' : 'missed');
        });
        return res;
    }

    function check() {
        const res = evaluate();
        state.checked = true;
        if (!state.scored) {
            state.scored = true;
            state.score.total += 1;
            if (KEYS.every(k => res[k].status === 'correct')) state.score.correct += 1;
        }
        render();
    }

    function render() {
        const t = state.thresholds;
        const ia = IA[state.transducer];
        const res = evaluate();

        root.querySelectorAll('#transducer button').forEach(b => {
            b.setAttribute('aria-pressed', String(b.dataset.type === state.transducer));
        });
        KEYS.forEach(k => {
            $('#' + k).value = t[k];
            $('#val-' + k).textContent = t[k] + ' dB';
        });

        // Audiogram
        const dims = !state.checked ? [] : [
            { slot: 'L2', from: t.rightAC, to: t.leftBC, label: res.rightAC.diff + ' dB', caption: T.capAC, color: RED, active: res.rightAC.diff > ABG_LIMIT },
            { slot: 'L1', from: t.rightAC, to: t.rightBC, label: res.rightBC.diff + ' dB', caption: T.capBC, color: RED, active: res.rightBC.diff > ABG_LIMIT },
            { slot: 'R1', from: t.leftAC, to: t.leftBC, label: res.leftBC.diff + ' dB', caption: T.capBC, color: BLUE, active: res.leftBC.diff > ABG_LIMIT },
            { slot: 'R2', from: t.leftAC, to: t.rightBC, label: res.leftAC.diff + ' dB', caption: T.capAC, color: BLUE, active: res.leftAC.diff > ABG_LIMIT }
        ];
        drawStrip($('#strip'), {
            labels: { right: T.rightShort, left: T.leftShort },
            dims: dims,
            symbols: [
                { kind: 'bcR', db: t.rightBC }, { kind: 'bcL', db: t.leftBC },
                { kind: 'acR', db: t.rightAC }, { kind: 'acL', db: t.leftAC }
            ]
        });

        // Options
        root.querySelectorAll('#options button').forEach(btn => {
            const key = btn.dataset.key;
            const sel = state.selections[key];
            btn.setAttribute('aria-pressed', String(sel));
            btn.classList.remove('res-correct', 'res-incorrect', 'res-missed');
            if (state.checked) btn.classList.add('res-' + res[key].status);
            btn.querySelector('i').className = sel ? 'fas fa-square-check' : 'far fa-square';
        });
        $('#score').textContent = state.score.correct + ' / ' + state.score.total;

        // Report
        const report = $('#report');
        if (!state.checked) {
            report.innerHTML = `<div class="ml-placeholder"><i class="far fa-clock" aria-hidden="true"></i><p>${T.waiting}</p></div>`;
            return;
        }
        const wrong = KEYS.filter(k => res[k].status !== 'correct').length;
        const cards = KEYS.map(key => {
            const side = key.indexOf('right') === 0 ? 'right' : 'left';
            const other = side === 'right' ? 'left' : 'right';
            const isAC = key.slice(-2) === 'AC';
            const r = res[key];
            const calc = isAC
                ? T.calcAC(T.earName[side], T.earName[other], t[side + 'AC'], t[other + 'BC'], r.diff)
                : T.calcBC(T.earName[side], t[side + 'AC'], t[side + 'BC'], r.diff) + '<br>' +
                  T.calcAC(T.earName[side], T.earName[other], t[side + 'AC'], t[other + 'BC'], r.cross);
            const why = isAC
                ? (r.need ? T.whyACneed(ia, T.earLower[side]) : T.whyACno(ia))
                : (r.need ? T.whyBCneed(T.earLower[side]) : T.whyBCno);
            const status = r.status === 'correct' ? T.stCorrect : (r.status === 'incorrect' ? T.stIncorrect : T.stMissed);
            const icon = r.status === 'correct' ? 'fa-check' : (r.status === 'incorrect' ? 'fa-xmark' : 'fa-triangle-exclamation');
            return `
                <div class="ml-card ml-card--${r.status}">
                    <div class="ml-card-head">
                        <span>${T.opts[key]}</span>
                        <span class="ml-tag ${r.need ? 'ml-tag--need' : ''}">${r.need ? T.needed : T.notNeeded}</span>
                    </div>
                    <div class="ml-card-calc">${calc}</div>
                    <div>${why}</div>
                    <div class="ml-card-status"><i class="fas ${icon}" aria-hidden="true"></i> ${status}</div>
                </div>`;
        }).join('');
        report.innerHTML = `
            <div class="ml-alert ${wrong === 0 ? 'ml-alert--ok' : 'ml-alert--warn'}">
                <i class="fas ${wrong === 0 ? 'fa-circle-check' : 'fa-triangle-exclamation'}" aria-hidden="true"></i>
                <span>${wrong === 0 ? T.allCorrect : T.someWrong(wrong)}</span>
            </div>
            ${cards}`;
    }

    build();
    render();
})();
