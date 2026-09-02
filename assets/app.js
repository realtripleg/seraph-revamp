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


    /* -- name prompt ---------------------------------------------------- */

    var nameOverlay = $('nameOverlay');
    var nameInput = $('nameInput');
    var nameErr = $('nameError');

    function isAdminName(name) {
        return name.toLowerCase() === AUTH.user;
    }

    async function submitName() {
        var name = nameInput.value.replace(/[<>"'&]/g, '').trim();
        if (name.length < 2) {
            nameErr.textContent = 'at least 2 characters';
            return;
        }

        if (isAdminName(name)) {
            if (!hasCrypto()) {
                // WebCrypto is secure-context only. Refuse rather than fall
                // back to a weaker check that would only look like security.
                nameErr.textContent = 'unlocking needs https - not available on this connection';
                return;
            }
            var pw = $('pwInput').value;
            if (!pw) { nameErr.textContent = 'password required'; return; }

            nameErr.textContent = 'checking...';
            $('nameBtn').disabled = true;
            var key = null;
            try { key = await deriveKey(pw); }
            catch (e) { nameErr.textContent = 'could not verify'; $('nameBtn').disabled = false; return; }
            $('nameBtn').disabled = false;
            $('pwInput').value = '';

            if (!key) { nameErr.textContent = 'wrong password'; return; }
            adminKey = key;
            setAdmin(true);
            await restoreToken();
        } else {
            setAdmin(false);
        }

        nameErr.textContent = '';
        save('playerName', name);
        nameOverlay.hidden = true;
        showGreeting(name);
    }

    async function restoreToken() {
        var blob = load('ghTokenEnc');
        if (!blob || !adminKey) return;
        try { ghToken = await openToken(blob, adminKey); } catch (e) { ghToken = null; }
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
        setAdmin(false);   // unlocking is per-session; the password is asked again
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

    /* -- admin gate ----------------------------------------------------- */
    /*
     * The password is never stored, here or anywhere. What ships is a random
     * salt and a PBKDF2-SHA256 verifier; the browser recomputes it at login.
     *
     * Be clear-eyed about what this buys: the verifier is public, so a short
     * numeric password can be ground down offline. That is why the GitHub
     * token is NOT persisted by default - unlocking the panel on its own
     * yields an editor with no credentials in it. If you do opt to remember
     * the token, it is AES-GCM encrypted under a key derived from the same
     * password, so a localStorage dump alone will not reveal it.
     */

    var AUTH = {
        user: 'gunner',
        salt: '1e67e40d73fab88f8157e4e981bb1fd8',
        iters: 1200000,
        verify: '3f7e04c38af0540cb38721debeddc89d4ed9e95644c22d0283c8754d2b278c7b'
    };

    var REPO = 'realtripleg/seraph-revamp';
    var BANNER_PATH = 'data/banner.json';

    var adminKey = null;    // AES key, held in memory only while unlocked
    var ghToken = null;     // GitHub PAT, in memory unless explicitly remembered

    function hexToBuf(h) {
        var a = new Uint8Array(h.length / 2);
        for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16);
        return a;
    }
    function bufToHex(b) {
        return [].map.call(new Uint8Array(b), function (x) {
            return x.toString(16).padStart(2, '0');
        }).join('');
    }
    function sameHex(a, b) {
        if (a.length !== b.length) return false;
        var diff = 0;
        for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
        return diff === 0;
    }
    function hasCrypto() {
        return !!(window.crypto && window.crypto.subtle);
    }

    async function deriveKey(pw) {
        var base = await crypto.subtle.importKey(
            'raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
        var bits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: hexToBuf(AUTH.salt), iterations: AUTH.iters, hash: 'SHA-256' },
            base, 256);
        var digest = await crypto.subtle.digest('SHA-256', bits);
        if (!sameHex(bufToHex(digest), AUTH.verify)) return null;
        return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
    }

    async function sealToken(tok, key) {
        var iv = crypto.getRandomValues(new Uint8Array(12));
        var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key,
            new TextEncoder().encode(tok));
        return bufToHex(iv) + ':' + bufToHex(ct);
    }
    async function openToken(blob, key) {
        var bits = blob.split(':');
        var pt = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: hexToBuf(bits[0]) }, key, hexToBuf(bits[1]));
        return new TextDecoder().decode(pt);
    }

    function setAdmin(on) {
        $('adminBtn').hidden = !on;
        $('testing').classList.toggle('on', on);
        if (!on) { adminKey = null; ghToken = null; }
    }

    /* -- public banner -------------------------------------------------- */

    var STYLE_LABELS = ['info', 'warn', 'alert', 'good', 'plain'];

    function bannerDismissed(b) {
        return load('bannerSeen') === (b.updated || b.text);
    }

    function paintBanner(b, previewEl) {
        var target = previewEl || $('banner');
        var live = !previewEl;

        var expired = b.expires && new Date(b.expires).getTime() < Date.now();
        if (live && (!b.enabled || !b.text || expired || bannerDismissed(b))) {
            target.hidden = true;
            return;
        }
        target.hidden = false;
        target.className = 'sitebanner s-' + (b.style || 'info');

        var html = '<span class="sb-text">' + esc(b.text || '(no message)') + '</span>';
        if (b.link) {
            html += ' <a class="sb-link" href="' + esc(b.link) + '"' +
                (/^https?:\/\//i.test(b.link) ? ' target="_blank" rel="noopener noreferrer"' : '') +
                '>' + esc(b.linkText || 'more') + '</a>';
        }
        html += '<span class="sb-spacer"></span>';
        if (b.dismissible) html += '<button class="sb-x" type="button" aria-label="Dismiss">&times;</button>';
        target.innerHTML = html;

        if (live && b.dismissible) {
            target.querySelector('.sb-x').addEventListener('click', function () {
                save('bannerSeen', b.updated || b.text);
                target.hidden = true;
            });
        }
    }

    var liveBanner = null;
    // Guarded: a missing banner file, an offline visitor, or an environment
    // without fetch must not take the rest of the page down with it.
    if (typeof fetch === 'function') {
        try {
            fetch(BANNER_PATH, { cache: 'no-store' })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (b) { if (b) { liveBanner = b; paintBanner(b); } })
                .catch(function () { /* no banner file yet - not an error */ });
        } catch (e) { /* ignore */ }
    }

    /* -- banner editor -------------------------------------------------- */

    function draftFromForm() {
        return {
            enabled: $('bEnabled').checked,
            text: $('bText').value,
            style: $('bStyle').value,
            link: $('bLink').value.trim(),
            linkText: $('bLinkText').value.trim(),
            dismissible: $('bDismiss').checked,
            expires: $('bExpires').value,
            updated: new Date().toISOString()
        };
    }

    function formFromDraft(b) {
        $('bEnabled').checked = !!b.enabled;
        $('bText').value = b.text || '';
        $('bStyle').value = b.style || 'info';
        $('bLink').value = b.link || '';
        $('bLinkText').value = b.linkText || '';
        $('bDismiss').checked = b.dismissible !== false;
        $('bExpires').value = b.expires || '';
    }

    function refreshPreview() {
        var d = draftFromForm();
        paintBanner(d, $('bPreview'));
        $('bJson').value = JSON.stringify(d, null, 2);
    }

    function openEditor() {
        formFromDraft(liveBanner || {});
        refreshPreview();
        $('bStatus').textContent = '';
        $('bannerPanel').hidden = false;
    }

    function utf8Base64(str) {
        var bytes = new TextEncoder().encode(str);
        var bin = '';
        for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    }

    async function publish(json) {
        var api = 'https://api.github.com/repos/' + REPO + '/contents/' + BANNER_PATH;
        var headers = {
            'Authorization': 'Bearer ' + ghToken,
            'Accept': 'application/vnd.github+json'
        };
        var sha;
        var cur = await fetch(api, { headers: headers, cache: 'no-store' });
        if (cur.status === 401 || cur.status === 403) throw new Error('token rejected (401/403)');
        if (cur.ok) sha = (await cur.json()).sha;

        var res = await fetch(api, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify({
                message: 'update site banner',
                content: utf8Base64(json),
                sha: sha
            })
        });
        if (!res.ok) {
            var detail = '';
            try { detail = (await res.json()).message || ''; } catch (e) {}
            throw new Error('HTTP ' + res.status + (detail ? ' - ' + detail : ''));
        }
        return res.json();
    }

    /* -- admin + editor events ------------------------------------------ */

    // the password field only exists once the name looks like the account
    nameInput.addEventListener('input', function () {
        var on = isAdminName(nameInput.value.trim());
        $('pwField').hidden = !on;
        if (!on) $('pwInput').value = '';
    });
    $('pwInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submitName();
    });

    $('adminBtn').addEventListener('click', openEditor);
    $('bClose').addEventListener('click', function () { $('bannerPanel').hidden = true; });
    $('bannerPanel').addEventListener('click', function (e) {
        if (e.target === $('bannerPanel')) $('bannerPanel').hidden = true;
    });

    ['bEnabled', 'bText', 'bStyle', 'bLink', 'bLinkText', 'bDismiss', 'bExpires']
        .forEach(function (id) {
            $(id).addEventListener('input', refreshPreview);
            $(id).addEventListener('change', refreshPreview);
        });

    $('bCopy').addEventListener('click', function () {
        $('bJson').select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        if (navigator.clipboard) navigator.clipboard.writeText($('bJson').value).catch(function () {});
        $('bStatus').textContent = ok || navigator.clipboard
            ? 'copied - paste into data/banner.json and commit'
            : 'select the JSON above and copy it';
    });

    $('bDownload').addEventListener('click', function () {
        var blob = new Blob([$('bJson').value], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'banner.json';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        $('bStatus').textContent = 'downloaded - replace data/banner.json with it';
    });

    $('bForget').addEventListener('click', function () {
        ghToken = null;
        try { localStorage.removeItem('ghTokenEnc'); } catch (e) {}
        document.cookie = 'ghTokenEnc=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
        $('ghTokenInput').value = '';
        $('bStatus').textContent = 'token forgotten on this device';
    });

    $('bPublish').addEventListener('click', async function () {
        var typed = $('ghTokenInput').value.trim();
        if (typed) ghToken = typed;
        if (!ghToken) {
            $('bStatus').textContent = 'paste a GitHub token first (fine-grained, this repo, contents: read+write)';
            return;
        }

        var json = $('bJson').value;
        try { JSON.parse(json); }
        catch (e) { $('bStatus').textContent = 'the JSON is malformed - fix it before publishing'; return; }

        $('bPublish').disabled = true;
        $('bStatus').textContent = 'publishing...';
        try {
            await publish(json);
            liveBanner = JSON.parse(json);
            paintBanner(liveBanner);
            $('bStatus').textContent = 'committed - live in a minute or two once Pages rebuilds';

            if ($('bRemember').checked && adminKey) {
                save('ghTokenEnc', await sealToken(ghToken, adminKey));
                $('bStatus').textContent += ' / token saved encrypted on this device';
            }
            $('ghTokenInput').value = '';
        } catch (err) {
            $('bStatus').textContent = 'failed: ' + err.message;
        }
        $('bPublish').disabled = false;
    });

    /* -- cookie notice -------------------------------------------------- */

    var cookie = $('cookie');
    if (load('cookieConsent') === 'yes') cookie.hidden = true;
    $('cookieOk').addEventListener('click', function () {
        save('cookieConsent', 'yes');
        cookie.hidden = true;
    });
})();
