/* Simple phone view for a project ledger page.
   Uses the page's own state (state.ledger / state.planned / state.rent / state.db) and its mortgage math.
   Add, edit, mark paid, delete (kept + undo), and receipt photos. */
(function(){
  "use strict";
  var CATS = ["Plans","Permits","Site prep","Demolition","Survey","Plumbing","Foundation","Framing","Inspections",
    "Materials","Labor","Repairs","Utilities","Insurance","Other"];
  var M = { tab: "cost", edit: null, kind: "cost", photo: undefined, busy: false };

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function money(n){ return "$" + Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function mdy(iso){ var p = String(iso || "").split("-"); return p[2] ? p[1]+"/"+p[2].slice(0,2)+"/"+p[0].slice(2) : (p[1] ? p[1]+"/"+p[0].slice(2) : ""); }
  function today(){ var d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function isPhone(){ return window.matchMedia("(max-width: 720px)").matches; }
  function viewPref(){ try { return localStorage.getItem("ddg-view"); } catch(e){ return null; } }
  function setView(v){ try { localStorage.setItem("ddg-view", v); } catch(e){} apply(); }
  function apply(){
    var simple = viewPref() ? viewPref() === "simple" : isPhone();
    document.body.classList.toggle("m-on", simple);
    if (!simple && typeof buildChart === "function") setTimeout(buildChart, 30);
    window.scrollTo(0, 0);
  }

  var css = '\
body.m-on > .wrap{display:none!important}\
#m{display:none}\
body.m-on #m{display:block}\
#m{max-width:640px;margin:0 auto;padding-bottom:110px}\
#m .mtop{display:flex;align-items:center;gap:8px;font-size:14px;margin-bottom:10px}\
#m .mtop a,#m .mtop button{font:inherit;font-weight:700;color:var(--accent);background:var(--accent-soft);border:0;border-radius:999px;padding:6px 12px;text-decoration:none;cursor:pointer}\
#m .mtop .sp{flex:1}\
#m h1{font-size:28px;line-height:1.1}\
#m .msub{color:var(--muted);font-size:14px;margin:2px 0 14px}\
#m .mtiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}\
#m .mt{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 12px}\
#m .mt .l{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--muted)}\
#m .mt .v{font-family:"Barlow Semi Condensed",sans-serif;font-size:24px;font-weight:700}\
#m .red{color:var(--bad)} #m .grn{color:var(--good)} #m .yel{color:var(--warn)}\
#m .mtabs{display:flex;background:var(--chip);border-radius:10px;padding:3px;margin:16px 0 8px}\
#m .mtabs button{flex:1;font:inherit;font-weight:700;font-size:15px;border:0;background:none;color:var(--muted);padding:9px 0;border-radius:8px;cursor:pointer}\
#m .mtabs button.on{background:var(--surface);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}\
#m .mlist{background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:hidden}\
#m .mrow{display:flex;gap:10px;align-items:center;width:100%;text-align:left;font:inherit;font-size:15px;color:inherit;background:none;border:0;border-top:1px solid var(--line);padding:12px 14px;cursor:pointer}\
#m .mrow:first-child{border-top:0}\
#m .mrow .d{flex:1;min-width:0}\
#m .mrow .t{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
#m .mrow .s{color:var(--muted);font-size:13px}\
#m .mrow .a{font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}\
#m .mrow.auto{cursor:default;opacity:.75}\
#m .mtot{display:flex;justify-content:space-between;font-weight:700;padding:10px 14px;font-size:15px}\
#m .mempty{color:var(--muted);padding:22px 14px;text-align:center}\
#m .mfull{display:block;margin:16px auto 0;font:inherit;font-size:14px;font-weight:700;color:var(--muted);background:none;border:1px solid var(--line);border-radius:999px;padding:6px 14px;cursor:pointer}\
#m-add{position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));max-width:608px;margin:0 auto;z-index:30;\
  font:inherit;font-size:18px;font-weight:700;color:#fff;background:var(--accent);border:0;border-radius:14px;padding:16px;box-shadow:0 6px 20px rgba(0,0,0,.2);cursor:pointer;display:none}\
body.m-on #m-add{display:block}\
#m-sheet{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.45);display:flex;align-items:flex-end;justify-content:center}\
#m-sheet .sh{background:var(--surface);width:100%;max-width:640px;border-radius:16px 16px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));max-height:94vh;overflow:auto}\
#m-sheet h3{font-family:"Barlow Semi Condensed",sans-serif;font-size:22px;margin:0 0 10px}\
#m-sheet label{display:block;font-size:12.5px;font-weight:700;color:var(--muted);margin:10px 0 4px}\
#m-sheet input,#m-sheet select{width:100%;box-sizing:border-box;font:inherit;font-size:16px;color:var(--ink);background:var(--ground);border:1px solid var(--line);border-radius:10px;padding:11px}\
#m-sheet .amt{font-size:26px;font-weight:700;font-variant-numeric:tabular-nums}\
#m-sheet .seg{display:flex;background:var(--chip);border-radius:10px;padding:3px}\
#m-sheet .seg button{flex:1;font:inherit;font-weight:700;border:0;background:none;color:var(--muted);padding:9px 0;border-radius:8px;cursor:pointer}\
#m-sheet .seg button.on{background:var(--surface);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.12)}\
#m-sheet .photo{display:flex;align-items:center;gap:10px;margin-top:4px}\
#m-sheet .photo label.pbtn{margin:0;flex:1;text-align:center;font-size:15px;color:var(--accent);background:var(--accent-soft);border-radius:10px;padding:12px;cursor:pointer}\
#m-sheet .photo img{width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid var(--line);cursor:pointer}\
#m-sheet .btns{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap}\
#m-sheet .btns button{flex:1;font:inherit;font-weight:700;font-size:16px;border:0;border-radius:10px;padding:14px;cursor:pointer;background:var(--chip);color:var(--ink)}\
#m-sheet .btns .save{background:var(--accent);color:#fff}\
#m-sheet .btns .paid{background:var(--good);color:#fff}\
#m-sheet .btns .del{flex-basis:100%;background:none;color:var(--bad)}\
#m-sheet .msg{color:var(--bad);font-size:14px;margin-top:8px;min-height:18px}\
#m-photo{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,.9);display:grid;place-items:center;padding:16px}\
#m-photo img{max-width:100%;max-height:90vh;border-radius:8px}\
.m-fullbtn{font:inherit;font-weight:700;color:var(--accent);background:var(--accent-soft);border:0;border-radius:999px;padding:5px 12px;cursor:pointer}\
';

  function rowsFor(tab){
    var r = [];
    if (tab === "cost"){
      state.ledger.forEach(function(e){ r.push({ store:"costs", e:e, date:e.date, title:e.desc || e.cat, sub:e.cat, amt:e.amt, cls:e.amt < 0 ? "grn" : "red" }); });
      var made = paymentsMade();
      for (var k = 1; k <= made; k++){
        var d = new Date(FIRST.getFullYear(), FIRST.getMonth() + (k - 1), 1);
        r.push({ auto:true, date:isoOf(d), title:"Mortgage payment " + k, sub:"Mortgage · automatic", amt:PMT, cls:"red" });
      }
    } else if (tab === "planned"){
      state.planned.forEach(function(e){ r.push({ store:"planned", e:e, date:e.date || e.month, title:e.desc || e.cat, sub:e.cat, amt:e.amt, cls:"yel" }); });
    } else if (tab === "receipt"){
      (state.receipts || []).forEach(function(e){ r.push({ store:"receipts", e:e, date:e.date, title:e.desc || "Receipt", sub:"Receipt", amt:e.amt, cls:"" }); });
    } else {
      state.rent.forEach(function(e){ r.push({ store:"rent", e:e, date:e.date, title:(e.unit || "Rent") + (e.desc ? " — " + e.desc : ""), sub:"Rent", amt:e.amt, cls:"grn" }); });
    }
    r.sort(function(a,b){ return tab === "planned" ? (a.date < b.date ? -1 : 1) : (a.date < b.date ? 1 : -1); });
    return r;
  }

  function render(){
    if (!$("m")) return;
    var paid = state.ledger.reduce(function(s,e){ return s + (e.amt > 0 ? e.amt : 0); }, 0) + paymentsMade() * PMT;
    var refunds = state.ledger.reduce(function(s,e){ return s + (e.amt < 0 ? -e.amt : 0); }, 0);
    var proj = state.planned.reduce(function(s,e){ return s + e.amt; }, 0);
    var rent = state.rent.reduce(function(s,e){ return s + e.amt; }, 0) + refunds;
    $("m-paid").textContent = money(paid);
    $("m-proj").textContent = money(proj);
    $("m-rent").textContent = "+" + money(rent);
    $("m-owed").textContent = money(balAfter(paymentsMade()));
    document.querySelectorAll("#m .mtabs button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-t") === M.tab); });
    var rows = rowsFor(M.tab), h = "", tot = 0;
    if (!state.db) h = '<div class="mempty">Loading&hellip;</div>';
    else if (!rows.length) h = '<div class="mempty">Nothing here yet. Tap + Add.</div>';
    rows.forEach(function(r, i){
      tot += r.cls === "grn" && M.tab === "cost" ? -Math.abs(r.amt) : r.amt;
      var raw = r.e && window.DDG && DDG.raw ? DDG.raw(r.e.id) : null;
      var cam = raw && raw.meta && raw.meta.photo ? " · 📷" : "";
      h += '<button type="button" class="mrow' + (r.auto ? " auto" : "") + '" data-i="' + i + '">'
        + '<div class="d"><div class="t">' + esc(r.title) + '</div><div class="s">' + mdy(r.date) + ' · ' + esc(r.sub) + cam + '</div></div>'
        + '<div class="a ' + r.cls + '">' + (r.cls === "grn" ? "+" : "") + money(r.amt) + '</div></button>';
    });
    if (M.tab === "receipt"){
      var cash = state.ledger.reduce(function(s2, e){ return s2 + (/^Dad\b/.test(e.desc || "") && e.cat === "Materials" ? e.amt : 0); }, 0);
      h += '<div class="mtot"><span>Receipts total</span><span>' + money(tot) + '</span></div>'
        + '<div class="mtot"><span>Cash given to Dad for materials</span><span>' + money(cash) + '</span></div>'
        + '<div class="mtot"><span>Cash on hand (not covered by a receipt)</span><span class="' + (cash - tot < 0 ? "red" : "grn") + '">' + (cash - tot < 0 ? "−" : "") + money(cash - tot) + '</span></div>';
    } else if (rows.length) h += '<div class="mtot"><span>Total</span><span class="' + (M.tab === "cost" ? "red" : M.tab === "planned" ? "yel" : "grn") + '">' + money(tot) + '</span></div>';
    $("m-list").innerHTML = h;
    $("m-list").querySelectorAll(".mrow").forEach(function(b){
      var r = rows[+b.getAttribute("data-i")];
      if (!r.auto) b.onclick = function(){ openSheet(r); };
    });
  }

  function catOptions(cur){
    var list = CATS.slice(); if (cur && list.indexOf(cur) < 0) list.push(cur);
    return list.map(function(c){ return '<option' + (c === cur ? " selected" : "") + '>' + esc(c) + '</option>'; }).join("");
  }

  function openSheet(r){
    M.edit = r || null;
    M.kind = r ? (r.store === "costs" ? "cost" : r.store === "planned" ? "planned" : r.store === "receipts" ? "receipt" : "rent") : M.tab;
    var e = r ? r.e : null;
    var raw = e && window.DDG && DDG.raw ? DDG.raw(e.id) : null;
    M.photo = raw && raw.meta ? raw.meta.photo : undefined;
    var d = document.createElement("div"); d.id = "m-sheet";
    d.innerHTML = '<div class="sh" role="dialog" aria-label="' + (e ? "Edit entry" : "Add entry") + '">'
      + '<h3>' + (e ? "Edit entry" : "Add entry") + '</h3>'
      + '<div class="seg" id="ms-kind"><button type="button" data-k="cost">Paid</button><button type="button" data-k="planned">Projected</button><button type="button" data-k="rent">Rent</button>' + (hasReceipts() ? '<button type="button" data-k="receipt">Receipt</button>' : '') + '</div>'
      + '<label for="ms-amt">Amount ($)</label><input id="ms-amt" class="amt" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0.00" value="' + (e ? Math.abs(e.amt) : "") + '">'
      + '<label for="ms-desc" id="ms-desc-l">Description</label><input id="ms-desc" value="' + esc(e ? (M.kind === "rent" ? e.unit : e.desc) : "") + '" placeholder="e.g. Home Depot lumber">'
      + '<label for="ms-date">Date</label><input id="ms-date" type="date" value="' + esc(e ? (e.date || (e.month ? e.month + "-01" : "")) : today()) + '">'
      + '<div id="ms-cat-w"><label for="ms-cat">Category</label><select id="ms-cat">' + catOptions(e ? e.cat : "Materials") + '</select></div>'
      + '<label>Receipt photo</label><div class="photo"><label class="pbtn" for="ms-file">📷 ' + (M.photo ? "Replace photo" : "Take or attach photo") + '</label>'
      + '<input id="ms-file" type="file" accept="image/*" hidden><img id="ms-thumb" alt="Receipt photo" hidden></div>'
      + '<div class="msg" id="ms-msg"></div>'
      + '<div class="btns"><button type="button" class="save" id="ms-save">' + (e ? "Save" : "Add") + '</button>'
      + (e && M.kind === "planned" ? '<button type="button" class="paid" id="ms-paid">Paid today</button>' : '')
      + '<button type="button" id="ms-cancel">Cancel</button>'
      + (e ? '<button type="button" class="del" id="ms-del">Delete</button>' : '') + '</div></div>';
    document.body.appendChild(d);
    function syncKind(){
      d.querySelectorAll("#ms-kind button").forEach(function(b){ b.classList.toggle("on", b.getAttribute("data-k") === M.kind); });
      $("ms-cat-w").hidden = M.kind === "rent" || M.kind === "receipt";
      $("ms-desc-l").textContent = M.kind === "rent" ? "Unit / tenant" : M.kind === "receipt" ? "Store and what was bought" : "Description";
    }
    d.querySelectorAll("#ms-kind button").forEach(function(b){ b.onclick = function(){ M.kind = b.getAttribute("data-k"); syncKind(); }; });
    syncKind();
    if (M.photo && DDG.photoUrl) DDG.photoUrl(M.photo).then(function(u){ if (u){ $("ms-thumb").src = u; $("ms-thumb").hidden = false; } });
    $("ms-thumb").onclick = function(){ showPhoto($("ms-thumb").src); };
    $("ms-file").onchange = function(){
      var f = this.files && this.files[0]; if (!f) return;
      $("ms-msg").textContent = "Uploading photo…"; $("ms-save").disabled = true;
      DDG.uploadPhoto(f).then(function(res){
        M.photo = res.path; $("ms-thumb").src = res.preview; $("ms-thumb").hidden = false; $("ms-msg").textContent = "";
      }).catch(function(err){ $("ms-msg").textContent = "Photo didn't upload: " + (err.message || err); })
        .then(function(){ $("ms-save").disabled = false; });
    };
    d.addEventListener("click", function(ev){ if (ev.target === d) close(); });
    $("ms-cancel").onclick = close;
    $("ms-save").onclick = save;
    if ($("ms-paid")) $("ms-paid").onclick = function(){
      var body = bodyFrom("cost"); if (!body) return; body.date = today(); body.month = today().slice(0,7);
      move("costs", body, "Marked paid");
    };
    if ($("ms-del")) $("ms-del").onclick = function(){
      var b = $("ms-del");
      if (!b.getAttribute("data-arm")){ b.setAttribute("data-arm", "1"); b.textContent = "Tap again to delete (you can undo)"; return; }
      var r0 = M.edit, prev = Object.assign({}, r0.e);
      state.db.collection(r0.store).doc(r0.e.id).delete().then(function(){
        close();
        if (typeof pushUndo === "function") pushUndo("Deleted “" + (r0.title) + "”", function(){
          state.db.collection(r0.store).doc(r0.e.id).set(prev).catch(function(){});
        });
      }).catch(function(err){ $("ms-msg").textContent = err.message || String(err); });
    };
    setTimeout(function(){ if (!e) $("ms-amt").focus(); }, 60);
  }

  function bodyFrom(kind){
    var amt = Math.round(parseFloat($("ms-amt").value) * 100) / 100, date = $("ms-date").value;
    if (!(amt > 0)){ $("ms-msg").textContent = "Enter an amount above $0.00."; return null; }
    if (!date){ $("ms-msg").textContent = "Pick a date."; return null; }
    var desc = $("ms-desc").value.trim();
    var b = kind === "rent"
      ? { date: date, unit: desc, desc: M.edit && M.edit.store === "rent" ? (M.edit.e.desc || "") : "", amt: amt }
      : kind === "receipt" ? { date: date, desc: desc, amt: amt }
      : { date: date, month: date.slice(0, 7), cat: $("ms-cat").value, desc: desc, amt: amt };
    if (M.photo !== undefined) b.photo = M.photo;
    return b;
  }
  function storeOf(kind){ return kind === "cost" ? "costs" : kind === "planned" ? "planned" : kind === "receipt" ? "receipts" : "rent"; }
  function hasReceipts(){ return Array.isArray(state.receipts); }
  function move(target, body, label){
    var r0 = M.edit;
    var op;
    if (!r0) op = state.db.collection(target).add(body);
    else if (r0.store === target) op = state.db.collection(target).doc(r0.e.id).set(body);
    else op = state.db.collection(target).add(body).then(function(ref){ return state.db.collection(r0.store).doc(r0.e.id).delete().then(function(){ return ref; }); });
    $("ms-save").disabled = true;
    op.then(function(){ close(); M.tab = target === "costs" ? "cost" : target === "receipts" ? "receipt" : target; render(); if (typeof pushUndo === "function" && label) { /* toast only */ } })
      .catch(function(err){ $("ms-save").disabled = false; if (err && err.message !== "cancelled") $("ms-msg").textContent = err.message || String(err); });
  }
  function save(){
    var body = bodyFrom(M.kind); if (!body) return;
    move(storeOf(M.kind), body, M.edit ? "Saved" : "Added");
  }
  function close(){ var d = $("m-sheet"); if (d) d.remove(); M.edit = null; }
  function showPhoto(src){
    var d = document.createElement("div"); d.id = "m-photo"; d.innerHTML = '<img alt="Receipt photo" src="' + esc(src) + '">';
    d.onclick = function(){ d.remove(); }; document.body.appendChild(d);
  }

  function init(){
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    var name = document.body.getAttribute("data-name") || document.title;
    var sub = document.body.getAttribute("data-sub") || "";
    var m = document.createElement("div"); m.id = "m";
    m.innerHTML = '<div class="mtop"><a href="./">&lsaquo; Projects</a><span class="sp"></span><button type="button" id="m-full">Full view</button></div>'
      + '<h1>' + esc(name) + '</h1><div class="msub">' + esc(sub) + '</div>'
      + '<div class="mtiles"><div class="mt"><div class="l">Paid</div><div class="v red" id="m-paid">—</div></div>'
      + '<div class="mt"><div class="l">Projected</div><div class="v yel" id="m-proj">—</div></div>'
      + '<div class="mt"><div class="l">Money in (rent + refunds)</div><div class="v grn" id="m-rent">—</div></div>'
      + '<div class="mt"><div class="l">Owed on loan</div><div class="v" id="m-owed">—</div></div></div>'
      + '<div class="mtabs"><button type="button" data-t="cost">Paid</button><button type="button" data-t="planned">Projected</button><button type="button" data-t="rent">Rent</button>' + (hasReceipts() ? '<button type="button" data-t="receipt">Receipts</button>' : '') + '</div>'
      + '<div class="mlist" id="m-list"></div>'
      + '<button type="button" class="mfull" id="m-signout">Sign out</button>';
    document.body.insertBefore(m, document.body.firstChild);
    var add = document.createElement("button"); add.id = "m-add"; add.type = "button"; add.textContent = "+ Add";
    add.onclick = function(){ if (state.db) openSheet(null); };
    document.body.appendChild(add);
    m.querySelectorAll(".mtabs button").forEach(function(b){ b.onclick = function(){ M.tab = b.getAttribute("data-t"); render(); }; });
    $("m-full").onclick = function(){ setView("full"); };
    $("m-signout").onclick = function(){ DDG.signOut(); };
    var nav = document.querySelector(".navbar");
    if (nav){ var b = document.createElement("button"); b.type = "button"; b.className = "m-fullbtn"; b.textContent = "Simple phone view";
      b.onclick = function(){ setView("simple"); }; nav.insertBefore(b, nav.querySelector(".sp")); }
    // re-render whenever the page re-renders its ledger or rent
    var rl = window.renderLedger, rr = window.renderRent, rc = window.renderReceipts;
    if (typeof rc === "function") window.renderReceipts = function(){ rc.apply(this, arguments); render(); };
    window.renderLedger = function(){ rl.apply(this, arguments); render(); };
    window.renderRent = function(){ rr.apply(this, arguments); render(); };
    apply(); render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
