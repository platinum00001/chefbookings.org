(function () {
  'use strict';
  var sb = window.sb, app = document.getElementById('app'), nav = document.getElementById('nav');
  var state = { user: null, admin: false };
  document.getElementById('y').textContent = new Date().getFullYear();

  // ---------- helpers ----------
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : ''; }
  function stars(n) { n = Math.round(n || 0); return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }
  function initials(n) { return h((n || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase()); }
  function bg(u) { u = safeUrl(u); return u ? ' style="background-image:url(&quot;' + h(u) + '&quot;)"' : ''; }
  function msg(el, text, ok) { el.textContent = text; el.className = 'msg ' + (ok ? 'ok' : 'err'); }
  function $(sel) { return app.querySelector(sel); }
  function avg(list) { if (!list.length) return 0; return list.reduce(function (a, r) { return a + r.rating; }, 0) / list.length; }

  async function refreshUser() {
    var r = await sb.auth.getUser();
    state.user = r.data && r.data.user || null;
    state.admin = false;
    if (state.user) { var a = await sb.rpc('is_admin'); state.admin = a.data === true; }
    renderNav();
  }
  function renderNav() {
    var r = location.hash || '#/';
    var links = [['#/', 'Find a chef'], ['#/account', state.user ? 'My chef profile' : 'Chef sign-up / Log in']];
    if (state.admin) links.push(['#/admin', 'Admin']);
    nav.innerHTML = links.map(function (l) { return '<a href="' + l[0] + '"' + (r === l[0] ? ' class="on"' : '') + '>' + l[1] + '</a>'; }).join('') +
      (state.user ? '<a href="#" id="logout">Log out</a>' : '');
    var lo = document.getElementById('logout');
    if (lo) lo.onclick = async function (e) { e.preventDefault(); await sb.auth.signOut(); await refreshUser(); location.hash = '#/'; route(); };
  }

  // ---------- directory ----------
  async function viewDirectory() {
    app.innerHTML = '<div class="hero2"><h1>Find your private chef</h1><p class="muted">Browse approved chefs, see their work and reviews, then book on their Square booking page.</p></div>' +
      '<div class="toolbar"><input id="q" placeholder="Search by name, cuisine or town"><select id="cz"><option value="">All cuisines</option></select></div><div class="grid" id="list"><p class="muted">Loading chefs…</p></div>';
    var res = await sb.from('chef_profiles').select('id,name,bio,cuisines,service_area,photo_url,square_booking_url').eq('status', 'approved').order('name');
    var rv = await sb.from('chef_reviews').select('chef_id,rating');
    if (res.error) { $('#list').innerHTML = '<p class="msg err">' + h(res.error.message) + '</p>'; return; }
    var chefs = res.data, reviews = rv.data || [];
    var cz = {}; chefs.forEach(function (c) { (c.cuisines || []).forEach(function (x) { cz[x] = 1; }); });
    $('#cz').innerHTML += Object.keys(cz).sort().map(function (x) { return '<option>' + h(x) + '</option>'; }).join('');
    function draw() {
      var q = $('#q').value.toLowerCase(), c = $('#cz').value;
      var list = chefs.filter(function (x) {
        var hay = (x.name + ' ' + (x.cuisines || []).join(' ') + ' ' + (x.service_area || '') + ' ' + (x.bio || '')).toLowerCase();
        return (!q || hay.indexOf(q) >= 0) && (!c || (x.cuisines || []).indexOf(c) >= 0);
      });
      $('#list').innerHTML = list.length ? list.map(function (x) {
        var rs = reviews.filter(function (r) { return r.chef_id === x.id; });
        return '<a class="card chef" href="#/chef/' + h(x.id) + '"><div class="ph"' + bg(x.photo_url) + '>' + (safeUrl(x.photo_url) ? '' : initials(x.name)) + '</div><div class="bd"><h3>' + h(x.name) + '</h3>' +
          '<div class="small muted">' + h(x.service_area || '') + '</div>' +
          (rs.length ? '<div class="small"><span class="stars">' + stars(avg(rs)) + '</span> <span class="muted">(' + rs.length + ')</span></div>' : '<div class="small muted">No reviews yet</div>') +
          '<div class="tags">' + (x.cuisines || []).slice(0, 4).map(function (t) { return '<span class="tag">' + h(t) + '</span>'; }).join('') + '</div></div></a>';
      }).join('') : '<div class="card"><h3>No chefs listed yet</h3><p class="muted">We\'re welcoming our first chefs now. Are you a private chef? <a href="#/account">Create your profile</a>.</p></div>';
    }
    $('#q').oninput = draw; $('#cz').onchange = draw; draw();
  }

  // ---------- chef profile ----------
  async function viewChef(id) {
    app.innerHTML = '<p class="muted">Loading…</p>';
    var c = await sb.from('chef_profiles').select('*').eq('id', id).maybeSingle();
    if (c.error || !c.data) { app.innerHTML = '<div class="card"><h2>Chef not found</h2><p class="muted">This profile may not be approved yet. <a href="#/">Back to all chefs</a></p></div>'; return; }
    var x = c.data;
    var pf = await sb.from('chef_portfolio').select('*').eq('chef_id', id).order('sort').order('created_at');
    var rv = await sb.from('chef_reviews').select('*').eq('chef_id', id).order('created_at', { ascending: false });
    var reviews = (rv.data || []).filter(function (r) { return !r.hidden; });
    var mine = state.user && (rv.data || []).find(function (r) { return r.user_id === state.user.id; });
    var book = safeUrl(x.square_booking_url);
    app.innerHTML = '<p class="small"><a href="#/">← All chefs</a></p><br>' +
      (x.status !== 'approved' ? '<p class="pill ' + h(x.status) + '">Preview: this profile is ' + h(x.status) + ' and not public yet</p><br><br>' : '') +
      '<div class="profile"><div><div class="ph"' + bg(x.photo_url) + '>' + (safeUrl(x.photo_url) ? '' : initials(x.name)) + '</div>' +
      '<div style="margin-top:16px">' + (book ? '<a class="btn" id="bookbtn" href="' + h(book) + '" target="_blank" rel="noopener">Book with Square ↗</a><p class="small muted" style="margin-top:8px">Booking, deposits and payment happen on the chef\'s Square page.</p>' : '<p class="small muted">Online booking coming soon for this chef.</p>') + '</div>' +
      (safeUrl(x.website) ? '<p class="small" style="margin-top:10px"><a href="' + h(x.website) + '" target="_blank" rel="noopener">Website ↗</a></p>' : '') +
      (x.instagram ? '<p class="small"><a href="https://instagram.com/' + h(String(x.instagram).replace(/^@/, '')) + '" target="_blank" rel="noopener">@' + h(String(x.instagram).replace(/^@/, '')) + '</a></p>' : '') +
      '</div><div><h1>' + h(x.name) + '</h1><p class="muted">' + h(x.service_area || '') + '</p>' +
      '<p><span class="stars">' + stars(avg(reviews)) + '</span> <span class="muted small">' + (reviews.length ? avg(reviews).toFixed(1) + ' from ' + reviews.length + ' review' + (reviews.length > 1 ? 's' : '') : 'No reviews yet') + '</span></p>' +
      '<div class="tags">' + (x.cuisines || []).map(function (t) { return '<span class="tag">' + h(t) + '</span>'; }).join('') + '</div>' +
      '<p style="margin-top:16px;white-space:pre-line">' + h(x.bio || '') + '</p>' +
      '<h2 style="margin-top:30px">Portfolio</h2>' +
      ((pf.data || []).length ? '<div class="gallery">' + pf.data.map(function (p) { return '<figure><img loading="lazy" src="' + h(safeUrl(p.image_url)) + '" alt="' + h(p.caption || x.name) + '">' + (p.caption ? '<figcaption>' + h(p.caption) + '</figcaption>' : '') + '</figure>'; }).join('') + '</div>' : '<p class="muted">No photos yet.</p>') +
      '<h2 style="margin-top:30px">Reviews</h2><div id="rform"></div><div id="rlist">' +
      (reviews.length ? reviews.map(function (r) {
        return '<div class="review"><div class="row"><span class="stars">' + stars(r.rating) + '</span><b>' + h(r.reviewer_name) + '</b><span class="small muted">' + new Date(r.created_at).toLocaleDateString() + '</span>' +
          (state.user && r.user_id !== state.user.id ? '<button class="btn ghost sm flag" data-id="' + h(r.id) + '">Report</button>' : '') + '</div><p style="white-space:pre-line">' + h(r.body || '') + '</p></div>';
      }).join('') : '<p class="muted">Be the first to leave a review.</p>') + '</div></div></div>';

    app.querySelectorAll('.flag').forEach(function (b) {
      b.onclick = async function () { var r = await sb.rpc('flag_review', { p_kind: 'chef', p_id: b.dataset.id }); b.textContent = r.error ? 'Error' : 'Reported'; b.disabled = true; };
    });
    var rf = $('#rform');
    if (x.status !== 'approved') { rf.innerHTML = ''; return; }
    if (!state.user) { rf.innerHTML = '<p class="muted"><a href="#/account">Log in</a> to leave a review.</p>'; return; }
    if (state.user.id === x.user_id) { rf.innerHTML = '<p class="muted small">This is your profile, so you can\'t review it.</p>'; return; }
    var pick = mine ? mine.rating : 5;
    rf.innerHTML = '<div class="card" style="margin-bottom:10px"><b>' + (mine ? 'Edit your review' : 'Leave a review') + '</b><div class="starpick" id="sp"></div>' +
      '<label>Your name as shown</label><input id="rn" maxlength="80" value="' + h(mine ? mine.reviewer_name : (state.user.email || '').split('@')[0]) + '">' +
      '<label>Your review</label><textarea id="rb" rows="3" maxlength="2000">' + h(mine ? mine.body : '') + '</textarea><br><br><button class="btn" id="rsave">' + (mine ? 'Update review' : 'Post review') + '</button>' +
      (mine ? ' <button class="btn ghost" id="rdel">Delete</button>' : '') + '<div class="msg" id="rm"></div></div>';
    function drawStars() { $('#sp').innerHTML = [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" data-v="' + i + '" class="' + (i <= pick ? 'on' : '') + '" aria-label="' + i + ' stars">★</button>'; }).join(''); $('#sp').querySelectorAll('button').forEach(function (b) { b.onclick = function () { pick = +b.dataset.v; drawStars(); }; }); }
    drawStars();
    $('#rsave').onclick = async function () {
      var row = { chef_id: id, user_id: state.user.id, rating: pick, reviewer_name: $('#rn').value.trim() || 'Guest', body: $('#rb').value.trim() };
      var r = mine ? await sb.from('chef_reviews').update(row).eq('id', mine.id) : await sb.from('chef_reviews').insert(row);
      if (r.error) return msg($('#rm'), r.error.message);
      viewChef(id);
    };
    if (mine) $('#rdel').onclick = async function () { await sb.from('chef_reviews').delete().eq('id', mine.id); viewChef(id); };
  }

  // ---------- account / chef sign-up ----------
  function viewAuth() {
    app.innerHTML = '<div class="two"><div class="card"><h2>Chefs: join Chef Bookings</h2><p class="muted">Create a free account, build your profile and portfolio, and add your Square booking link. Profiles go live after a quick review.</p>' +
      '<p class="muted small" style="margin-top:10px">Diners: log in to leave reviews.</p></div>' +
      '<div class="card"><div class="row"><button class="btn sm" id="tin">Log in</button><button class="btn ghost sm" id="tup">Create account</button></div>' +
      '<form id="af"><label>Email</label><input id="ae" type="email" autocomplete="email" required><label>Password</label><input id="ap" type="password" minlength="8" autocomplete="current-password" required>' +
      '<br><br><button class="btn" id="ago">Log in</button> <a href="#" id="forgot" class="small">Forgot password?</a><div class="msg" id="am"></div></form></div></div>';
    var mode = 'in';
    function setMode(m) { mode = m; $('#ago').textContent = m === 'in' ? 'Log in' : 'Create account'; $('#tin').className = 'btn sm' + (m === 'in' ? '' : ' ghost'); $('#tup').className = 'btn sm' + (m === 'up' ? '' : ' ghost'); $('#ap').autocomplete = m === 'in' ? 'current-password' : 'new-password'; }
    $('#tin').onclick = function () { setMode('in'); }; $('#tup').onclick = function () { setMode('up'); };
    $('#forgot').onclick = async function (e) { e.preventDefault(); var em = $('#ae').value.trim(); if (!em) return msg($('#am'), 'Enter your email first.'); var r = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + '/chefs/#/account' }); msg($('#am'), r.error ? r.error.message : 'Check your email for a reset link.', !r.error); };
    $('#af').onsubmit = async function (e) {
      e.preventDefault(); var em = $('#ae').value.trim(), pw = $('#ap').value;
      if (pw.length < 8) return msg($('#am'), 'Password must be at least 8 characters.');
      var r = mode === 'in' ? await sb.auth.signInWithPassword({ email: em, password: pw }) : await sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: location.origin + '/chefs/#/account' } });
      if (r.error) return msg($('#am'), r.error.message);
      if (mode === 'up' && !r.data.session) return msg($('#am'), 'Almost done! Check your email and click the confirmation link, then log in.', true);
      await refreshUser(); route();
    };
  }

  async function viewAccount() {
    if (!state.user) return viewAuth();
    var uid = state.user.id;
    var c = await sb.from('chef_profiles').select('*').eq('user_id', uid).maybeSingle();
    var x = c.data || { name: '', bio: '', cuisines: [], service_area: '', photo_url: '', square_booking_url: '', website: '', instagram: '' };
    app.innerHTML = '<h1>My chef profile</h1><p class="muted">Signed in as ' + h(state.user.email) + (state.admin ? ' · <b>Admin</b>' : '') + '</p><br>' +
      (c.data ? '<p>Status: <span class="pill ' + h(x.status) + '">' + h(x.status) + '</span> ' + (x.status === 'approved' ? '<a href="#/chef/' + h(x.id) + '">View public profile</a>' : x.status === 'pending' ? '<span class="small muted">We\'ll review it shortly.</span>' : '<span class="small muted">' + h(x.admin_note || 'Please update your profile and contact us.') + '</span>') + '</p><br>' : '<p class="muted">Not a chef? You can still leave reviews on any chef\'s page.</p><br>') +
      '<div class="two"><form class="card" id="pf"><h3>' + (c.data ? 'Edit profile' : 'Create your chef profile') + '</h3>' +
      '<label>Name (shown publicly)</label><input id="f_name" required maxlength="120" value="' + h(x.name) + '">' +
      '<label>Bio</label><textarea id="f_bio" rows="5" maxlength="4000">' + h(x.bio) + '</textarea>' +
      '<label>Cuisines (comma separated)</label><input id="f_cz" placeholder="Italian, Seafood, Vegan" value="' + h((x.cuisines || []).join(', ')) + '">' +
      '<label>Service area</label><input id="f_area" maxlength="200" placeholder="Falmouth & the Upper Cape" value="' + h(x.service_area) + '">' +
      '<label>Square Appointments booking link</label><input id="f_sq" type="url" placeholder="https://book.squareup.com/appointments/…" value="' + h(x.square_booking_url) + '">' +
      '<p class="small muted" style="margin-top:6px">Bookings, deposits and payments run through Square. Paste your Square Appointments "Online Booking" link here.</p>' +
      '<div class="two"><div><label>Website</label><input id="f_web" type="url" placeholder="https://" value="' + h(x.website) + '"></div><div><label>Instagram</label><input id="f_ig" placeholder="@yourname" value="' + h(x.instagram) + '"></div></div>' +
      '<label>Profile photo</label><input id="f_photo" type="file" accept="image/*">' + (safeUrl(x.photo_url) ? '<p class="small muted">Current photo saved. Choose a new file to replace it.</p>' : '') +
      '<br><br><button class="btn" id="psave">' + (c.data ? 'Save changes' : 'Submit for approval') + '</button><div class="msg" id="pm"></div></form>' +
      '<div class="card"><h3>Portfolio gallery</h3>' + (c.data ? '<label>Add photo</label><input id="g_file" type="file" accept="image/*" multiple><label>Caption (optional)</label><input id="g_cap" maxlength="300"><br><br><button class="btn" id="gadd">Upload</button><div class="msg" id="gm"></div><div class="gallery" id="gal"></div>' : '<p class="muted">Create your profile first, then add photos of your dishes and events.</p>') + '</div></div>';

    async function upload(file, prefix) {
      if (file.size > 5 * 1024 * 1024) throw new Error('Each photo must be under 5 MB.');
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      var path = uid + '/' + prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      var u = await sb.storage.from('chef-photos').upload(path, file, { contentType: file.type, upsert: false });
      if (u.error) throw u.error;
      return { path: path, url: sb.storage.from('chef-photos').getPublicUrl(path).data.publicUrl };
    }
    $('#pf').onsubmit = async function (e) {
      e.preventDefault(); var m = $('#pm'); msg(m, 'Saving…', true);
      try {
        var row = {
          name: $('#f_name').value.trim(), bio: $('#f_bio').value.trim(),
          cuisines: $('#f_cz').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 12),
          service_area: $('#f_area').value.trim(), square_booking_url: $('#f_sq').value.trim() || null,
          website: $('#f_web').value.trim() || null, instagram: $('#f_ig').value.trim() || null
        };
        if (row.square_booking_url && !/^https:\/\//i.test(row.square_booking_url)) throw new Error('The Square link must start with https://');
        if (row.website && !/^https?:\/\//i.test(row.website)) throw new Error('Website must start with http:// or https://');
        var f = $('#f_photo').files[0]; if (f) row.photo_url = (await upload(f, 'profile')).url;
        var r = c.data ? await sb.from('chef_profiles').update(row).eq('id', c.data.id) : await sb.from('chef_profiles').insert(Object.assign({ user_id: uid }, row));
        if (r.error) throw r.error;
        viewAccount();
      } catch (err) { msg(m, err.message || String(err)); }
    };
    if (!c.data) return;
    async function drawGal() {
      var g = await sb.from('chef_portfolio').select('*').eq('chef_id', c.data.id).order('created_at');
      $('#gal').innerHTML = (g.data || []).map(function (p) { return '<figure><img src="' + h(safeUrl(p.image_url)) + '" alt=""><figcaption>' + h(p.caption || '') + ' <button class="btn ghost sm gdel" data-id="' + h(p.id) + '" data-path="' + h(p.storage_path || '') + '">Remove</button></figcaption></figure>'; }).join('') || '<p class="muted small">No photos yet.</p>';
      app.querySelectorAll('.gdel').forEach(function (b) { b.onclick = async function () { await sb.from('chef_portfolio').delete().eq('id', b.dataset.id); if (b.dataset.path) await sb.storage.from('chef-photos').remove([b.dataset.path]); drawGal(); }; });
    }
    drawGal();
    $('#gadd').onclick = async function () {
      var files = $('#g_file').files, m = $('#gm'); if (!files.length) return msg(m, 'Choose a photo first.');
      msg(m, 'Uploading…', true);
      try {
        for (var i = 0; i < files.length; i++) {
          var up = await upload(files[i], 'portfolio');
          var r = await sb.from('chef_portfolio').insert({ chef_id: c.data.id, image_url: up.url, storage_path: up.path, caption: $('#g_cap').value.trim() || null });
          if (r.error) throw r.error;
        }
        $('#g_file').value = ''; $('#g_cap').value = ''; msg(m, 'Uploaded!', true); drawGal();
      } catch (err) { msg(m, err.message || String(err)); }
    };
  }

  // ---------- admin ----------
  async function viewAdmin() {
    if (!state.admin) { app.innerHTML = '<div class="card"><h2>Admins only</h2><p class="muted">Log in with the admin account to manage chefs and reviews.</p></div>'; return; }
    var ch = await sb.from('chef_profiles').select('*').order('created_at', { ascending: false });
    var rv = await sb.from('chef_reviews').select('*, chef_profiles(name)').order('flagged', { ascending: false }).order('created_at', { ascending: false });
    var wl = await sb.from('site_waitlist').select('*').eq('site', 'chefbookings').order('created_at', { ascending: false });
    var chefs = ch.data || [], reviews = rv.data || [];
    app.innerHTML = '<h1>Admin</h1><br><div class="card"><h3>Chef profiles (' + chefs.filter(function (c) { return c.status === 'pending'; }).length + ' pending)</h3><table><tr><th>Chef</th><th>Area</th><th>Status</th><th></th></tr>' +
      chefs.map(function (c) { return '<tr><td><a href="#/chef/' + h(c.id) + '">' + h(c.name) + '</a><div class="small muted">' + h((c.cuisines || []).join(', ')) + '</div></td><td>' + h(c.service_area || '') + '</td><td><span class="pill ' + h(c.status) + '">' + h(c.status) + '</span></td><td class="row">' +
        (c.status !== 'approved' ? '<button class="btn sm act" data-t="chef" data-id="' + h(c.id) + '" data-v="approved">Approve</button>' : '') +
        (c.status !== 'rejected' ? '<button class="btn ghost sm act" data-t="chef" data-id="' + h(c.id) + '" data-v="rejected">Reject</button>' : '') + '</td></tr>'; }).join('') + '</table></div><br>' +
      '<div class="card"><h3>Reviews (' + reviews.filter(function (r) { return r.flagged; }).length + ' reported)</h3><table><tr><th>Review</th><th>Chef</th><th>State</th><th></th></tr>' +
      reviews.map(function (r) { return '<tr><td><span class="stars">' + stars(r.rating) + '</span> <b>' + h(r.reviewer_name) + '</b><div class="small">' + h(r.body || '') + '</div></td><td>' + h(r.chef_profiles ? r.chef_profiles.name : '') + '</td><td>' + (r.flagged ? '<span class="pill rejected">reported</span> ' : '') + (r.hidden ? '<span class="pill">hidden</span>' : '<span class="pill approved">visible</span>') + '</td><td class="row">' +
        '<button class="btn ghost sm rv" data-id="' + h(r.id) + '" data-hidden="' + (!r.hidden) + '">' + (r.hidden ? 'Unhide' : 'Hide') + '</button>' + (r.flagged ? '<button class="btn ghost sm rvc" data-id="' + h(r.id) + '">Clear report</button>' : '') + '</td></tr>'; }).join('') + '</table></div><br>' +
      '<div class="card"><h3>Waitlist (' + (wl.data || []).length + ')</h3><p class="small muted">' + (wl.data || []).map(function (w) { return h(w.email) + (w.role ? ' (' + h(w.role) + ')' : ''); }).join(', ') + '</p></div>';
    app.querySelectorAll('.act').forEach(function (b) { b.onclick = async function () { b.disabled = true; var r = await sb.from('chef_profiles').update({ status: b.dataset.v }).eq('id', b.dataset.id); if (r.error) alert(r.error.message); viewAdmin(); }; });
    app.querySelectorAll('.rv').forEach(function (b) { b.onclick = async function () { await sb.from('chef_reviews').update({ hidden: b.dataset.hidden === 'true', flagged: false }).eq('id', b.dataset.id); viewAdmin(); }; });
    app.querySelectorAll('.rvc').forEach(function (b) { b.onclick = async function () { await sb.from('chef_reviews').update({ flagged: false }).eq('id', b.dataset.id); viewAdmin(); }; });
  }

  // ---------- router ----------
  async function route() {
    renderNav();
    var r = location.hash || '#/';
    var m = r.match(/^#\/chef\/([0-9a-f-]{36})$/);
    window.scrollTo(0, 0);
    if (m) return viewChef(m[1]);
    if (r === '#/account') return viewAccount();
    if (r === '#/admin') return viewAdmin();
    return viewDirectory();
  }
  window.addEventListener('hashchange', route);
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') refreshUser(); if (ev === 'PASSWORD_RECOVERY') { var p = prompt('Choose a new password (8+ characters)'); if (p) sb.auth.updateUser({ password: p }).then(function (r) { alert(r.error ? r.error.message : 'Password updated.'); }); } });
  refreshUser().then(route);
})();
