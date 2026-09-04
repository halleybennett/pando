/* Pando — phases 1–3.
   Times come from the browser's own IANA database via Intl, so daylight saving is
   applied for us and no offset table is maintained anywhere in this file. */
(function () {
  'use strict';

  var BUILD = '2026-09-04 13:49';
  var MAX = 6;
  var DB = null;
  var cities = [];          // [{name, cc, country, tz}] - index 0 is home
  var dialMins = null;      // null = following the clock ("live")
  var selMonth = null;      // null = today
  var use24 = true;
  var fine = false;         // slow-drag precision mode
  var fineTimer = null, tickTimer = null;

  var $ = function (id) { return document.getElementById(id); };
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var MON3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  /* Two hand-added places the dataset cannot supply: Aspen is below the GeoNames
     15,000 floor, and Palma is filed as bare "Palma", which nobody searches for. */
  var PINNED = [
    { name: 'Aspen', region: 'Colorado', country: 'United States',
      cc: 'US', tz: 'America/Denver', alias: 'aspen colorado' },
    { name: 'Palma de Mallorca', region: 'Baleares', country: 'Spain',
      cc: 'ES', tz: 'Europe/Madrid', alias: 'palma mallorca majorca baleares balearics' }
  ];
  function isSupplanted(name, cc) { return name === 'Palma' && cc === 'ES'; }

  /* ---------- persistence ---------- */
  /* Cities, home order and 12/24 always come back. The dial and the chosen month only
     come back if you were here within the hour - same session keeps its context, the
     next morning starts live. A frozen time under a stale month reads as a bug. */
  var LS = 'pando.v1', RESTORE_MS = 3600000, saveTimer = null, dbFail = false;

  function tzOk(tz) {
    try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch (e) { return false; }
  }
  /* A zone the browser no longer knows would throw inside every Intl call and take the
     whole app down, so saved rows are checked before they are trusted. */
  function cleanCities(a) {
    if (!Object.prototype.toString.call(a).match(/Array/)) return [];
    return a.filter(function (c) {
      return c && typeof c.name === 'string' && typeof c.tz === 'string' && tzOk(c.tz);
    }).slice(0, MAX).map(function (c) {
      return { name: c.name, cc: c.cc || '', country: c.country || '', tz: c.tz };
    });
  }
  function writeState() {
    try {
      localStorage.setItem(LS, JSON.stringify({ v: 1, at: Date.now(),
        cities: cities, use24: use24, dialMins: dialMins, selMonth: selMonth }));
    } catch (e) {}          // private mode, or a full quota - not worth breaking the app over
  }
  /* Debounced: called from every mutation, and a drag ends in a flurry of them. */
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(writeState, 250); }

  function restore() {
    var st = null;
    try { st = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) {}
    if (!st || st.v !== 1) return;
    cities = cleanCities(st.cities);
    use24 = st.use24 !== false;
    if (cities.length && Date.now() - (+st.at || 0) < RESTORE_MS) {
      if (typeof st.dialMins === 'number') dialMins = ((st.dialMins % 1440) + 1440) % 1440;
      if (typeof st.selMonth === 'number' && st.selMonth >= 0 && st.selMonth < 12) selMonth = st.selMonth;
    }
  }

  /* ---------- timezone maths ---------- */
  var _f = {};
  function zf(tz) {
    if (!_f[tz]) _f[tz] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    return _f[tz];
  }
  function wall(date, tz) {
    var o = {};
    zf(tz).formatToParts(date).forEach(function (p) { if (p.type !== 'literal') o[p.type] = p.value; });
    if (o.hour === '24') o.hour = '00';
    return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour, mi: +o.minute };
  }
  function offMin(date, tz) {
    var p = wall(date, tz);
    return Math.round((Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi)
      - Math.floor(date.getTime() / 60000) * 60000) / 60000);
  }
  /* wall clock in a zone -> the UTC instant. Two passes, because the offset you need
     depends on the instant you are trying to find. */
  function zonedToUtc(y, mo, d, h, mi, tz) {
    var g = Date.UTC(y, mo, d, h, mi);
    var o1 = offMin(new Date(g), tz);
    var t = g - o1 * 60000;
    var o2 = offMin(new Date(t), tz);
    return o2 === o1 ? t : g - o2 * 60000;
  }
  function homeTz() { return cities.length ? cities[0].tz : 'UTC'; }
  function isLive() { return dialMins === null && selMonth === null; }
  function currentMins() {
    if (dialMins !== null) return dialMins;
    var p = wall(new Date(), homeTz());
    return p.h * 60 + p.mi;
  }
  function baseYMD() {
    if (selMonth === null) { var p = wall(new Date(), homeTz()); return [p.y, p.mo - 1, p.d]; }
    return [new Date().getFullYear(), selMonth, 1];      // the 1st, as decided
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function parts(m) {
    m = ((m % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mi = m % 60;
    return use24 ? { num: pad(h) + ':' + pad(mi), ap: '' }
                 : { num: (h % 12 || 12) + ':' + pad(mi), ap: h < 12 ? 'am' : 'pm' };
  }
  function tHTML(m) { var p = parts(m); return p.num + (p.ap ? '<i>' + p.ap + '</i>' : ''); }
  function asleep(h) { return h >= 21 || h < 7; }   // locked threshold

  /* ---------- theme tokens ---------- */
  /* The dial is hand-drawn SVG, so its colours cannot be inherited from the stylesheet the
     way the rest of the app's are. They are read out of the same CSS custom properties
     instead, which keeps one source of truth and makes a second colour scheme a stylesheet
     change rather than a hunt through this file. */
  var T = {};
  var TOKENS = ['ink', 'muted', 'dial-face', 'tick-maj', 'tick-min', 'tick-maj-fine',
                'tick-min-fine', 'ramp-mode', 'ramp-toward', 'ramp-soften', 'ramp-floor',
                'ramp-ceil', 'moon', 'sun', 'sun-edge'];
  function readTheme() {
    var cs = getComputedStyle(document.documentElement);
    TOKENS.forEach(function (k) { T[k] = cs.getPropertyValue('--' + k).trim() || '#000000'; });
    shadeCache = {};
  }
  readTheme();

  /* ---------- marks ---------- */
  /* The mark: a stand of three aspen, and the root that joins them.
     Adopted 4 Sept 2026, replacing the three-stalk mark. The outer trees carry bare stems; the
     centre one puts down a root that forks and runs beneath the others - which is what Pando is,
     one organism sharing one root system, the trees being only what you can see of it.

     Baked path data rather than a generator: none of it varies at runtime. The full parametric
     source, with the sliders it was tuned on, is in icon-current.html.

     Drawn at 16px tall in the header. The midrib inside each leaf is deliberately absent here -
     at this size it closes up - and appears only in the app icon. */
  var MARK_VB = '6.3 0 87.4 83.5';
  var MARK_STROKES = '<path d="M 24 50.0 L 24 77"/><path d="M 76 56.0 L 76 77"/><path d="M 50 36.0 L 50 75.5 Q 50 82 43.5 82 L 16 82"/><path d="M 50 75.5 Q 50 82 56.5 82 L 84 82"/>';
  var MARK_LEAVES = '<g transform="translate(24,16)"><path d="M -1.04 0 C 1.50 8.16, 11.69 10.88, 14.99 19.72 C 14.99 27.88, 8.24 34.68, 0.81 34.00 L -0.81 34.00 C -6.61 34.68, -12.02 27.88, -12.02 19.72 C -12.02 10.88, -1.20 8.16, -1.04 0 Z"/></g><g transform="translate(50,2)"><path d="M -1.04 0 C 1.50 8.16, 11.69 10.88, 14.99 19.72 C 14.99 27.88, 8.24 34.68, 0.81 34.00 L -0.81 34.00 C -6.61 34.68, -12.02 27.88, -12.02 19.72 C -12.02 10.88, -1.20 8.16, -1.04 0 Z"/></g><g transform="translate(76,22)"><path d="M -1.04 0 C 1.50 8.16, 11.69 10.88, 14.99 19.72 C 14.99 27.88, 8.24 34.68, 0.81 34.00 L -0.81 34.00 C -6.61 34.68, -12.02 27.88, -12.02 19.72 C -12.02 10.88, -1.20 8.16, -1.04 0 Z"/></g>';
  function markSVG() {
    return '<svg viewBox="' + MARK_VB + '" width="16.75" height="16" aria-hidden="true" ' +
      'fill="currentColor">' +
      '<g fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" ' +
      'stroke-linejoin="round">' + MARK_STROKES + '</g>' + MARK_LEAVES + '</svg>';
  }

  var CHEV = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9.5l6 6 6-6"/></svg>';
  /* The crescent's bounding box ran 1.96-13.40 in x and 4.60-16.04 in y, so it sat 1.32 units
     up and to the left of the centre of its own box - visible once it is in a column with the
     sun and the add button. The path is the locked one; only the transform is new. */
  function MOON() {
    return '<svg class="glyph" width="19" height="19" viewBox="0 0 18 18" aria-hidden="true">' +
    '<g transform="translate(1.32,-1.32)"><path d="M13.4 11.6A5.6 5.6 0 0 1 6.4 4.6 5.8 5.8 0 1 0 13.4 11.6Z" ' +
    'fill="' + T.moon + '"/></g></svg>';
  }
  function SUN() {
    return '<svg class="glyph" width="19" height="19" viewBox="0 0 18 18" aria-hidden="true">' +
    '<circle cx="9" cy="9" r="4" fill="' + T.sun + '" stroke="' + T['sun-edge'] + '" stroke-width="1"/>' +
    '<g stroke="' + T['sun-edge'] + '" stroke-width="1.4" stroke-linecap="round">' +
    '<line x1="9" y1="1.2" x2="9" y2="2.8"/><line x1="9" y1="15.2" x2="9" y2="16.8"/>' +
    '<line x1="1.2" y1="9" x2="2.8" y2="9"/><line x1="15.2" y1="9" x2="16.8" y2="9"/>' +
    '<line x1="3.5" y1="3.5" x2="4.6" y2="4.6"/><line x1="13.4" y1="13.4" x2="14.5" y2="14.5"/>' +
    '<line x1="14.5" y1="3.5" x2="13.4" y2="4.6"/><line x1="4.6" y1="13.4" x2="3.5" y2="14.5"/>' +
    '</g></svg>';
  }

  /* ---------- the ramp ---------- */
  var STOPS = [[0,'#0d21a5'],[4.5,'#3f57bd'],[6.5,'#8ba2f0'],[8,'#cfd3ee'],[9.5,'#f6e3b4'],
    [11,'#f7c948'],[17.5,'#f7c948'],[19.5,'#f8dfa0'],[20.5,'#ecdcdd'],
    [21.5,'#a9b6ea'],[22.5,'#5d74d2'],[24,'#0d21a5']];
  function hx(c){c=c.replace('#','');return [parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];}
  function h2(v){v=v.toString(16);return v.length<2?'0'+v:v;}
  function mix(a,b,t){var A=hx(a),B=hx(b);return '#'+[0,1,2].map(function(i){
    return h2(Math.round(A[i]+(B[i]-A[i])*t));}).join('');}

  /* --- OKLab, because sRGB mixing is what made the dark ramp muddy ---
     Softening a stop by mixing it toward the ground works on white: everything just gets
     paler. Toward a dark navy it does not, because Noon and the ground are near opposites,
     so the blend passes through grey - Noon's chroma fell from 0.150 to 0.071 and the gold
     turned olive. The fix is to stop moving colours toward the ground at all: keep each
     stop's hue and chroma exactly, and remap only its lightness into a band that suits the
     scheme. Ottosson's OKLab is the space where "change lightness, keep the colour" is
     actually true. */
  function s2l(c){c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
  function l2s(c){var v=c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055;
    return Math.max(0,Math.min(255,Math.round(v*255)));}
  function toLab(h){
    var p=hx(h),r=s2l(p[0]),g=s2l(p[1]),b=s2l(p[2]);
    var l=Math.cbrt(0.4122214708*r+0.5363325363*g+0.0514459929*b);
    var m=Math.cbrt(0.2119034982*r+0.6806995451*g+0.1073969566*b);
    var s=Math.cbrt(0.0883024619*r+0.2817188376*g+0.6299787005*b);
    return [0.2104542553*l+0.7936177850*m-0.0040720468*s,
            1.9779984951*l-2.4285922050*m+0.4505937099*s,
            0.0259040371*l+0.7827717662*m-0.8086757660*s];
  }
  function fromLab(L,a,bb){
    var l=Math.pow(L+0.3963377774*a+0.2158037573*bb,3);
    var m=Math.pow(L-0.1055613458*a-0.0638541728*bb,3);
    var s=Math.pow(L-0.0894841775*a-1.2914855480*bb,3);
    return '#'+[ 4.0767416621*l-3.3077115913*m+0.2309699292*s,
                -1.2684380046*l+2.6097574011*m-0.3413193965*s,
                -0.0041960863*l-0.7034186147*m+1.7076147010*s].map(l2s).map(h2).join('');
  }

  /* The ramp's own lightness range, measured once so the remap is relative to the ramp
     rather than to an assumed 0-1. */
  var L_LO = 1, L_HI = 0;
  STOPS.forEach(function (st) {
    var L = toLab(st[1])[0];
    if (L < L_LO) L_LO = L;
    if (L > L_HI) L_HI = L;
  });

  var shadeCache = {};
  function shade(col) {
    if (shadeCache[col]) return shadeCache[col];
    var out;
    if (T['ramp-mode'] === 'lift') {
      var lab = toLab(col);
      var lo = parseFloat(T['ramp-floor']) || 0.56, hi = parseFloat(T['ramp-ceil']) || 0.88;
      out = fromLab(lo + (lab[0] - L_LO) / (L_HI - L_LO) * (hi - lo), lab[1], lab[2]);
    } else {
      var t = T['ramp-soften'] === '' ? 0.46 : parseFloat(T['ramp-soften']);
      out = mix(col, T['ramp-toward'], isNaN(t) ? 0.46 : t);
    }
    return (shadeCache[col] = out);
  }
  function rampAt(m) {
    var h = ((m % 1440) + 1440) % 1440 / 60, col = STOPS[STOPS.length - 1][1];
    for (var i = 1; i < STOPS.length; i++) {
      if (h <= STOPS[i][0]) { var a = STOPS[i-1], b = STOPS[i];
        col = mix(a[1], b[1], (h - a[0]) / (b[0] - a[0])); break; }
    }
    return shade(col);
  }

  /* ---------- dial geometry ---------- */
  var C = 150, R_FACE = 78, R_BAND = 106, TICK_IN = 126, TICK_OUT = 135, R_NUM = 144;
  var ARC = { r: 116, w: 10 };
  function pt(r, a) { return [C + r * Math.sin(a), C - r * Math.cos(a)]; }

  function buildDial() {
    var o = '<circle cx="150" cy="150" r="' + R_BAND + '" fill="' + T['dial-face'] + '"/>';
    var N = 144, rm = (R_FACE + R_BAND) / 2, w = R_BAND - R_FACE;
    for (var i = 0; i < N; i++) {
      var m0 = i / N * 1440, m1 = (i + 1.02) / N * 1440;
      var p0 = pt(rm, m0 / 1440 * 2 * Math.PI), p1 = pt(rm, m1 / 1440 * 2 * Math.PI);
      o += '<path d="M ' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A ' + rm + ' ' + rm +
        ' 0 0 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + '" fill="none" stroke="' +
        rampAt((m0 + m1) / 2) + '" stroke-width="' + w + '"/>';
    }
    o += '<circle cx="150" cy="150" r="' + R_FACE + '" fill="' + T['dial-face'] + '"/>';
    for (var j = 0; j < 48; j++) {
      var a = j * 7.5 * Math.PI / 180, maj = j % 2 === 0;
      var q1 = pt(maj ? TICK_IN : TICK_IN + 4, a), q2 = pt(TICK_OUT, a);
      o += '<line class="tk" data-maj="' + (maj ? 1 : 0) + '" x1="' + q1[0].toFixed(1) + '" y1="' +
        q1[1].toFixed(1) + '" x2="' + q2[0].toFixed(1) + '" y2="' + q2[1].toFixed(1) +
        '" stroke="' + (maj ? T['tick-maj'] : T['tick-min']) + '" stroke-width="' + (maj ? 1.2 : 0.7) + '"/>';
    }
    for (var h = 0; h < 24; h += 6) {
      var p = pt(R_NUM, h * 15 * Math.PI / 180);
      o += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 3.6).toFixed(1) +
        '" text-anchor="middle" font-family="Helvetica Neue,Helvetica,Arial" font-weight="300" ' +
        'font-size="10.5" fill="' + T.muted + '">' + pad(h) + '</text>';
    }
    o += '<g class="arc"></g>' +
      '<text class="big" x="150" y="144" text-anchor="middle" font-family="Helvetica Neue,Helvetica,Arial" ' +
      'font-weight="200" font-size="42" fill="' + T.ink + '"></text>' +
      /* 11px/400, up from 10px/300. At 10px with 2.4 tracking it read as a watermark rather
         than a label - and "light" here was weight as much as size. */
      '<text class="hometag" x="150" y="166" text-anchor="middle" font-family="Helvetica Neue,Helvetica,Arial" ' +
      'font-weight="400" font-size="11" letter-spacing="2.4" fill="' + T.muted + '"></text>';
    $('dial').innerHTML = o;
  }

  function drawArc(m) {
    var g = $('dial').querySelector('.arc');
    if (m < 2) { g.innerHTML = ''; return; }
    var o = '', steps = Math.max(2, Math.round(m / 1440 * 96));
    for (var i = 0; i < steps; i++) {
      var m0 = m * i / steps, m1 = m * (i + 1) / steps;
      var p0 = pt(ARC.r, m0 / 1440 * 2 * Math.PI), p1 = pt(ARC.r, m1 / 1440 * 2 * Math.PI);
      o += '<path d="M ' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A ' + ARC.r + ' ' + ARC.r +
        ' 0 0 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + '" fill="none" stroke="' +
        rampAt((m0 + m1) / 2) + '" stroke-width="' + ARC.w + '" stroke-linecap="' +
        ((i === 0 || i === steps - 1) ? 'round' : 'butt') + '"/>';
    }
    g.innerHTML = o;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  /* ---------- render ---------- */
  /* Always "today" when no month is chosen, whether or not the dial is still live.
     The label swapping under your finger mid-drag was worse than the small imprecision. */
  function dateLabel() {
    return selMonth !== null ? '1 ' + MON3[selMonth] : 'today';
  }

  function render() {
    var m = currentMins();
    $('brand').innerHTML = markSVG() + 'Pando';
    $('datebtn').innerHTML = dateLabel() + CHEV;

    if (cities.length) {
      var b = baseYMD();
      var instant = new Date(zonedToUtc(b[0], b[1], b[2], Math.floor(m / 60), m % 60, homeTz()));
      var hp = wall(instant, homeTz());

      $('cities').innerHTML = cities.map(function (c, i) {
        var p = wall(instant, c.tz);
        var shift = Math.round((Date.UTC(p.y, p.mo - 1, p.d) - Date.UTC(hp.y, hp.mo - 1, hp.d)) / 86400000);
        return '<li class="city" data-i="' + i + '">' +
          '<div class="face">' +
            '<div class="name"><span class="n">' + esc(c.name) +
              (i === 0 ? '<span class="chip">home</span>' : '') + '</span>' +
              '<span class="zone">' + esc(c.country || '') + '</span></div>' +
            '<div class="right"><div class="stack">' +
              '<span class="time">' + tHTML(p.h * 60 + p.mi) + '</span>' +
              '<span class="shift">' + (shift > 0 ? 'next day' : shift < 0 ? 'prev day' : '') + '</span>' +
            '</div><span class="markbox">' + (asleep(p.h) ? MOON() : SUN()) + '</span></div>' +
          '</div>' +
          '<div class="actions">' +
            (i === 0 ? '' : '<button type="button" data-home="' + i + '">Set home</button>') +
            '<button type="button" class="danger" data-del="' + i + '">Delete</button>' +
          '</div></li>';
      }).join('');
    } else {
      $('cities').innerHTML = '';
    }

    /* With no cities the dial has nothing to speak for - currentMins() falls back to UTC, and
       showing that reads as a real time for a place nobody named. Better to show nothing. */
    drawArc(cities.length ? m : 0);
    var pr = parts(m);
    var big = $('dial').querySelector('.big');
    big.innerHTML = cities.length
      ? pr.num + (pr.ap ? '<tspan font-size="20" dx="6" fill="' + T.muted + '">' + pr.ap + '</tspan>' : '')
      : '';
    fitHometag(cities.length ? cities[0].name.toUpperCase() : '');
    $('dial').setAttribute('aria-valuenow', m);
    $('dial').setAttribute('aria-valuetext', parts(m).num + (parts(m).ap ? ' ' + parts(m).ap : ''));

    /* With no cities there is nothing for it to govern, and it floats in an empty circle. */
    $('tog').hidden = !cities.length;
    $('tog').innerHTML = '<span class="tg" id="tgbtn">' + (use24
      ? '<span>12h</span><span class="sep">·</span><b>24h</b>'
      : '<b>12h</b><span class="sep">·</span><span>24h</span>') + '</span>';

    $('dial').querySelectorAll('.tk').forEach(function (t) {
      var maj = t.dataset.maj === '1';
      t.setAttribute('stroke-width', fine ? (maj ? 2 : 1.3) : (maj ? 1.2 : 0.7));
      t.setAttribute('stroke', fine ? (maj ? T['tick-maj-fine'] : T['tick-min-fine'])
                                    : (maj ? T['tick-maj'] : T['tick-min']));
    });

    $('empty').hidden = cities.length > 0;
    $('add').hidden = cities.length >= MAX;
  }

  /* The city label sits inside the dial's white face, which is 156 units across at the centre
     and narrower at the label's height. "PALMA DE MALLORCA" measures about 156 at 11px/2.4 and
     ran out over the ring. Rather than pick a size that happens to fit the longest name anyone
     has tried, measure the drawn text and shrink until it fits - dropping the tracking first,
     since that is what makes a long name wide, then the size. Beyond that, truncate. */
  var TAG_MAX = 138;
  function fitHometag(text) {
    var t = $('dial').querySelector('.hometag');
    t.textContent = text;
    if (!text) return;
    var size = 11, track = 2.4;
    t.setAttribute('font-size', size);
    t.setAttribute('letter-spacing', track);
    while (t.getComputedTextLength() > TAG_MAX && (track > 0.6 || size > 8.2)) {
      if (track > 0.6) track = Math.max(0.6, track - 0.3);
      else size = Math.max(8.2, size - 0.3);
      t.setAttribute('font-size', size.toFixed(2));
      t.setAttribute('letter-spacing', track.toFixed(2));
    }
    /* Still over at the floor - a name long enough that shrinking further would be unreadable. */
    if (t.getComputedTextLength() > TAG_MAX) {
      var s = text;
      while (s.length > 4 && t.getComputedTextLength() > TAG_MAX) {
        s = s.slice(0, -1);
        t.textContent = s.replace(/[\s·]+$/, '') + '…';
      }
    }
  }

  /* ---------- date picker ---------- */
  function buildPicker() {
    $('picker').innerHTML = '<button type="button" data-m="now">Today</button>' +
      MONTHS.map(function (mo, i) { return '<button type="button" data-m="' + i + '">1 ' + mo + '</button>'; }).join('');
  }
  function syncPicker() {
    $('picker').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.m === 'now' ? isLive() : +b.dataset.m === selMonth);
    });
  }
  function openPicker() {
    var r = $('datebtn').getBoundingClientRect();
    var pk = $('picker');
    pk.hidden = false;
    pk.style.top = (window.scrollY + r.bottom + 6) + 'px';
    pk.style.left = Math.max(8, r.right - pk.offsetWidth) + 'px';
    syncPicker();
  }
  function closePicker() { $('picker').hidden = true; }

  document.addEventListener('click', function (e) {
    if (e.target.closest('#tgbtn')) { use24 = !use24; render(); save(); return; }
    if (e.target.closest('#datebtn')) {
      if ($('picker').hidden) openPicker(); else closePicker();
      return;
    }
    var opt = e.target.closest('#picker button');
    if (opt) {
      if (opt.dataset.m === 'now') { selMonth = null; dialMins = null; startTick(); }
      else { selMonth = +opt.dataset.m; if (dialMins === null) dialMins = currentMins(); stopTick(); }
      closePicker(); render(); save();
      return;
    }
    if (!e.target.closest('#picker')) closePicker();
    if (!e.target.closest('.city')) closeAllRows();
  });

  /* ---------- dial drag ---------- */
  (function () {
    var svg = $('dial'), drag = null;
    function ang(e) {
      var r = svg.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var a = Math.atan2(e.clientX - cx, -(e.clientY - cy));
      return a < 0 ? a + 2 * Math.PI : a;
    }
    svg.addEventListener('pointerdown', function (e) {
      if (!cities.length) return;
      try { svg.setPointerCapture(e.pointerId); } catch (_) {}
      svg.classList.add('drag');
      if (dialMins === null) dialMins = currentMins();   // dragging leaves live mode
      /* `raw` accumulates the drag unrounded. Rounding the running value on every move threw
         away any movement smaller than half a step - so at the 5-minute step nothing under
         2.5 minutes of arc registered at all, and a slow drag did nothing. The grid is applied
         for display only; the underlying position is continuous. */
      fine = false;                     /* every drag starts coarse */
      drag = { last: ang(e), t: performance.now(), raw: dialMins };
      stopTick();
      e.preventDefault();
    });
    svg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var a = ang(e), now = performance.now(), d = a - drag.last;
      if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
      /* The whole day is about 754px of arc, so a 5-minute step was 2.6px - landing on 9:00
         rather than 8:55 needed a pixel and a half of finger precision, which is not a thing.
         The default step is now a quarter hour: 7.8px, and the times people actually aim for
         (9:00, 9:15, 9:30) are the only ones on the grid.

         Slow down once and it drops to single minutes for the rest of the drag - sticky, not
         re-evaluated every frame, so it cannot flicker between grids under your finger. The
         ticks thicken and turn Klein to say precision is on. */
      if (!fine && Math.abs(d) / Math.max(now - drag.t, 1) * 1000 < 0.6) fine = true;
      var step = fine ? 1 : 15;
      drag.raw += d / (2 * Math.PI) * 1440;
      dialMins = ((Math.round(drag.raw / step) * step % 1440) + 1440) % 1440;
      drag.last = a; drag.t = now;
      render();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      svg.addEventListener(ev, function () {
        if (!drag) return;
        drag = null; svg.classList.remove('drag');
        save();
        clearTimeout(fineTimer);
        fineTimer = setTimeout(function () { fine = false; render(); }, 900);
      });
    });
  })();

  /* ---------- rows ---------- */
  function closeAllRows(except) {
    document.querySelectorAll('.city.open').forEach(function (el) { if (el !== except) el.classList.remove('open'); });
  }
  $('cities').addEventListener('click', function (e) {
    var del = e.target.closest('[data-del]');
    if (del) { cities.splice(+del.dataset.del, 1); render(); save(); return; }
    var home = e.target.closest('[data-home]');
    if (home) { cities.unshift(cities.splice(+home.dataset.home, 1)[0]); render(); save(); return; }
    var li = e.target.closest('.city');
    if (!li) return;
    if (li.dataset.moved === '1') { li.dataset.moved = '0'; return; }
    var wasOpen = li.classList.contains('open');
    closeAllRows();
    if (!wasOpen) li.classList.add('open');
  });
  (function () {
    var sx = 0, sy = 0, li = null, decided = false, horiz = false, list = $('cities');
    list.addEventListener('pointerdown', function (e) {
      li = e.target.closest('.city'); if (!li) return;
      sx = e.clientX; sy = e.clientY; decided = false; horiz = false; li.dataset.moved = '0';
    });
    list.addEventListener('pointermove', function (e) {
      if (!li) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!decided) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
        decided = true; horiz = Math.abs(dx) > Math.abs(dy);
      }
      if (horiz) li.dataset.moved = '1';
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      list.addEventListener(ev, function (e) {
        if (!li) return;
        if (horiz) {
          var dx = e.clientX - sx;
          if (dx < -45) { closeAllRows(li); li.classList.add('open'); }
          else if (dx > 45) li.classList.remove('open');
        }
        li = null;
      });
    });
  })();

  /* ---------- search ---------- */
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  var normCache = null;
  function searchPinned(q) {
    return PINNED.filter(function (p) {
      return norm(p.name).indexOf(q) === 0 ||
        norm(p.alias).split(' ').some(function (w) { return w.indexOf(q) === 0; });
    });
  }
  function search(q) {
    if (!DB) return [];
    q = norm(q.trim());
    if (!q) return [];
    if (!normCache) normCache = DB.c.map(function (r) { return norm(r[0]); });
    var starts = [], contains = [];
    for (var i = 0; i < DB.c.length; i++) {
      if (isSupplanted(DB.c[i][0], DB.cc[DB.c[i][1]])) continue;
      var n = normCache[i];
      if (n.indexOf(q) === 0) { if (starts.length < 40) starts.push(i); }
      else if (n.indexOf(q) > 0) { if (contains.length < 40) contains.push(i); }
      if (starts.length >= 40) break;
    }
    return starts.concat(contains).slice(0, 40);
  }
  function previewTime(tz) {
    var p = wall(new Date(), tz);
    return parts(p.h * 60 + p.mi).num;
  }
  function runSearch() {
    var q = $('q').value, hint = $('hint'), results = $('results');
    if (!q.trim()) { results.innerHTML = ''; hint.hidden = false; hint.textContent = 'Start typing a city name.'; return; }
    var nq = norm(q.trim());
    var pins = searchPinned(nq), hits = search(q);
    if (!pins.length && !hits.length) {
      results.innerHTML = ''; hint.hidden = false;
      hint.textContent = 'No city called “' + q.trim() + '”. Try a larger nearby city.';
      return;
    }
    hint.hidden = true;
    var pinHTML = pins.map(function (p) {
      var already = cities.some(function (c) { return c.name === p.name && c.tz === p.tz; });
      return '<li data-pin="' + esc(p.name) + '"' + (already ? ' aria-disabled="true"' : '') + '>' +
        '<span class="rc">' + esc(p.name) + ' <em>' + esc(p.region + ', ' + p.country) + '</em></span>' +
        '<span class="rz">' + (already ? 'added' : previewTime(p.tz)) + '</span></li>';
    }).join('');
    var hitHTML = hits.map(function (idx) {
      var r = DB.c[idx], tz = DB.tz[r[2]];
      var already = cities.some(function (c) { return c.name === r[0] && c.tz === tz; });
      return '<li data-idx="' + idx + '"' + (already ? ' aria-disabled="true"' : '') + '>' +
        '<span class="rc">' + esc(r[0]) + ' <em>' + esc(DB.country[r[1]]) + '</em></span>' +
        '<span class="rz">' + (already ? 'added' : previewTime(tz)) + '</span></li>';
    }).join('');
    results.innerHTML = pinHTML + hitHTML;
  }
  function openSheet() {
    if (cities.length >= MAX) return;
    $('sheet').hidden = false; $('q').value = ''; $('results').innerHTML = '';
    $('hint').hidden = false;
    $('hint').textContent = !DB ? (dbFail ? 'City list unavailable — reconnect to add a city.'
                                          : 'Loading cities…')
      : firstRun ? 'Which city are you in? It becomes your home, and every other time is shown against it.'
      : 'Start typing a city name.';
    setTimeout(function () { $('q').focus(); }, 30);
  }
  function closeSheet() { $('sheet').hidden = true; }
  $('add').addEventListener('click', openSheet);
  $('cancel').addEventListener('click', closeSheet);
  $('sheet').addEventListener('click', function (e) { if (e.target === $('sheet')) closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeSheet(); closePicker(); } });
  var searchTimer = null;
  $('q').addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 90); });
  $('results').addEventListener('click', function (e) {
    var pin = e.target.closest('li[data-pin]');
    if (pin) {
      if (pin.getAttribute('aria-disabled') === 'true') return;
      var p = PINNED.find(function (x) { return x.name === pin.dataset.pin; });
      cities.push({ name: p.name, cc: p.cc, country: p.country, tz: p.tz });
      if (firstRun) { addWink(); firstRun = false; }
      closeSheet(); render(); save(); return;
    }
    var li = e.target.closest('li[data-idx]');
    if (!li || li.getAttribute('aria-disabled') === 'true') return;
    var r = DB.c[+li.dataset.idx];
    cities.push({ name: r[0], cc: DB.cc[r[1]], country: DB.country[r[1]], tz: DB.tz[r[2]] });
    if (firstRun) { addWink(); firstRun = false; }
    closeSheet(); render(); save();
  });

  /* ---------- live ticking ---------- */
  function startTick() {
    stopTick();
    (function loop() {
      if (!isLive()) return;
      render();
      tickTimer = setTimeout(loop, 60000 - (Date.now() % 60000) + 30);
    })();
  }
  function stopTick() { clearTimeout(tickTimer); tickTimer = null; }

  /* ---------- boot ---------- */
  /* No seeding. `Intl` gives a *timezone*, not a city, and Europe/Madrid covers the Balearics
     as well as the mainland - so guessing meant picking the largest city in the zone and calling
     it yours. For anyone outside that one city it was simply wrong, and the person it was most
     wrong for was the one whose city is pinned. Asking once costs a tap and is always right. */
  var firstRun = false;

  /* The wink: once you have said where home is, one pinned city drops in beneath it, so the
     list arrives as a list rather than a single row. It is chosen from a zone that is NOT yours,
     so it reads as a demonstration of stacking rather than a claim about where you are.
     Kept when the seeding went - the two were tangled in one function, and only the guessing
     was the problem. */
  function addWink() {
    var homeTzNow = cities.length ? cities[0].tz : null;
    var winks = PINNED.filter(function (p) { return p.tz !== homeTzNow; });
    if (!winks.length) return;
    var pick = winks[Math.floor(Math.random() * winks.length)];
    if (cities.some(function (c) { return c.name === pick.name && c.tz === pick.tz; })) return;
    cities.push({ name: pick.name, cc: pick.cc, country: pick.country, tz: pick.tz });
  }

  $('build').textContent = 'build ' + BUILD;
  buildDial();
  buildPicker();
  restore();          // saved rows carry their own zone, so the app paints before the fetch lands
  render();
  if (isLive()) startTick();

  fetch('data/cities.json').then(function (r) { return r.json(); }).then(function (db) {
    DB = db;
    if (cities.length) return;
    firstRun = true;
    openSheet();          /* nothing saved: ask which city is home */
  }).catch(function () {
    dbFail = true;
    if (cities.length) return;      // saved cities still tell the time; only search is lost
    $('empty').hidden = false;
    $('empty').innerHTML = 'Could not load the city list. If you opened this file directly, ' +
      'run <b>./start.sh</b> instead \u2014 browsers block local data files.';
  });
})();
