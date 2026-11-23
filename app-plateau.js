/* Maske Uygulaması / Masking Practice — plateau method simulator.
   Follows the lecture notes "Saf Ses Odyometride Maskeleme":
     MBS (air)  = TEK_HE + 10 dB
     MBS (bone) = TEK_HE + 10 dB + OE
     M_maks     = TK_KY + IA
     Plateau    = threshold unchanged over at least 15 dB of masker increase (3 steps of 5 dB)
   The simulated patient reproduces the worked examples on slides 25 and 31.
   Each case is one patient at one frequency: the student first decides which
   measurements need masking, then masks air conduction, then bone conduction.
   Overmasking (M_maks) needs the masked bone threshold, so it is asked in the
   bone step and the earlier air plateau is checked against it. */
(function () {
    'use strict';

    const { LANG, IA, svg, drawStrip, headerHTML } = window.ML;
    const NR = Infinity;        // "no response" / not measurable
    const OFF = -Infinity;      // masker switched off
    const LIM = { toneMin: -10, toneMax: { ac: 120, bc: 70 }, noiseMax: 100, plateauMin: 15 };
    const FREQS = [250, 500, 1000, 2000, 4000];
    const OE_SUPRA = { 250: 15, 500: 15, 1000: 10, 2000: 0, 4000: 0 };

    // Case: id, frequency, earphone, right [air, bone], left [air, bone]  (true thresholds)
    const P = (id, freq, transducer, R, L) =>
        ({ id, freq, transducer, R: { ac: R[0], bc: R[1] }, L: { ac: L[0], bc: L[1] } });
    const CASES = [
        P('D1', 500, 'supra', [65, 50], [0, 0]),       // slide 25 (air example)
        P('D2', 500, 'supra', [50, 30], [0, 0]),       // slide 31 (bone example)
        P('V1', 1000, 'supra', [60, 60], [5, 5]),
        P('V2', 2000, 'supra', [10, 10], [60, 10]),
        P('V3', 4000, 'supra', [55, 55], [15, 15]),
        P('V4', 1000, 'supra', [50, 10], [10, 10]),
        P('V5', 2000, 'supra', [10, 10], [55, 55]),
        P('V6', 250, 'supra', [80, 40], [15, 15]),
        P('V7', 2000, 'insert', [85, 45], [20, 20]),
        P('V8', 1000, 'supra', [50, 15], [55, 20]),    // bilateral conductive case from the notes
        P('V9', 500, 'supra', [5, 5], [NR, NR])        // dead ear: shadow curve
    ];

    /* ---------- Patient model ---------- */
    function occlusion(freq, transducer, nteGap) {
        if (nteGap > 10) return 0;                       // conductive loss in the masked ear: no OE
        if (transducer === 'insert') return freq === 250 ? 10 : 0;
        return OE_SUPRA[freq] || 0;
    }

    function solve(sc, transducer) {
        const other = sc.test === 'R' ? 'L' : 'R';
        const te = sc[sc.test];
        const nte = sc[other];
        const ia = IA[transducer];
        const iaTone = sc.mode === 'ac' ? ia : 0;        // bone vibrator: IA = 0
        const toneMax = LIM.toneMax[sc.mode];
        const nteGap = nte.ac - nte.bc;
        const cap = (v, max) => (v > max ? NR : v);

        // Tone heard by the non-test cochlea: once the noise is audible there (M ≥ its air threshold),
        // a tone must be 5 dB above the effective masking level to be heard.
        const nteCochlea = M => (M >= nte.ac ? M - nteGap + 5 : nte.bc);
        // Noise crossing to the test cochlea (overmasking) once M − IA exceeds its bone threshold.
        const teCochlea = M => Math.max(te.bc, M - ia);
        const tePath = M => (sc.mode === 'ac' ? (te.ac === NR ? NR : te.ac - te.bc + teCochlea(M)) : teCochlea(M));
        const ntePath = M => iaTone + nteCochlea(M);
        const thr = M => cap(Math.min(tePath(M), ntePath(M)), toneMax);

        const acUnm = {};
        acUnm[sc.test] = cap(Math.min(te.ac, ia + nte.bc), 120);
        acUnm[other] = cap(Math.min(nte.ac, ia + te.bc), 120);
        const bcUnm = cap(Math.min(te.bc, nte.bc), 70);
        const unmasked = thr(OFF);
        const trueThr = cap(sc.mode === 'ac' ? te.ac : te.bc, toneMax);

        const oe = sc.mode === 'bc' ? occlusion(sc.freq, transducer, nteGap) : 0;
        const mbs = acUnm[other] + 10 + oe;
        const teBcKnown = te.bc <= 70;
        // "Aşırı maske seviyesi (teoride)": air → masked bone threshold of the test ear is given;
        // bone → only the unmasked bone threshold is known beforehand.
        const overTheory = sc.mode === 'ac' ? (teBcKnown ? te.bc + ia : null) : bcUnm + ia;
        const overActual = teBcKnown ? te.bc + ia : NR;

        // Plateau: contiguous masker levels (audible in the non-test ear) that give the true threshold.
        let first = null, last = null;
        if (trueThr !== NR) {
            for (let M = 0; M <= LIM.noiseMax; M += 5) {
                if (M < nte.ac) continue;
                if (thr(M) === trueThr) { if (first === null) first = M; last = M; }
                else if (first !== null) break;
            }
        }
        const width = first === null ? 0 : last - first;
        let type;
        if (first !== null && width >= LIM.plateauMin) type = 'plateau';
        else if (trueThr === NR) type = 'limit';
        else if (overActual - Math.max(first === null ? mbs : first, nte.ac) < LIM.plateauMin) type = 'dilemma';
        else type = 'limit';

        const gapUnm = acUnm[sc.test] - bcUnm;
        const needed = sc.mode === 'ac' ? gapUnm >= ia : gapUnm > 10;

        return {
            other, te, nte, ia, iaTone, toneMax, nteGap, thr, acUnm, bcUnm, unmasked, trueThr,
            oe, mbs, overTheory, overActual, first, last, width, type, needed, teBcKnown
        };
    }

    function randomScenario(mode, transducer) {
        const pick = arr => arr[Math.floor(Math.random() * arr.length)];
        const want = pick(['plateau', 'plateau', 'plateau', 'plateau', 'dilemma', 'limit']);
        let fallback = null;
        for (let i = 0; i < 4000; i++) {
            const test = pick(['R', 'L']);
            const nteBc = pick([0, 5, 10, 15, 20, 25, 30]);
            const nte = { bc: nteBc, ac: nteBc + pick([0, 0, 0, 0, 5, 20, 30, 40]) };
            const dead = Math.random() < 0.15;
            const teBc = pick([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]);
            const te = dead ? { ac: NR, bc: NR } : { bc: teBc, ac: teBc + pick([0, 0, 0, 5, 20, 30, 40, 50]) };
            if (!dead && te.ac > 110) continue;
            const sc = { id: 'RND', mode, freq: pick(FREQS), test, transducer, R: test === 'R' ? te : nte, L: test === 'R' ? nte : te };
            const s = solve(sc, transducer);
            if (!s.needed) continue;
            if (nte.ac > s.ia + te.bc) continue;                      // non-test ear thresholds must be genuine
            if (s.mbs > LIM.noiseMax - 20) continue;
            if (s.type === 'limit' && s.trueThr !== NR) continue;     // keep "limit" for the unmeasurable ear only
            if (s.type === 'plateau' && s.trueThr === s.unmasked && Math.random() < 0.6) continue;
            if (!fallback) fallback = sc;
            if (s.type === want) return sc;
        }
        return fallback || Object.assign({ test: 'R', mode: 'ac' }, CASES[0]);
    }


    /* ---------- Masking decision and steps of a case ---------- */
    // Decision rules from the notes, on the unmasked audiogram:
    //   air:  TK_HE − TEK_KY ≥ IA      bone: TK_HE − KY > 10
    // The unmasked bone threshold is the better cochlea, so it is the same for both ears.
    function needsOf(c, transducer) {
        const ia = IA[transducer];
        const cap = (v, max) => (v > max ? NR : v);
        const acUnm = { R: cap(Math.min(c.R.ac, ia + c.L.bc), 120), L: cap(Math.min(c.L.ac, ia + c.R.bc), 120) };
        const bcUnm = cap(Math.min(c.R.bc, c.L.bc), 70);
        const ok = ear => acUnm[ear] !== NR && bcUnm !== NR;
        const need = {
            Rac: ok('R') && acUnm.R - bcUnm >= ia,
            Lac: ok('L') && acUnm.L - bcUnm >= ia,
            Rbc: ok('R') && acUnm.R - bcUnm > 10,
            Lbc: ok('L') && acUnm.L - bcUnm > 10
        };
        return { ia, acUnm, bcUnm, need };
    }

    // Steps in teaching order: air conduction first, then bone conduction.
    function caseSteps(c, transducer) {
        const need = needsOf(c, transducer).need;
        return [['R', 'ac'], ['L', 'ac'], ['R', 'bc'], ['L', 'bc']]
            .filter(([ear, mode]) => need[ear + mode])
            .map(([ear, mode]) => ({ ear, mode, sol: solve(Object.assign({}, c, { test: ear, mode: mode }), transducer) }));
    }

    function randomCase(transducer) {
        const sc = randomScenario('ac', transducer);
        return { id: 'RND', freq: sc.freq, transducer: transducer, R: sc.R, L: sc.L };
    }


    /* ---------- Text ---------- */
    const fmtDb = v => (v === NR ? (LANG === 'tr' ? 'cevap yok' : 'no response') : String(v));
    const STR = {
        tr: {
            title: 'Maske Uygulaması',
            subtitle: 'Önce hangi ölçümlere maske gerektiğine karar ver; sonra önce hava, ardından kemik yolu için platoyu bul.',
            altHref: 'app-plateau-en.html',
            prev: 'Maskeleme Karar Laboratuvarı', prevHref: 'app-masking-tr.html',
            scenario: 'Vaka',
            presetName: { D1: 'Ders örneği 1 (slayt 25)', D2: 'Ders örneği 2 (slayt 31)' },
            caseN: n => `Vaka ${n}`, random: 'Rastgele vaka',
            modeShort: { ac: 'hava', bc: 'kemik' },
            stepDecide: 'Maske kararı', decideTitle: 'Hangi ölçümlerde maske gerekir?', decideFirst: 'önce maske kararını ver',
            opt: { Rac: 'Sağ hava yolu', Lac: 'Sol hava yolu', Rbc: 'Sağ kemik yolu', Lbc: 'Sol kemik yolu' },
            decideHint: 'Maske gereken ölçümlerin hepsini işaretle. Hiçbiri gerekmiyorsa boş bırak.',
            decideWaiting: 'Maskesiz eşiklere bak, maske gereken ölçümleri seç ve<br>“KONTROL ET” düğmesine bas.',
            decideOk: 'Karar doğru!',
            ruleAir: (ear, a, b, d, ia, need) => `${ear} hava: TK<sub>HE</sub> − TEK<sub>KY</sub> = ${a} − ${b} = ${d} dB ${need ? '≥' : '<'} IA (${ia}) → <b>${need ? 'maske gerekir' : 'gerekmez'}</b>`,
            ruleBone: (ear, a, b, d, need) => `${ear} kemik: TK<sub>HE</sub> − KY = ${a} − ${b} = ${d} dB ${need ? '>' : '≤'} 10 → <b>${need ? 'maske gerekir' : 'gerekmez'}</b>`,
            ruleNA: opt => `${opt}: maskesiz cevap yok → <b>gerekmez</b>`,
            orderNote: list => `Uygulama sırası: önce hava, sonra kemik yolu. Bu vakada: <b>${list}</b>.`,
            noMasking: 'Bu vakada maske gerekmiyor.',
            startMasking: 'Maskelemeye başla', nextStep: name => `Sonraki adım: ${name}`, nextCase: 'Sonraki vaka',
            caseDone: 'Vaka tamamlandı.', dilemmaShort: 'ikilem',
            lampLocked: 'Önce maske kararı',
            overLater: 'Aşırı maske seviyesi bu kulağın maskeli kemik eşiğine bağlıdır; kemik yolu adımında hesaplanacak.',
            transducer: 'Kulaklık tipi', supra: 'Kulak üstü (IA 40)', insert: 'Kulak içi (IA 50)',
            task: 'Görev',
            tFreq: 'Frekans', tTest: 'Test', tMask: 'Maske', tPhone: 'Kulaklık',
            earCap: { R: 'Sağ', L: 'Sol' }, earLow: { R: 'sağ', L: 'sol' },
            modeLow: { ac: 'hava yolu', bc: 'kemik yolu' },
            maskTo: ear => `${ear} kulağa dar bant gürültü`,
            phone: { supra: 'kulak üstü, IA 40 dB', insert: 'kulak içi, IA 50 dB' },
            thrTitle: 'Eşikler (dB HL)', rowAC: 'Hava (maskesiz)', rowBC: 'Kemik (maskesiz)', rowACm: 'Hava (maskeli)', rowBCm: 'Kemik (maskeli)',
            notNeeded: 'Not: bu kulaklıkla karar kuralına göre maske gerekmez (fark sınırın altında). Yine de deneyebilirsin; eşik kaymayacaktır.',
            audiogram: 'Odyogram',
            legend: { acR: 'Sağ hava', acL: 'Sol hava', bcR: 'Sağ kemik', bcL: 'Sol kemik', acmR: 'Sağ hava (maskeli)', acmL: 'Sol hava (maskeli)', bcmR: 'Sağ kemik (maskeli)', bcmL: 'Sol kemik (maskeli)' },
            method: 'Yöntem hatırlatma',
            methodBody: `
                <ol>
                    <li><strong>Maske Başlangıç Seviyesi (MBS):</strong><br>
                        Hava: <span class="ml-formula">MBS = TEK<sub>HE</sub> + 10 dB</span><br>
                        Kemik: <span class="ml-formula">MBS = TEK<sub>HE</sub> + 10 dB + OE</span></li>
                    <li>Gürültüyü MBS’den başlat ve tonu ver. Hasta <strong>duymazsa tonu 5 dB</strong> artır; <strong>duyarsa gürültüyü 5 dB</strong> (ya da 10 dB) artır.</li>
                    <li><strong>Plato:</strong> gürültü 3 adım üst üste (en az 15–20 dB) arttığı halde eşik değişmiyorsa plato bulunmuştur. Bu eşik maskeli (gerçek) eşiktir.</li>
                    <li><strong>Aşırı maskeleme:</strong> <span class="ml-formula">M<sub>maks</sub> = TK<sub>KY</sub> (maskeli) + IA</span>. Bu seviyenin üzerinde gürültü test kulağına geçer ve eşik yeniden kötüleşir. Maskeli kemik eşiği gerektiği için kemik yolu adımında hesaplanır; hava yolu platosu da bu sınıra göre kontrol edilir.</li>
                    <li><strong>Maskeleme ikilemi:</strong> MBS, aşırı maske seviyesinden yüksek çıkar. Risk varsa MBS, test edilmeyen kulağın eşik seviyesinden başlatılabilir.</li>
                </ol>
                <table class="ml-thr-table">
                    <thead><tr><th>Oklüzyon etkisi</th><th>250</th><th>500</th><th>1000</th><th>2000</th><th>4000 Hz</th></tr></thead>
                    <tbody>
                        <tr><td>Kulak üstü</td><td>15</td><td>15</td><td>10</td><td>0</td><td>0</td></tr>
                        <tr><td>Kulak içi</td><td>10</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
                    </tbody>
                </table>
                <p class="ml-note">Maskelenecek kulakta hava-kemik aralığı (iletim tipi kayıp) varsa OE = 0 kabul edilir.<br>
                TK: test kulağı · TEK: test edilmeyen kulak · HE: hava yolu eşiği · KY: kemik yolu eşiği.<br>
                Simülasyonda santral maskeleme yok sayılır; oklüzyon etkisi yalnızca MBS hesabına eklenir.</p>`,
            audiometer: 'Odyometre',
            tone: 'Sinyal (saf ses)', noise: 'Maske (dar bant gürültü)',
            toneTo: (ear, mode) => `${ear} kulak · ${mode}`, noiseTo: ear => `${ear} kulak`,
            off: 'KAPALI', noiseOff: 'Maskeyi kapat', noiseOn: 'Maskeyi aç',
            present: 'TON VER',
            lampIdle: 'Cevap bekleniyor', lampYes: 'CEVAP VAR (+)', lampNo: 'CEVAP YOK (−)',
            chart: 'Plato grafiği', chartX: 'Maske seviyesi (dB)', chartY: 'Sinyal seviyesi (dB HL)', chartOff: 'kapalı',
            lgStim: 'uyaran seviyesi', lgOwn: 'senin cevabın', lgOwnOk: 'senin cevabın (doğru)', lgTrue: 'gerçek eşik', lgHeard: 'cevap var', lgNot: 'cevap yok', lgCur: 'şu anki ayar', lgSol: 'gerçek eşik eğrisi', lgBand: 'plato',
            under: 'yetersiz maske', plateau: 'PLATO', over: 'aşırı maske',
            log: 'Uygulama tablosu', logM: 'Maske seviyesi', logL: 'Sinyal seviyesi', logR: 'Cevap',
            logEmpty: 'Henüz deneme yok. Maske ve sinyal seviyesini ayarlayıp “TON VER” düğmesine bas.',
            clear: 'Tabloyu temizle',
            answer: 'Cevap penceresi',
            aMbs: 'Maske Başlangıç Seviyesi (dB)',
            aOver: 'Aşırı Maske Seviyesi (dB)',
            aOverNA: 'Test kulağında kemik cevabı yok: hesaplanamaz',
            aType: 'Sonuç',
            aPlateau: 'Plato bulundu',
            aDilemma: 'Plato yok: maskeleme ikilemi',
            aLimit: 'Plato yok: cihaz sınırında cevap yok',
            aThr: ['Maskeli hava yolu eşiği (dB HL)', 'Maskeli kemik yolu eşiği (dB HL)'],
            check: 'KONTROL ET',
            fill: 'Önce boş alanları doldur.',
            feedback: 'Değerlendirme',
            waiting: 'Platoyu ara, cevaplarını yaz ve<br>“KONTROL ET” düğmesine bas.',
            fbOk: 'Hepsi doğru!', fbBad: n => `${n} cevap hatalı. Çözümü incele.`,
            correctIs: 'Doğrusu',
            solution: 'Çözüm',
            next: 'Sonraki senaryo', retry: 'Yeniden dene',
            exMbsAC: (a, m) => `MBS = TEK<sub>HE</sub> + 10 = ${a} + 10 = <b>${m} dB</b>.`,
            exMbsBC: (a, oe, m, why) => `MBS = TEK<sub>HE</sub> + 10 + OE = ${a} + 10 + ${oe} = <b>${m} dB</b> (${why}).`,
            oeWhy: {
                gap: 'maskelenen kulakta hava-kemik aralığı var, OE = 0',
                supra: (f, oe) => `${f} Hz, kulak üstü kulaklık: OE = ${oe}`,
                insert: (f, oe) => `${f} Hz, kulak içi kulaklık: OE = ${oe}`
            },
            exOverBone: (bc, ia, v) => `M<sub>maks</sub> = maskeli TK<sub>KY</sub> + IA = ${bc} + ${ia} = <b>${v} dB</b>. Bu seviyenin üzerinde aşırı maskeleme başlar.`,
            exOverLater: 'Aşırı maske seviyesi için bu kulağın maskeli kemik yolu eşiği gerekir; kemik yolu adımında hesaplanacak. Bu arada plato yöntemi aşırı maskelemeyi zaten gösterir: gürültü arttıkça eşik yeniden yükselmeye başlar.',
            exAirCheck: (f, l, v) => `Hava yolu adımındaki plato ${f}–${l} dB maske aralığındaydı ve bu sınırın (${v} dB) altında kaldı; hava yolu eşiği güvenilir.`,
            exAirCheckNo: 'Hava yolu adımında plato bulunamamıştı; bu sınır o adımda neden plato oluşmadığını açıklar.',
            exOverAC: (bc, ia, v) => `M<sub>maks</sub> = TK<sub>KY</sub> + IA = ${bc} + ${ia} = <b>${v} dB</b>. Bu seviyenin üzerinde aşırı maskeleme başlar.`,
            exOverACna: 'Test kulağında maskeli kemik cevabı yok; gürültünün karşıya geçip maskeleyebileceği bir koklear cevap olmadığından aşırı maskeleme beklenmez.',
            exOverBC: (bc, ia, v) => `Teoride: maskesiz KY + IA = ${bc} + ${ia} = <b>${v} dB</b>. Maskesiz kemik eşiği hangi kokleaya ait olduğu bilinmeden kullanılan en güvenli (en düşük) sınırdır.`,
            exOverBCactual: (bc, ia, v) => `Maskeli eşik bulunduktan sonra gerçek sınır: ${bc} + ${ia} = ${v} dB.`,
            exLimitNoise: n => ` Cihazın maske sınırı ${n} dB olduğundan bu senaryoda aşırı maskeleme görülmez.`,
            exShadow: (t, u, f) => `Maskeli eşik <b>${t} dB HL</b>. Maskesiz ${u} dB HL cevabı test edilmeyen kulaktan geliyordu (çapraz işitme); maske ${f} dB’e ulaşınca karşı kulak devreden çıktı ve eşik sabitlendi.`,
            exNoShift: t => `Maskeli eşik <b>${t} dB HL</b>. Maske arttıkça eşik kaymadı: maskesiz eşik zaten test kulağına aitti.`,
            exWidth: (f, l, w) => `Plato: ${f}–${l} dB maske aralığı (${w} dB genişlik).`,
            exDilemma: (m, o) => `Eşik en az 15 dB’lik bir maske aralığında sabit kalmadı. MBS = ${m} dB, aşırı maske seviyesi = ${o} dB: yeterli maskeye ulaşıldığında gürültü test kulağına geçiyor. Bu <b>maskeleme ikilemi</b>dir.`,
            exDilemma2: 'Test edilmeyen kulakta (çoğunlukla iki kulakta da) hava-kemik aralığı olduğunda görülür. Çözüm: insert kulaklık (IA artar) ya da SAL testi.',
            exDilemmaTrue: t => `Simülasyondaki gerçek eşik ${t} dB HL idi; ancak plato olmadan bu değer doğrulanamaz.`,
            exDead: max => `Maske arttıkça eşik aynı miktarda kaydı ve sinyal cihaz sınırına (${max} dB HL) ulaştığında cevap kayboldu. Maskesiz cevapların tümü test edilmeyen kulağa aitti (gölge eğrisi). Test kulağında ölçülebilir eşik yok; odyograma maskeli “cevap yok” sembolü işlenir.`,
            exNoiseLimit: n => `Yeterli maske düzeyine ulaşmadan cihazın maske sınırına (${n} dB) gelindi; güvenilir plato elde edilemedi.`,
            typeName: { plateau: 'Plato bulundu', dilemma: 'Maskeleme ikilemi', limit: 'Cihaz sınırında cevap yok' },
            item: { mbs: 'MBS', over: 'Aşırı maske', type: 'Sonuç', thr: 'Maskeli eşik' }
        },
        en: {
            title: 'Masking Practice',
            subtitle: 'First decide which measurements need masking; then find the plateau for air conduction first, then bone conduction.',
            altHref: 'app-plateau-tr.html',
            prev: 'Masking Decision Laboratory', prevHref: 'app-masking-en.html',
            scenario: 'Case',
            presetName: { D1: 'Lecture example 1 (slide 25)', D2: 'Lecture example 2 (slide 31)' },
            caseN: n => `Case ${n}`, random: 'Random case',
            modeShort: { ac: 'air', bc: 'bone' },
            stepDecide: 'Masking decision', decideTitle: 'Which measurements need masking?', decideFirst: 'make the masking decision first',
            opt: { Rac: 'Right air conduction', Lac: 'Left air conduction', Rbc: 'Right bone conduction', Lbc: 'Left bone conduction' },
            decideHint: 'Select every measurement that needs masking. Leave all empty if none does.',
            decideWaiting: 'Look at the unmasked thresholds, select the measurements that need masking and<br>press “CHECK”.',
            decideOk: 'Decision correct!',
            ruleAir: (ear, a, b, d, ia, need) => `${ear} air: AC(test) − BC(non-test) = ${a} − ${b} = ${d} dB ${need ? '≥' : '<'} IA (${ia}) → <b>${need ? 'masking needed' : 'not needed'}</b>`,
            ruleBone: (ear, a, b, d, need) => `${ear} bone: AC(test) − BC = ${a} − ${b} = ${d} dB ${need ? '>' : '≤'} 10 → <b>${need ? 'masking needed' : 'not needed'}</b>`,
            ruleNA: opt => `${opt}: no unmasked response → <b>not needed</b>`,
            orderNote: list => `Order: air conduction first, then bone conduction. In this case: <b>${list}</b>.`,
            noMasking: 'No masking is needed in this case.',
            startMasking: 'Start masking', nextStep: name => `Next step: ${name}`, nextCase: 'Next case',
            caseDone: 'Case complete.', dilemmaShort: 'dilemma',
            lampLocked: 'Masking decision first',
            overLater: 'The overmasking level depends on this ear’s masked bone threshold; it is worked out in the bone-conduction step.',
            transducer: 'Earphones', supra: 'Supra-aural (IA 40)', insert: 'Insert (IA 50)',
            task: 'Task',
            tFreq: 'Frequency', tTest: 'Test', tMask: 'Masker', tPhone: 'Earphones',
            earCap: { R: 'Right', L: 'Left' }, earLow: { R: 'right', L: 'left' },
            modeLow: { ac: 'air conduction', bc: 'bone conduction' },
            maskTo: ear => `narrow-band noise to the ${ear.toLowerCase()} ear`,
            phone: { supra: 'supra-aural, IA 40 dB', insert: 'insert, IA 50 dB' },
            thrTitle: 'Thresholds (dB HL)', rowAC: 'Air (unmasked)', rowBC: 'Bone (unmasked)', rowACm: 'Air (masked)', rowBCm: 'Bone (masked)',
            notNeeded: 'Note: with these earphones the decision rule says no masking is needed (difference below the limit). You can still try; the threshold will not shift.',
            audiogram: 'Audiogram',
            legend: { acR: 'Right air', acL: 'Left air', bcR: 'Right bone', bcL: 'Left bone', acmR: 'Right air (masked)', acmL: 'Left air (masked)', bcmR: 'Right bone (masked)', bcmL: 'Left bone (masked)' },
            method: 'Method reminder',
            methodBody: `
                <ol>
                    <li><strong>Initial masking level (IML):</strong><br>
                        Air: <span class="ml-formula">IML = AC(non-test) + 10 dB</span><br>
                        Bone: <span class="ml-formula">IML = AC(non-test) + 10 dB + OE</span></li>
                    <li>Start the noise at the IML and present the tone. If the patient <strong>does not respond, raise the tone 5 dB</strong>; if they <strong>respond, raise the noise 5 dB</strong> (or 10 dB).</li>
                    <li><strong>Plateau:</strong> when the noise has gone up three steps in a row (at least 15–20 dB) and the threshold has not changed, you have the plateau. That threshold is the masked (true) threshold.</li>
                    <li><strong>Overmasking:</strong> <span class="ml-formula">M<sub>max</sub> = masked BC(test) + IA</span>. Above this level the noise crosses to the test ear and the threshold gets worse again. It needs the masked bone threshold, so it is worked out in the bone step and the air plateau is checked against it.</li>
                    <li><strong>Masking dilemma:</strong> the IML comes out higher than the overmasking level. When there is a risk, the masker may be started at the non-test ear’s threshold.</li>
                </ol>
                <table class="ml-thr-table">
                    <thead><tr><th>Occlusion effect</th><th>250</th><th>500</th><th>1000</th><th>2000</th><th>4000 Hz</th></tr></thead>
                    <tbody>
                        <tr><td>Supra-aural</td><td>15</td><td>15</td><td>10</td><td>0</td><td>0</td></tr>
                        <tr><td>Insert</td><td>10</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>
                    </tbody>
                </table>
                <p class="ml-note">If the masked ear has an air-bone gap (conductive loss), OE is taken as 0.<br>
                The simulation ignores central masking; the occlusion effect is only added to the IML calculation.</p>`,
            audiometer: 'Audiometer',
            tone: 'Signal (pure tone)', noise: 'Masker (narrow-band noise)',
            toneTo: (ear, mode) => `${ear} ear · ${mode}`, noiseTo: ear => `${ear} ear`,
            off: 'OFF', noiseOff: 'Turn masker off', noiseOn: 'Turn masker on',
            present: 'PRESENT TONE',
            lampIdle: 'Waiting for response', lampYes: 'RESPONSE (+)', lampNo: 'NO RESPONSE (−)',
            chart: 'Plateau chart', chartX: 'Masker level (dB)', chartY: 'Signal level (dB HL)', chartOff: 'off',
            lgStim: 'stimulus level', lgOwn: 'your answer', lgOwnOk: 'your answer (correct)', lgTrue: 'true threshold', lgHeard: 'response', lgNot: 'no response', lgCur: 'current setting', lgSol: 'true threshold curve', lgBand: 'plateau',
            under: 'undermasking', plateau: 'PLATEAU', over: 'overmasking',
            log: 'Trial table', logM: 'Masker level', logL: 'Signal level', logR: 'Response',
            logEmpty: 'No trials yet. Set the masker and signal levels and press “PRESENT TONE”.',
            clear: 'Clear table',
            answer: 'Answer window',
            aMbs: 'Initial masking level (dB)',
            aOver: 'Overmasking level (dB)',
            aOverNA: 'No bone response in the test ear: cannot be calculated',
            aType: 'Outcome',
            aPlateau: 'Plateau found',
            aDilemma: 'No plateau: masking dilemma',
            aLimit: 'No plateau: no response at the equipment limit',
            aThr: ['Masked air-conduction threshold (dB HL)', 'Masked bone-conduction threshold (dB HL)'],
            check: 'CHECK',
            fill: 'Fill in the empty fields first.',
            feedback: 'Evaluation',
            waiting: 'Look for the plateau, enter your answers and<br>press “CHECK”.',
            fbOk: 'All correct!', fbBad: n => `${n} answer${n > 1 ? 's are' : ' is'} wrong. Review the solution.`,
            correctIs: 'Correct answer',
            solution: 'Solution',
            next: 'Next scenario', retry: 'Try again',
            exMbsAC: (a, m) => `IML = AC(non-test) + 10 = ${a} + 10 = <b>${m} dB</b>.`,
            exMbsBC: (a, oe, m, why) => `IML = AC(non-test) + 10 + OE = ${a} + 10 + ${oe} = <b>${m} dB</b> (${why}).`,
            oeWhy: {
                gap: 'air-bone gap in the masked ear, OE = 0',
                supra: (f, oe) => `${f} Hz, supra-aural earphone: OE = ${oe}`,
                insert: (f, oe) => `${f} Hz, insert earphone: OE = ${oe}`
            },
            exOverBone: (bc, ia, v) => `M<sub>max</sub> = masked BC(test) + IA = ${bc} + ${ia} = <b>${v} dB</b>. Overmasking starts above this level.`,
            exOverLater: 'The overmasking level needs this ear’s masked bone threshold; it is worked out in the bone-conduction step. Meanwhile the plateau method shows overmasking anyway: the threshold starts to rise again as the noise goes up.',
            exAirCheck: (f, l, v) => `The plateau in the air step covered masker levels ${f}–${l} dB and stayed below this limit (${v} dB), so the air threshold is reliable.`,
            exAirCheckNo: 'No plateau was found in the air step; this limit explains why.',
            exOverAC: (bc, ia, v) => `M<sub>max</sub> = BC(test) + IA = ${bc} + ${ia} = <b>${v} dB</b>. Overmasking starts above this level.`,
            exOverACna: 'There is no masked bone response in the test ear; with no cochlear response for the noise to mask, overmasking is not expected.',
            exOverBC: (bc, ia, v) => `In theory: unmasked BC + IA = ${bc} + ${ia} = <b>${v} dB</b>. This is the safest (lowest) limit you can use before knowing which cochlea the unmasked bone threshold belongs to.`,
            exOverBCactual: (bc, ia, v) => `Once the masked threshold is known, the actual limit is ${bc} + ${ia} = ${v} dB.`,
            exLimitNoise: n => ` The masker limit of the audiometer is ${n} dB, so overmasking is not seen in this scenario.`,
            exShadow: (t, u, f) => `The masked threshold is <b>${t} dB HL</b>. The unmasked response at ${u} dB HL came from the non-test ear (cross hearing); once the masker reached ${f} dB that ear was taken out and the threshold stabilised.`,
            exNoShift: t => `The masked threshold is <b>${t} dB HL</b>. The threshold did not shift as the masker went up: the unmasked threshold already belonged to the test ear.`,
            exWidth: (f, l, w) => `Plateau: masker range ${f}–${l} dB (${w} dB wide).`,
            exDilemma: (m, o) => `The threshold never stayed constant over a masker range of at least 15 dB. IML = ${m} dB, overmasking level = ${o} dB: by the time the masker is sufficient it already crosses to the test ear. This is the <b>masking dilemma</b>.`,
            exDilemma2: 'It occurs when the non-test ear (usually both ears) has an air-bone gap. Solutions: insert earphones (higher IA) or the SAL test.',
            exDilemmaTrue: t => `The true threshold in the simulation was ${t} dB HL, but without a plateau it cannot be confirmed.`,
            exDead: max => `The threshold shifted by the same amount as the masker and the response disappeared when the signal reached the equipment limit (${max} dB HL). All unmasked responses belonged to the non-test ear (shadow curve). There is no measurable threshold in the test ear; the masked “no response” symbol is recorded.`,
            exNoiseLimit: n => `The masker limit of the audiometer (${n} dB) was reached before a sufficient masking level; no reliable plateau could be obtained.`,
            typeName: { plateau: 'Plateau found', dilemma: 'Masking dilemma', limit: 'No response at the equipment limit' },
            item: { mbs: 'IML', over: 'Overmasking', type: 'Outcome', thr: 'Masked threshold' }
        }
    };
    const T = STR[LANG];

    /* ---------- State ---------- */
    const state = {
        caseData: CASES[0],
        transducer: CASES[0].transducer,
        steps: [],           // masking steps of this case, air first then bone
        phase: 'decide',     // 'decide' → 'step'
        picks: {},           // decision answers, key = ear + mode (e.g. 'Rac')
        decided: false,
        stepIdx: 0,
        results: [],         // per step: { res, own, type }
        tone: 0,
        noise: 0,
        noiseOn: false,
        log: [],             // { m: number|null, l: number, heard: boolean }
        last: null,
        checked: false       // current step checked
    };
    let sol = null;          // solution of the current (or first) step

    const root = document.getElementById('ml-app');
    const $ = sel => root.querySelector(sel);
    const earClass = ear => (ear === 'R' ? 'ml-ear-r' : 'ml-ear-l');
    const KEYS = ['Rac', 'Lac', 'Rbc', 'Lbc'];
    const stepName = st => `${T.earCap[st.ear]} ${T.modeShort[st.mode]}`;
    const current = () => (state.phase === 'step' ? state.steps[state.stepIdx] : null);

    function caseLabel(c) {
        if (c.id === 'RND') return T.random;
        if (T.presetName[c.id]) return T.presetName[c.id];
        const plain = CASES.filter(p => !T.presetName[p.id]);
        return T.caseN(plain.indexOf(c) + 1);
    }

    function build() {
        const opts = CASES.map(c => `<option value="${c.id}">${caseLabel(c)}</option>`).join('');
        root.innerHTML = `
            ${headerHTML({
                title: T.title, subtitle: T.subtitle, altHref: T.altHref,
                extra: `<a class="ml-link" href="${T.prevHref}"><i class="fas fa-arrow-left" aria-hidden="true"></i> ${T.prev}</a>`
            })}
            <div class="ml-plateau">
                <div class="ml-top">
                    <section class="ml-panel" id="meter">
                        <h2><i class="fas fa-sliders" aria-hidden="true"></i> ${T.audiometer}</h2>
                        <div class="ml-audiometer">
                            <div class="ml-channel">
                                <div class="ml-channel-title">${T.tone}</div>
                                <div class="ml-channel-target" id="toneTarget"></div>
                                <div class="ml-level" id="toneLevel"></div>
                                <input type="range" id="toneSlider" step="5" aria-label="${T.tone}">
                                <div class="ml-steps">
                                    <button type="button" class="ml-btn" data-tone="-5">−5</button>
                                    <button type="button" class="ml-btn" data-tone="5">+5</button>
                                </div>
                            </div>
                            <div class="ml-channel">
                                <div class="ml-channel-title">${T.noise}</div>
                                <div class="ml-channel-target" id="noiseTarget"></div>
                                <div class="ml-level" id="noiseLevel"></div>
                                <input type="range" id="noiseSlider" min="0" max="${LIM.noiseMax}" step="5" aria-label="${T.noise}">
                                <div class="ml-steps">
                                    <button type="button" class="ml-btn" data-noise="-10">−10</button>
                                    <button type="button" class="ml-btn" data-noise="-5">−5</button>
                                    <button type="button" class="ml-btn" data-noise="5">+5</button>
                                    <button type="button" class="ml-btn" data-noise="10">+10</button>
                                </div>
                                <button type="button" class="ml-btn ml-btn--ghost" id="noiseToggle" style="width:100%;margin-top:6px"></button>
                            </div>
                        </div>
                        <div class="ml-present">
                            <button type="button" class="ml-btn ml-btn--present" id="presentBtn"><i class="fas fa-volume-high" aria-hidden="true"></i> ${T.present}</button>
                            <div class="ml-lamp" id="lamp" aria-live="polite"></div>
                        </div>
                    </section>
                    <section class="ml-panel">
                        <h2><i class="fas fa-chart-line" aria-hidden="true"></i> ${T.audiogram} <span id="stripFreq"></span></h2>
                        <svg class="ml-strip" id="strip" role="img" aria-label="${T.audiogram}"></svg>
                        <div class="ml-legend" id="stripLegend"></div>
                    </section>
                    <section class="ml-panel ml-panel--chart">
                        <h2><i class="fas fa-chart-area" aria-hidden="true"></i> ${T.chart}</h2>
                        <svg class="ml-chart" id="chart" role="img" aria-label="${T.chart}"></svg>
                        <div class="ml-legend" id="chartLegend"></div>
                    </section>
                </div>
                <div class="ml-bottom">
                    <div class="ml-col">
                        <section class="ml-panel">
                            <h2><i class="fas fa-user-doctor" aria-hidden="true"></i> ${T.scenario}</h2>
                            <select class="ml-select" id="scenario" aria-label="${T.scenario}">
                                ${opts}
                                <option value="RND" hidden>${T.random}</option>
                            </select>
                            <div class="ml-btn-row" style="margin-top:10px">
                                <button type="button" class="ml-btn" id="rndBtn"><i class="fas fa-shuffle" aria-hidden="true"></i> ${T.random}</button>
                            </div>
                            <span class="ml-field-label" style="margin-top:14px">${T.transducer}</span>
                            <div class="ml-toggle" id="transducer">
                                <button type="button" data-type="supra">${T.supra}</button>
                                <button type="button" data-type="insert">${T.insert}</button>
                            </div>
                        </section>
                        <section class="ml-panel">
                            <h2><i class="fas fa-bullseye" aria-hidden="true"></i> ${T.task}</h2>
                            <div class="ml-task" id="task"></div>
                        </section>
                    </div>
                    <div class="ml-col">
                        <section class="ml-panel">
                            <h2><i class="fas fa-table-list" aria-hidden="true"></i> ${T.log}</h2>
                            <div class="ml-log-wrap" id="logWrap"></div>
                            <button type="button" class="ml-btn ml-btn--ghost" id="clearBtn" style="margin-top:8px"><i class="fas fa-eraser" aria-hidden="true"></i> ${T.clear}</button>
                        </section>
                    </div>
                    <div class="ml-col">
                        <section class="ml-panel ml-panel--dark">
                            <h2><i class="fas fa-pen-to-square" aria-hidden="true"></i> <span id="answerTitle"></span></h2>
                            <div id="decideForm">
                                ${KEYS.map(k => `
                                    <button type="button" class="ml-option ${k[0] === 'R' ? 'is-right' : 'is-left'}" data-key="${k}" aria-pressed="false">
                                        <span>${T.opt[k]}</span><i class="far fa-square" aria-hidden="true"></i>
                                    </button>`).join('')}
                                <p class="ml-note" style="color:#cbd5e1;margin:4px 0 12px">${T.decideHint}</p>
                                <button type="button" class="ml-btn ml-btn--primary" id="decideBtn">${T.check}</button>
                            </div>
                            <div id="stepForm">
                                <div class="ml-answer-fields">
                                    <div id="mbsWrap">
                                        <label for="aMbs">${T.aMbs}</label>
                                        <input class="ml-input" id="aMbs" type="number" step="5" inputmode="numeric">
                                    </div>
                                    <div id="overWrap">
                                        <label for="aOver">${T.aOver}</label>
                                        <input class="ml-input" id="aOver" type="number" step="5" inputmode="numeric">
                                    </div>
                                </div>
                                <p class="ml-note" id="overLater" style="color:#cbd5e1;margin:0 0 10px">${T.overLater}</p>
                                <span class="ml-field-label" style="color:#cbd5e1">${T.aType}</span>
                                <label class="ml-radio"><input type="radio" name="aType" value="plateau" checked> <span>${T.aPlateau}</span></label>
                                <label class="ml-radio"><input type="radio" name="aType" value="dilemma"> <span>${T.aDilemma}</span></label>
                                <label class="ml-radio"><input type="radio" name="aType" value="limit"> <span>${T.aLimit}</span></label>
                                <div class="ml-answer-fields">
                                    <div class="full">
                                        <label for="aThr" id="aThrLabel"></label>
                                        <input class="ml-input" id="aThr" type="number" step="5" inputmode="numeric">
                                    </div>
                                </div>
                                <button type="button" class="ml-btn ml-btn--primary" id="checkBtn">${T.check}</button>
                                <p class="ml-note" id="fillNote" style="color:#fca5a5;margin:8px 0 0" hidden>${T.fill}</p>
                            </div>
                        </section>
                        <section class="ml-panel">
                            <h2><i class="fas fa-clipboard-check" aria-hidden="true"></i> ${T.feedback}</h2>
                            <div id="feedback" aria-live="polite"></div>
                        </section>
                    </div>
                </div>
                <details class="ml-panel ml-rules">
                    <summary>${T.method}</summary>
                    ${T.methodBody}
                </details>
            </div>`;

        $('#scenario').addEventListener('change', e => {
            const c = CASES.find(p => p.id === e.target.value);
            if (c) loadCase(c);
        });
        $('#rndBtn').addEventListener('click', () => loadCase(randomCase(state.transducer)));
        $('#transducer').addEventListener('click', e => {
            const btn = e.target.closest('button[data-type]');
            if (!btn || btn.dataset.type === state.transducer) return;
            state.transducer = btn.dataset.type;
            resetCase();
        });
        root.querySelectorAll('.ml-option').forEach(b => b.addEventListener('click', () => {
            if (state.decided) return;
            state.picks[b.dataset.key] = !state.picks[b.dataset.key];
            renderDecide();
        }));
        $('#decideBtn').addEventListener('click', checkDecision);
        root.querySelectorAll('[data-tone]').forEach(b => b.addEventListener('click', () => setTone(state.tone + Number(b.dataset.tone))));
        root.querySelectorAll('[data-noise]').forEach(b => b.addEventListener('click', () => setNoise((state.noiseOn ? state.noise : 0) + Number(b.dataset.noise))));
        $('#toneSlider').addEventListener('input', e => setTone(Number(e.target.value)));
        $('#noiseSlider').addEventListener('input', e => setNoise(Number(e.target.value)));
        $('#noiseToggle').addEventListener('click', () => {
            state.noiseOn = !state.noiseOn;
            state.last = null;
            renderAudiometer();
            drawChart();
        });
        $('#presentBtn').addEventListener('click', present);
        $('#clearBtn').addEventListener('click', () => {
            state.log = [];
            state.last = null;
            renderAudiometer();
            renderLog();
            drawChart();
        });
        root.querySelectorAll('input[name="aType"]').forEach(r => r.addEventListener('change', () => { syncAnswerFields(); renderStrip(); }));
        $('#aThr').addEventListener('input', renderStrip);
        $('#checkBtn').addEventListener('click', check);
    }

    /* ---------- Actions ---------- */
    function loadCase(c) {
        state.caseData = c;
        state.transducer = c.transducer;
        resetCase();
    }

    function resetCase() {
        state.steps = caseSteps(state.caseData, state.transducer);
        state.phase = 'decide';
        state.picks = {};
        state.decided = false;
        state.stepIdx = 0;
        state.results = [];
        // Before the decision the audiometer is locked; the chart shows the first step's scale.
        const first = state.steps[0];
        sol = first ? first.sol : solve(Object.assign({}, state.caseData, { test: 'R', mode: 'ac' }), state.transducer);
        resetStep();
    }

    function goStep(i) {
        state.phase = 'step';
        state.stepIdx = i;
        sol = state.steps[i].sol;
        state.results[i] = null;
        resetStep();
    }

    function resetStep() {
        state.tone = sol.unmasked === NR ? sol.toneMax : sol.unmasked;
        state.noise = 0;
        state.noiseOn = false;
        state.log = [];
        state.last = null;
        state.checked = false;
        if (state.phase === 'step') state.results[state.stepIdx] = null;
        ['aMbs', 'aOver', 'aThr'].forEach(id => {
            const input = $('#' + id);
            input.value = '';
            input.classList.remove('is-ok', 'is-bad');
        });
        root.querySelector('input[name="aType"][value="plateau"]').checked = true;
        $('#fillNote').hidden = true;
        renderAll();
    }

    function setTone(value) {
        state.tone = Math.max(LIM.toneMin, Math.min(sol.toneMax, value));
        state.last = null;
        renderAudiometer();
        renderStrip();
        drawChart();
    }

    function setNoise(value) {
        state.noise = Math.max(0, Math.min(LIM.noiseMax, value));
        state.noiseOn = true;
        state.last = null;
        renderAudiometer();
        drawChart();
    }

    function present() {
        if (state.phase !== 'step') return;
        const heard = state.tone >= sol.thr(state.noiseOn ? state.noise : OFF);
        state.log.push({ m: state.noiseOn ? state.noise : null, l: state.tone, heard: heard });
        state.last = heard;
        renderAudiometer();
        const lamp = $('#lamp');
        lamp.classList.remove('is-flash');
        void lamp.offsetWidth;      // restart the flash animation
        lamp.classList.add('is-flash');
        renderLog();
        drawChart();
    }

    function checkDecision() {
        state.decided = true;
        renderDecide();
        renderTask();
        renderFeedback();
    }

    function answerType() {
        return root.querySelector('input[name="aType"]:checked').value;
    }

    function syncAnswerFields() {
        const st = current();
        const bone = !!st && st.mode === 'bc';
        $('#aThr').disabled = answerType() !== 'plateau';
        $('#overWrap').hidden = !bone;
        $('#overLater').hidden = bone;
        $('#aOver').disabled = !bone || answerType() !== 'plateau';
    }

    function check() {
        const st = current();
        if (!st) return;
        const type = answerType();
        const bone = st.mode === 'bc';
        const raw = { mbs: $('#aMbs').value.trim(), over: $('#aOver').value.trim(), thr: $('#aThr').value.trim() };
        const missing = raw.mbs === '' || (type === 'plateau' && (raw.thr === '' || (bone && raw.over === '')));
        $('#fillNote').hidden = !missing;
        if (missing) return;

        const res = { type: type === sol.type, mbs: Number(raw.mbs) === sol.mbs };
        if (sol.type === 'plateau') res.thr = type === 'plateau' && Number(raw.thr) === sol.trueThr;
        // Overmasking needs the masked bone threshold, so it is asked in the bone step only.
        if (bone && sol.type === 'plateau' && type === 'plateau') res.over = Number(raw.over) === sol.overActual;
        state.checked = true;
        state.results[state.stepIdx] = { res: res, type: type, own: type === 'plateau' ? Number(raw.thr) : null };

        const mark = (id, ok) => {
            const input = $('#' + id);
            input.classList.toggle('is-ok', ok === true);
            input.classList.toggle('is-bad', ok === false);
        };
        mark('aMbs', res.mbs);
        mark('aOver', res.over);
        mark('aThr', type === 'plateau' ? (sol.type === 'plateau' ? res.thr : false) : undefined);
        renderTask();
        renderStrip();
        drawChart();
        renderFeedback();
    }

    /* ---------- Rendering ---------- */
    function renderAll() {
        $('#scenario').value = state.caseData.id;
        root.querySelectorAll('#transducer button').forEach(b => {
            b.setAttribute('aria-pressed', String(b.dataset.type === state.transducer));
        });
        $('#toneSlider').min = LIM.toneMin;
        $('#toneSlider').max = sol.toneMax;
        const st = current();
        $('#decideForm').hidden = state.phase !== 'decide';
        $('#stepForm').hidden = state.phase !== 'step';
        $('#answerTitle').textContent = st ? `${T.answer} · ${stepName(st)}` : T.decideTitle;
        if (st) $('#aThrLabel').textContent = T.aThr[st.mode === 'ac' ? 0 : 1];
        syncAnswerFields();
        renderDecide();
        renderTask();
        renderStrip();
        renderAudiometer();
        renderLog();
        drawChart();
        renderFeedback();
    }

    function renderDecide() {
        const need = state.caseData && needsOf(state.caseData, state.transducer).need;
        root.querySelectorAll('.ml-option').forEach(btn => {
            const k = btn.dataset.key;
            const sel = !!state.picks[k];
            btn.setAttribute('aria-pressed', String(sel));
            btn.disabled = state.decided;
            btn.classList.toggle('res-correct', state.decided && sel === need[k] && need[k]);
            btn.classList.toggle('res-incorrect', state.decided && sel !== need[k]);
            btn.querySelector('i').className = sel ? 'fas fa-square-check' : 'far fa-square';
        });
        $('#decideBtn').disabled = state.decided;
    }

    function maskedCell(ear, mode) {
        const i = state.steps.findIndex(s => s.ear === ear && s.mode === mode);
        if (i === -1) return '—';
        const r = state.results[i];
        if (!r) return '?';
        const s = state.steps[i].sol;
        if (s.type === 'plateau') return String(s.trueThr);
        if (s.trueThr === NR) return fmtDb(NR);
        return T.dilemmaShort;
    }

    function renderTask() {
        const c = state.caseData;
        const st = current();
        const n = needsOf(c, state.transducer);
        const row = (label, r, l) => `<tr><td>${label}</td><td class="ml-ear-r">${r}</td><td class="ml-ear-l">${l}</td></tr>`;
        const showMasked = state.phase === 'step';
        const chips = [`<li class="${state.phase === 'decide' ? 'is-active' : 'is-done'}">1 · ${T.stepDecide}</li>`]
            .concat(state.steps.map((s, i) => {
                const cls = state.phase !== 'step' ? '' : i < state.stepIdx || (i === state.stepIdx && state.checked) ? 'is-done' : i === state.stepIdx ? 'is-active' : '';
                const label = state.decided ? stepName(s) : '?';
                return `<li class="${cls}">${i + 2} · ${label}</li>`;
            }));
        $('#task').innerHTML = `
            <ol class="ml-stepper">${state.decided ? chips.join('') : chips[0]}</ol>
            <dl>
                <dt>${T.tFreq}</dt><dd>${c.freq} Hz</dd>
                <dt>${T.tPhone}</dt><dd>${T.phone[state.transducer]}</dd>
                ${st ? `<dt>${T.tTest}</dt><dd><span class="${earClass(st.ear)}">${T.earCap[st.ear]}</span> · ${T.modeLow[st.mode]}</dd>
                <dt>${T.tMask}</dt><dd><span class="${earClass(sol.other)}">${T.maskTo(T.earCap[sol.other])}</span></dd>` : `<dt>${T.tTest}</dt><dd>${T.decideFirst}</dd>`}
            </dl>
            <table class="ml-thr-table">
                <thead><tr><th>${T.thrTitle}</th><th class="ml-ear-r">${T.earCap.R}</th><th class="ml-ear-l">${T.earCap.L}</th></tr></thead>
                <tbody>
                    ${row(T.rowAC, fmtDb(n.acUnm.R), fmtDb(n.acUnm.L))}
                    ${row(T.rowBC, fmtDb(n.bcUnm), fmtDb(n.bcUnm))}
                    ${showMasked ? row(T.rowACm, maskedCell('R', 'ac'), maskedCell('L', 'ac')) : ''}
                    ${showMasked ? row(T.rowBCm, maskedCell('R', 'bc'), maskedCell('L', 'bc')) : ''}
                </tbody>
            </table>`;
    }

    function renderStrip() {
        const c = state.caseData;
        const n = needsOf(c, state.transducer);
        const symbols = [];
        const add = (kind, db, extra) => symbols.push(Object.assign(db === NR ? { kind: kind, nr: true } : { kind: kind, db: db }, extra));
        const glyph = { acR: 'O', acL: 'X', bcR: '&lt;', bcL: '&gt;', acmR: '△', acmL: '□', bcmR: '[', bcmL: ']' };
        const item = (k, text, cls) => `<span${cls ? ` class="${cls}"` : ''}><b class="${k.slice(-1) === 'R' ? 'r' : 'l'}">${glyph[k] || '◯'}</b>${text}</span>`;
        const items = ['acR', 'bcR', 'acL', 'bcL'].map(k => item(k, T.legend[k]));

        if (n.bcUnm !== NR) { add('bcR', n.bcUnm); add('bcL', n.bcUnm); }
        add('acR', n.acUnm.R);
        add('acL', n.acUnm.L);

        // Masked thresholds: the student's own value solid, the true value pale once checked.
        if (state.phase === 'step') {
            state.steps.forEach((s, i) => {
                if (i > state.stepIdx) return;
                const kind = (s.mode === 'ac' ? 'acm' : 'bcm') + s.ear;
                const r = state.results[i];
                let own = null;
                if (r) own = r.own;
                else if (i === state.stepIdx) {
                    const v = $('#aThr').value.trim();
                    if (v !== '' && !$('#aThr').disabled && !isNaN(Number(v))) own = Number(v);
                }
                const exact = !!r && own !== null && own === s.sol.trueThr;
                if (own !== null) {
                    add(kind, Math.max(LIM.toneMin, Math.min(s.sol.toneMax, own)));
                    items.push(item(kind, `${T.legend[kind]} · ${exact ? T.lgOwnOk : T.lgOwn}`));
                }
                if (r && !exact && (s.sol.type === 'plateau' || s.sol.trueThr === NR)) {
                    add(kind, s.sol.trueThr, { faint: true });
                    items.push(item(kind, `${T.legend[kind]} · ${T.lgTrue}`, 'is-faint'));
                }
            });
            const st = current();
            if (!state.checked) {
                add('stim' + st.ear, state.tone, { bone: st.mode === 'bc' });
                items.push(item('stim' + st.ear, T.lgStim, 'is-faint'));
            }
        }

        drawStrip($('#strip'), { labels: { right: T.earCap.R.toUpperCase(), left: T.earCap.L.toUpperCase() }, symbols: symbols, fontScale: 1.8 });
        $('#stripFreq').textContent = '· ' + c.freq + ' Hz';
        $('#stripLegend').innerHTML = items.join('');
    }

    function renderAudiometer() {
        const st = current();
        const locked = !st;
        $('#toneTarget').innerHTML = st ? `<span class="${earClass(st.ear)}">${T.toneTo(T.earCap[st.ear], T.modeLow[st.mode])}</span>` : '—';
        $('#noiseTarget').innerHTML = st ? `<span class="${earClass(sol.other)}">${T.noiseTo(T.earCap[sol.other])}</span>` : '—';
        $('#toneLevel').innerHTML = `${state.tone}<small>dB HL</small>`;
        $('#toneSlider').value = state.tone;
        const noiseLevel = $('#noiseLevel');
        noiseLevel.classList.toggle('is-off', !state.noiseOn);
        noiseLevel.innerHTML = state.noiseOn ? `${state.noise}<small>dB</small>` : T.off;
        $('#noiseSlider').value = state.noiseOn ? state.noise : 0;
        $('#noiseToggle').textContent = state.noiseOn ? T.noiseOff : T.noiseOn;
        root.querySelectorAll('#meter button, #meter input').forEach(el => { el.disabled = locked; });
        if (!locked) {
            root.querySelector('[data-tone="-5"]').disabled = state.tone <= LIM.toneMin;
            root.querySelector('[data-tone="5"]').disabled = state.tone >= sol.toneMax;
        }
        $('#meter').classList.toggle('is-locked', locked);

        const lamp = $('#lamp');
        lamp.classList.toggle('is-yes', state.last === true);
        lamp.classList.toggle('is-no', state.last === false);
        if (!st) lamp.innerHTML = `<i class="fas fa-lock" aria-hidden="true"></i> ${T.lampLocked}`;
        else if (state.last === null) lamp.innerHTML = `<i class="far fa-circle" aria-hidden="true"></i> ${T.lampIdle}`;
        else if (state.last) lamp.innerHTML = `<i class="fas fa-hand" aria-hidden="true"></i> ${T.lampYes}`;
        else lamp.innerHTML = `<i class="fas fa-ban" aria-hidden="true"></i> ${T.lampNo}`;
    }

    function renderLog() {
        const wrap = $('#logWrap');
        if (!state.log.length) {
            wrap.innerHTML = `<div class="ml-placeholder" style="min-height:90px"><p>${T.logEmpty}</p></div>`;
            return;
        }
        wrap.innerHTML = `
            <table class="ml-log">
                <thead><tr><th>${T.logM}</th><th>${T.logL}</th><th>${T.logR}</th></tr></thead>
                <tbody>
                    ${state.log.map(e => `
                        <tr class="${e.heard ? 'is-plus' : 'is-minus'}">
                            <td>${e.m === null ? T.chartOff : e.m}</td><td>${e.l}</td><td>${e.heard ? '+' : '−'}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
        wrap.scrollTop = wrap.scrollHeight;
    }

    const C = { w: 560, h: 480, l: 76, r: 14, t: 18, b: 68 };
    const FS = 1.75;   // chart text scale, sized for projection
    function drawChart() {
        const el = $('#chart');
        el.setAttribute('viewBox', `0 0 ${C.w} ${C.h}`);
        el.replaceChildren();
        const yMin = LIM.toneMin, yMax = sol.toneMax;
        const xOff = C.l + 20, x0 = C.l + 58, x1 = C.w - C.r - 12;
        const bottom = C.h - C.b;
        const X = m => (m === null ? xOff : x0 + m / LIM.noiseMax * (x1 - x0));
        const Y = db => bottom - (db - yMin) / (yMax - yMin) * (bottom - C.t);
        const half = (x1 - x0) / LIM.noiseMax * 2.5;

        el.appendChild(svg('rect', { x: C.l, y: C.t, width: C.w - C.l - C.r, height: bottom - C.t, fill: '#fff', stroke: '#e2e8f0', 'stroke-width': 1.5, rx: 6 }));

        // Solution band (after checking)
        const showSol = state.checked;
        if (showSol && sol.type === 'plateau') {
            el.appendChild(svg('rect', { x: X(sol.first) - half, y: C.t + 1, width: X(sol.last) - X(sol.first) + 2 * half, height: bottom - C.t - 2, fill: '#dcfce7' }));
        }

        for (let db = Math.ceil(yMin / 10) * 10; db <= yMax; db += 10) {
            el.appendChild(svg('line', { x1: C.l, x2: C.w - C.r, y1: Y(db), y2: Y(db), stroke: '#eef2f7' }));
            el.appendChild(svg('text', { x: C.l - 6, y: Y(db) + 6, 'text-anchor': 'end', 'font-size': 11 * FS, fill: '#64748b' }, String(db)));
        }
        for (let m = 0; m <= LIM.noiseMax; m += 10) {
            el.appendChild(svg('line', { x1: X(m), x2: X(m), y1: C.t, y2: bottom, stroke: '#eef2f7' }));
            el.appendChild(svg('text', { x: X(m), y: bottom + 24, 'text-anchor': 'middle', 'font-size': 11 * FS, fill: '#64748b' }, String(m)));
        }
        el.appendChild(svg('line', { x1: (xOff + x0) / 2 - 4, x2: (xOff + x0) / 2 - 4, y1: C.t, y2: bottom, stroke: '#cbd5e1', 'stroke-dasharray': '3 4' }));
        el.appendChild(svg('text', { x: xOff, y: bottom + 24, 'text-anchor': 'middle', 'font-size': 10 * FS, fill: '#64748b' }, T.chartOff));
        el.appendChild(svg('text', { x: (x0 + x1) / 2, y: C.h - 8, 'text-anchor': 'middle', 'font-size': 12 * FS, 'font-weight': 600, fill: '#64748b' }, T.chartX));
        el.appendChild(svg('text', { x: 20, y: (C.t + bottom) / 2, 'text-anchor': 'middle', 'font-size': 12 * FS, 'font-weight': 600, fill: '#64748b', transform: `rotate(-90 20 ${(C.t + bottom) / 2})` }, T.chartY));

        if (showSol) {
            const pts = [];
            for (let m = 0; m <= LIM.noiseMax; m += 5) {
                const t = sol.thr(m);
                if (t === NR) {
                    el.appendChild(svg('path', { d: `M${X(m) - 5} ${C.t + 12}L${X(m)} ${C.t + 4}L${X(m) + 5} ${C.t + 12}Z`, fill: '#0f766e' }));
                } else pts.push(`${X(m)},${Y(t)}`);
            }
            if (pts.length > 1) el.appendChild(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: '#0f766e', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
            if (sol.type === 'plateau') {
                const label = (text, xa, xb, y) => {
                    if (xb - xa < 62 * FS) return;
                    el.appendChild(svg('text', { x: (xa + xb) / 2, y: y, 'text-anchor': 'middle', 'font-size': 10 * FS, 'font-weight': 700, fill: '#0f766e' }, text));
                };
                // The curve runs below the plateau level while undermasking and above it while
                // overmasking, so the labels go on the free side of the line.
                const above = Math.max(C.t + 12, Y(sol.trueThr) - 12);
                const below = Math.min(bottom - 8, Y(sol.trueThr) + 24);
                label(T.plateau, X(sol.first) - half, X(sol.last) + half, above);
                label(T.under, X(0) - half, X(sol.first) - half, above);
                label(T.over, X(sol.last) + half, X(LIM.noiseMax) + half, below);
            }
        }

        // Student's own threshold line: lowest level with a response at each masker level
        const lowest = new Map();
        state.log.forEach(e => {
            if (!e.heard) return;
            const key = e.m === null ? -1 : e.m;
            if (!lowest.has(key) || e.l < lowest.get(key)) lowest.set(key, e.l);
        });
        const keys = Array.from(lowest.keys()).filter(k => k >= 0).sort((a, b) => a - b);
        if (keys.length > 1) {
            el.appendChild(svg('polyline', { points: keys.map(k => `${X(k)},${Y(lowest.get(k))}`).join(' '), fill: 'none', stroke: '#475569', 'stroke-width': 1.5, 'stroke-dasharray': '2 3' }));
        }
        state.log.forEach(e => {
            if (e.heard) el.appendChild(svg('circle', { cx: X(e.m), cy: Y(e.l), r: 4.6, fill: '#16a34a', stroke: '#fff', 'stroke-width': 1 }));
            else el.appendChild(svg('circle', { cx: X(e.m), cy: Y(e.l), r: 4, fill: '#fff', stroke: '#dc2626', 'stroke-width': 1.8 }));
        });

        // Current audiometer setting
        const cxp = X(state.noiseOn ? state.noise : null), cyp = Y(state.tone);
        el.appendChild(svg('line', { x1: cxp, x2: cxp, y1: cyp, y2: bottom, stroke: '#f59e0b', 'stroke-dasharray': '3 3' }));
        el.appendChild(svg('line', { x1: C.l, x2: cxp, y1: cyp, y2: cyp, stroke: '#f59e0b', 'stroke-dasharray': '3 3' }));
        el.appendChild(svg('circle', { cx: cxp, cy: cyp, r: 8.5, fill: 'none', stroke: '#f59e0b', 'stroke-width': 2.2 }));

        const dot = (fill, stroke) => `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="4.2" fill="${fill}" stroke="${stroke}" stroke-width="1.8"/></svg>`;
        $('#chartLegend').innerHTML =
            `<span>${dot('#16a34a', '#16a34a')} ${T.lgHeard}</span>` +
            `<span>${dot('#fff', '#dc2626')} ${T.lgNot}</span>` +
            `<span>${dot('none', '#f59e0b')} ${T.lgCur}</span>` +
            (showSol ? `<span><b style="color:#0f766e">━</b>${T.lgSol}</span>` : '') +
            (showSol && sol.type === 'plateau' ? `<span><b style="color:#86efac">■</b>${T.lgBand}</span>` : '');
    }


    function renderFeedback() {
        const box = $('#feedback');
        if (state.phase === 'decide') { renderDecisionFeedback(box); return; }
        if (!state.checked) {
            box.innerHTML = `<div class="ml-placeholder"><i class="far fa-clock" aria-hidden="true"></i><p>${T.waiting}</p></div>`;
            return;
        }
        const st = current();
        const c = state.caseData;
        const res = state.results[state.stepIdx].res;
        const items = [];
        const add = (key, ok, correct) => items.push(
            `<li><i class="fas ${ok ? 'fa-check ok' : 'fa-xmark bad'}" aria-hidden="true"></i>
                 <span>${T.item[key]}: ${ok ? '' : T.correctIs + ' '}<b>${correct}</b></span></li>`);
        add('mbs', res.mbs, sol.mbs + ' dB');
        if (res.over !== undefined) add('over', res.over, sol.overActual + ' dB');
        add('type', res.type, T.typeName[sol.type]);
        if (sol.type === 'plateau') add('thr', res.thr, sol.trueThr + ' dB HL');
        const wrong = Object.keys(res).filter(k => res[k] === false).length;

        // Explanation
        const ex = [];
        const nteAc = sol.acUnm[sol.other];
        if (st.mode === 'ac') {
            ex.push(T.exMbsAC(nteAc, sol.mbs));
            ex.push(T.exOverLater);
        } else {
            const why = sol.nteGap > 10 ? T.oeWhy.gap : T.oeWhy[state.transducer](c.freq, sol.oe);
            ex.push(T.exMbsBC(nteAc, sol.oe, sol.mbs, why));
            if (sol.trueThr === NR) ex.push(T.exOverACna);
            else {
                let over = T.exOverBone(sol.trueThr, sol.ia, sol.overActual) + (sol.overActual > LIM.noiseMax ? T.exLimitNoise(LIM.noiseMax) : '');
                // The same limit applies to the air-conduction step of this ear, done earlier.
                const airStep = state.steps.find(s => s.ear === st.ear && s.mode === 'ac');
                if (airStep && sol.type === 'plateau') {
                    const a = airStep.sol;
                    over += ' ' + (a.type === 'plateau' ? T.exAirCheck(a.first, a.last, sol.overActual) : T.exAirCheckNo);
                }
                ex.push(over);
            }
        }
        if (sol.type === 'plateau') {
            ex.push(sol.trueThr === sol.unmasked ? T.exNoShift(sol.trueThr) : T.exShadow(sol.trueThr, sol.unmasked, sol.first));
            ex.push(T.exWidth(sol.first, sol.last, sol.width));
        } else if (sol.type === 'dilemma') {
            ex.push(T.exDilemma(sol.mbs, sol.overActual));
            ex.push(T.exDilemma2);
            ex.push(T.exDilemmaTrue(sol.trueThr));
        } else if (sol.trueThr === NR) {
            ex.push(T.exDead(sol.toneMax));
        } else {
            ex.push(T.exNoiseLimit(LIM.noiseMax));
        }

        const last = state.stepIdx === state.steps.length - 1;
        box.innerHTML = `
            <div class="ml-alert ${wrong === 0 ? 'ml-alert--ok' : 'ml-alert--warn'}">
                <i class="fas ${wrong === 0 ? 'fa-circle-check' : 'fa-triangle-exclamation'}" aria-hidden="true"></i>
                <span>${wrong === 0 ? T.fbOk : T.fbBad(wrong)}</span>
            </div>
            <ul class="ml-check-list">${items.join('')}</ul>
            <div class="ml-explain">
                <h3>${T.solution}</h3>
                <ul>${ex.map(e => `<li>${e}</li>`).join('')}</ul>
            </div>
            ${last ? `<p class="ml-note" style="margin-top:12px"><b>${T.caseDone}</b></p>` : ''}
            <div class="ml-btn-row" style="margin-top:14px">
                <button type="button" class="ml-btn" id="retryBtn"><i class="fas fa-rotate-left" aria-hidden="true"></i> ${T.retry}</button>
                <button type="button" class="ml-btn" id="nextBtn">${last ? T.nextCase : T.nextStep(stepName(state.steps[state.stepIdx + 1]))} <i class="fas fa-arrow-right" aria-hidden="true"></i></button>
            </div>`;
        $('#retryBtn').addEventListener('click', resetStep);
        $('#nextBtn').addEventListener('click', () => (last ? nextCase() : goStep(state.stepIdx + 1)));
    }

    function renderDecisionFeedback(box) {
        if (!state.decided) {
            box.innerHTML = `<div class="ml-placeholder"><i class="far fa-clock" aria-hidden="true"></i><p>${T.decideWaiting}</p></div>`;
            return;
        }
        const n = needsOf(state.caseData, state.transducer);
        const wrong = KEYS.filter(k => !!state.picks[k] !== n.need[k]).length;
        const rules = KEYS.map(k => {
            const ear = k[0], mode = k.slice(1);
            const a = n.acUnm[ear], b = n.bcUnm;
            const ok = !!state.picks[k] === n.need[k];
            const icon = `<i class="fas ${ok ? 'fa-check ok' : 'fa-xmark bad'}" aria-hidden="true"></i>`;
            const text = (a === NR || b === NR)
                ? T.ruleNA(T.opt[k])
                : mode === 'ac' ? T.ruleAir(T.earCap[ear], a, b, a - b, n.ia, n.need[k]) : T.ruleBone(T.earCap[ear], a, b, a - b, n.need[k]);
            return `<li>${icon}<span>${text}</span></li>`;
        });
        const has = state.steps.length > 0;
        box.innerHTML = `
            <div class="ml-alert ${wrong === 0 ? 'ml-alert--ok' : 'ml-alert--warn'}">
                <i class="fas ${wrong === 0 ? 'fa-circle-check' : 'fa-triangle-exclamation'}" aria-hidden="true"></i>
                <span>${wrong === 0 ? T.decideOk : T.fbBad(wrong)}</span>
            </div>
            <ul class="ml-check-list">${rules.join('')}</ul>
            <div class="ml-explain">
                <ul><li>${has ? T.orderNote(state.steps.map(stepName).join(' → ')) : T.noMasking}</li></ul>
            </div>
            <div class="ml-btn-row" style="margin-top:14px">
                <button type="button" class="ml-btn" id="nextBtn">${has ? T.startMasking : T.nextCase} <i class="fas fa-arrow-right" aria-hidden="true"></i></button>
            </div>`;
        $('#nextBtn').addEventListener('click', () => (has ? goStep(0) : nextCase()));
    }

    function nextCase() {
        const c = state.caseData;
        if (c.id === 'RND') { loadCase(randomCase(state.transducer)); return; }
        loadCase(CASES[(CASES.indexOf(c) + 1) % CASES.length]);
    }

    window.MLPlateau = { CASES: CASES, solve: solve, needsOf: needsOf, caseSteps: caseSteps, randomCase: randomCase, NR: NR, OFF: OFF };

    build();
    loadCase(CASES[0]);
})();
