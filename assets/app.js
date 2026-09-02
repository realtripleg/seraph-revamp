/* Seraph - app logic.
 *
 * Everything on the page is built from data/games.js. Adding a game is a
 * one-line edit there; adding a category is one entry in `categories` and the
 * filter chip appears on its own.
 */
(function () {
    'use strict';

    var VERSION = 'v2.0.0';
    var DATA = window.SERAPH_DATA || { categories: [], games: [], testing: [] };
    var GAMES = DATA.games || [];
    var TESTING = DATA.testing || [];
    var CATEGORIES = DATA.categories || [];

    var $ = function (id) { return document.getElementById(id); };

    // Display-only names for categories. The key stays the raw data value, so
    // slugs, filters and data/games.js are unaffected by anything added here.
    var LABELS = { collection: 'collections' };
    function label(c) { return LABELS[c] || c; }

    /* -- persistence ---------------------------------------------------- */

    function save(key, value) {
        try { localStorage.setItem(key, value); } catch (e) {}
        var d = new Date();
        d.setTime(d.getTime() + 365 * 86400000);
        // Secure only over https - setting it on an http page makes the
        // browser drop the cookie silently, which would break persistence
        // for anyone on the site before the TLS cert lands.
        document.cookie = key + '=' + encodeURIComponent(value) +
            ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax' +
            (location.protocol === 'https:' ? ';Secure' : '');
    }
    function load(key) {
        var m = document.cookie.match(new RegExp('(?:^|; )' + key + '=([^;]*)'));
        if (m) return decodeURIComponent(m[1]);
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function loadStars() {
        var raw = load('starredGames');
        if (raw) { try { var a = JSON.parse(raw); if (Array.isArray(a)) return a; } catch (e) {} }
        return [];
    }
    function saveStars(list) { save('starredGames', JSON.stringify(list)); }

    /* -- status bar ----------------------------------------------------- */

    var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var SCHOOL_START = 7 * 60;        // 07:00
    var SCHOOL_END = 14 * 60 + 22;    // 14:22

    function tick() {
        var now = new Date();
        var h = now.getHours(), m = now.getMinutes(), day = now.getDay();
        var h12 = h % 12 || 12;
        var stamp = DAYS[day] + ' ' + MONTHS[now.getMonth()] + ' ' + now.getDate() +
            '  ' + h12 + ':' + String(m).padStart(2, '0') + (h >= 12 ? 'pm' : 'am');
        $('clock').textContent = stamp;

        var el = $('countdown');
        var mins = h * 60 + m;
        if (day === 0 || day === 6) {
            el.textContent = 'no school today';
            el.classList.add('over');
        } else if (mins >= SCHOOL_END || mins < SCHOOL_START) {
            el.textContent = "school's over";
            el.classList.add('over');
        } else {
            el.classList.remove('over');
            var diff = SCHOOL_END - mins;
            var hrs = Math.floor(diff / 60);
            el.textContent = (hrs > 0 ? hrs + 'hr ' : '') + (diff % 60) + 'min until school ends';
        }
    }

    /* -- greeting ------------------------------------------------------- */

    var HELLOS = ['welcome back', 'hey', 'yo', 'hello', "what's good"];

    function timeLine() {
        var h = new Date().getHours();
        var day = new Date().getDay();
        var weekend = (day === 0 || day === 6) ? 'weekend / ' : '';
        if (h >= 5 && h < 12) return weekend + 'good morning';
        if (h >= 12 && h < 17) return weekend + 'afternoon session';
        if (h >= 17 && h < 21) return weekend + 'evening';
        return weekend + 'late night';
    }

    function showGreeting(name) {
        var hi = HELLOS[Math.floor(Math.random() * HELLOS.length)];
        $('greeting').textContent = hi + ', ' + name + '.';
        $('tagline').textContent = timeLine() + ' / ' + GAMES.length +
            ' games / no ads, no sign-up';
    }

    function syncTesting(name) {
        $('testing').classList.toggle('on', !!name && name.toLowerCase() === 'gunner');
    }

    /* -- name prompt ---------------------------------------------------- */

    var nameOverlay = $('nameOverlay');
    var nameInput = $('nameInput');
    var nameErr = $('nameError');

    function submitName() {
        var name = nameInput.value.replace(/[<>"'&]/g, '').trim();
        if (name.length < 2) {
            nameErr.textContent = 'at least 2 characters';
            return;
        }
        nameErr.textContent = '';
        save('playerName', name);
        nameOverlay.hidden = true;
        showGreeting(name);
        syncTesting(name);
    }

    function promptName() {
        var cur = load('playerName');
        if (cur) nameInput.value = cur;
        nameOverlay.hidden = false;
        nameInput.focus();
        nameInput.select();
    }

    /* -- rendering ------------------------------------------------------ */

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function rowHTML(g, starred) {
        return '<li class="row' + (g.collection ? ' is-collection' : '') + '"' +
            ' data-game="' + esc(g.slug) + '"' +
            ' data-category="' + esc(g.category) + '"' +
            ' data-title="' + esc(String(g.title).toLowerCase()) + '"' +
            ' data-tag="' + esc(String(g.tag).toLowerCase()) + '">' +
            '<button class="star" type="button" aria-pressed="' + (starred ? 'true' : 'false') +
            '" aria-label="' + (starred ? 'Unstar ' : 'Star ') + esc(g.title) + '">' +
            (starred ? '★' : '☆') + '</button>' +
            '<a class="row-link" href="games/' + esc(g.slug) + '/">' +
            '<span class="row-icon" aria-hidden="true">' + esc(g.icon) + '</span>' +
            '<span class="name">' + esc(g.title) + '</span>' +
            '<span class="dots" aria-hidden="true"></span>' +
            '<span class="tag">' + esc(g.tag) + '</span>' +
            '</a></li>';
    }

    function sectionHTML(cat, index, games, stars) {
        return '<section class="section" data-section="' + esc(cat) + '">' +
            '<h2 class="section-head"><span class="n">' +
            String(index).padStart(2, '0') + '</span> ' + esc(label(cat)) +
            '<span class="rule"></span></h2>' +
            '<ul class="list">' +
            games.map(function (g) { return rowHTML(g, stars.indexOf(g.slug) !== -1); }).join('') +
            '</ul></section>';
    }

    function renderIndex() {
        var stars = loadStars();
        var order = CATEGORIES.slice();
        // any category present in the data but missing from `categories`
        GAMES.forEach(function (g) {
            if (order.indexOf(g.category) === -1) order.push(g.category);
        });
        var html = '', n = 1;
        order.forEach(function (cat) {
            var inCat = GAMES.filter(function (g) { return g.category === cat; });
            if (!inCat.length) return;
            html += sectionHTML(cat, n++, inCat, stars);
        });
        $('index').innerHTML = html;

        $('filters').innerHTML =
            ['all'].concat(order).map(function (c) {
                return '<button class="chip" type="button" data-filter="' + esc(c) +
                    '" aria-pressed="' + (c === 'all' ? 'true' : 'false') + '">' + esc(label(c)) + '</button>';
            }).join('');

        $('testingList').innerHTML = TESTING.map(function (t) {
            var href = t.external ? t.url : 'games/' + t.slug + '/';
            return '<li class="row"><span class="star" aria-hidden="true"></span>' +
                '<a class="row-link" href="' + esc(href) + '"' +
                (t.external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' +
                '<span class="row-icon" aria-hidden="true">' + esc(t.icon) + '</span>' +
                '<span class="name">' + esc(t.title) + '</span>' +
                '<span class="dots" aria-hidden="true"></span>' +
                '<span class="tag">' + esc(t.tag) + '</span></a></li>';
        }).join('');
    }

    function renderStarred() {
        var stars = loadStars();
        var picked = stars.map(function (s) {
            for (var i = 0; i < GAMES.length; i++) if (GAMES[i].slug === s) return GAMES[i];
            return null;
        }).filter(Boolean);

        $('starred').hidden = picked.length === 0;
        $('starCount').textContent = picked.length;
        $('starList').innerHTML = picked.map(function (g) { return rowHTML(g, true); }).join('');
    }

    function syncStars() {
        var stars = loadStars();
        document.querySelectorAll('#index .row').forEach(function (row) {
            var on = stars.indexOf(row.dataset.game) !== -1;
            var btn = row.querySelector('.star');
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            btn.textContent = on ? '★' : '☆';
            btn.setAttribute('aria-label', (on ? 'Unstar ' : 'Star ') +
                row.querySelector('.name').textContent);
        });
    }

    function toggleStar(slug) {
        var stars = loadStars();
        var i = stars.indexOf(slug);
        if (i === -1) stars.push(slug); else stars.splice(i, 1);
        saveStars(stars);
        syncStars();
        renderStarred();
    }

    /* -- search + filter ------------------------------------------------ */

    var activeFilter = 'all';

    function applyFilter() {
        var q = $('search').value.trim().toLowerCase();
        var shown = 0;

        document.querySelectorAll('#index .section').forEach(function (sec) {
            var visible = 0;
            sec.querySelectorAll('.row').forEach(function (row) {
                var hit = !q || row.dataset.title.indexOf(q) !== -1 ||
                          row.dataset.tag.indexOf(q) !== -1;
                var inCat = activeFilter === 'all' || row.dataset.category === activeFilter;
                var show = hit && inCat;
                row.hidden = !show;
                if (show) visible++;
            });
            sec.hidden = visible === 0;
            shown += visible;
        });

        var filtering = q !== '' || activeFilter !== 'all';
        $('count').innerHTML = filtering
            ? 'showing <b>' + shown + '</b> of ' + GAMES.length
            : GAMES.length + ' games / ' + CATEGORIES.length + ' categories';
        $('empty').hidden = shown !== 0;
        $('emptyQuery').textContent = q || activeFilter;
        $('footerCount').textContent = GAMES.length + ' games';
    }

    /* -- boot ----------------------------------------------------------- */

    renderIndex();
    renderStarred();
    applyFilter();
    tick();
    setInterval(tick, 1000);

    $('version').firstChild.textContent = VERSION;
    $('footerVersion').textContent = 'seraph ' + VERSION;

    var saved = load('playerName');
    if (saved) {
        nameOverlay.hidden = true;
        showGreeting(saved);
        syncTesting(saved);
    } else {
        nameOverlay.hidden = false;
        setTimeout(function () { nameInput.focus(); }, 200);
    }

    /* -- events --------------------------------------------------------- */

    $('nameBtn').addEventListener('click', submitName);
    nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitName(); });
    nameInput.addEventListener('input', function () { nameErr.textContent = ''; });
    $('editName').addEventListener('click', promptName);

    document.addEventListener('click', function (e) {
        var star = e.target.closest('.star[aria-pressed]');
        if (star) {
            e.preventDefault();
            toggleStar(star.closest('.row').dataset.game);
        }
    });

    $('search').addEventListener('input', applyFilter);

    $('filters').addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        $('filters').querySelectorAll('.chip').forEach(function (c) {
            c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
        });
        activeFilter = chip.dataset.filter;
        applyFilter();
    });

    var log = $('changelog');
    $('version').addEventListener('click', function () {
        log.hidden = false;
        save('lastSeenChangelog', VERSION);
        var badge = $('version').querySelector('.new');
        if (badge) badge.hidden = true;
    });
    $('logClose').addEventListener('click', function () { log.hidden = true; });
    log.addEventListener('click', function (e) { if (e.target === log) log.hidden = true; });
    if (load('lastSeenChangelog') === VERSION) {
        var badge = $('version').querySelector('.new');
        if (badge) badge.hidden = true;
    }

    document.addEventListener('keydown', function (e) {
        var tag = document.activeElement.tagName;
        var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

        if (e.key === 'Escape') {
            if (!log.hidden) { log.hidden = true; return; }
            if (!nameOverlay.hidden && load('playerName')) { nameOverlay.hidden = true; return; }
            if (document.activeElement === $('search')) {
                if ($('search').value) { $('search').value = ''; applyFilter(); }
                $('search').blur();
            }
            return;
        }
        if (!typing && e.key === '/') {
            e.preventDefault();
            $('search').focus();
            $('search').select();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            $('search').focus();
            $('search').select();
        }
    });

    var top = $('top');
    var ticking = false;
    window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () {
            top.hidden = window.scrollY <= 400;
            ticking = false;
        });
    });
    top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

    /* -- cookie notice -------------------------------------------------- */

    var cookie = $('cookie');
    if (load('cookieConsent') === 'yes') cookie.hidden = true;
    $('cookieOk').addEventListener('click', function () {
        save('cookieConsent', 'yes');
        cookie.hidden = true;
    });
})();
