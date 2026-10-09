/* Direct Development Group — shared sign-in + database layer (Supabase).
   Gives each project page the same db interface its original tracker used:
   db.collection("costs"|"planned"|"rent"|"receipts").add / .doc(id).set / .doc(id).delete / .onSnapshot
   db.doc("meta/settings"|"meta/milestones").set / .onSnapshot
   Deletes are soft (deleted_at) and every change is kept in entries_history by the database. */
(function(){
  "use strict";
  var SB_URL = "https://bfucxcjomxiwvumxeteq.supabase.co";
  var SB_KEY = "sb_publishable_MBLFsCMUVuqnlxYlb1eFDQ_VDyDw7XL";
  var sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  var KIND = { costs: "cost", planned: "planned", rent: "rent", receipts: "receipt" };
  var STORE = { cost: "costs", planned: "planned", rent: "rent", receipt: "receipts" };

  function money(n){ return "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function mdy(iso){ var p = String(iso || "").split("-"); return p[2] ? p[1] + "/" + p[2].slice(0, 2) + "/" + p[0].slice(2) : String(iso || ""); }

  /* ---------- sign-in overlay ---------- */
  function loginOverlay(){
    return new Promise(function(resolve){
      var d = document.createElement("div");
      d.id = "ddg-login";
      d.innerHTML =
        '<style>#ddg-login{position:fixed;inset:0;z-index:100;background:var(--ground,#F6F5F1);display:grid;place-items:center;padding:16px;font-family:"Public Sans",system-ui,sans-serif}' +
        '#ddg-login .box{width:100%;max-width:380px;background:var(--surface,#fff);border:1px solid var(--line,#E4E2DA);border-radius:12px;padding:22px}' +
        '#ddg-login h1{font-family:"Barlow Semi Condensed",sans-serif;font-size:26px;margin:0 0 4px;color:var(--ink,#20242A)}' +
        '#ddg-login p{color:var(--muted,#66707A);margin:0 0 14px;font-size:14px}' +
        '#ddg-login label{display:block;font-size:12px;font-weight:700;color:var(--muted,#66707A);margin:10px 0 4px}' +
        '#ddg-login input{width:100%;box-sizing:border-box;font:inherit;padding:10px;border:1px solid var(--line,#E4E2DA);border-radius:8px;background:var(--ground,#F6F5F1);color:var(--ink,#20242A)}' +
        '#ddg-login button{margin-top:14px;width:100%;font:inherit;font-weight:700;background:var(--accent,#1E6E9C);color:#fff;border:0;border-radius:8px;padding:11px;cursor:pointer}' +
        '#ddg-login .err{color:var(--bad,#B3403A);font-size:13px;min-height:18px;margin-top:8px}</style>' +
        '<form class="box"><h1>Direct Development Group</h1><p>Sign in to open the project ledgers.</p>' +
        '<label for="ddg-e">Email</label><input id="ddg-e" type="email" autocomplete="username" value="fange001@ucr.edu">' +
        '<label for="ddg-p">Password</label><input id="ddg-p" type="password" autocomplete="current-password">' +
        '<button type="submit">Sign in</button><div class="err" id="ddg-err"></div></form>';
      document.body.appendChild(d);
      setTimeout(function(){ document.getElementById("ddg-p").focus(); }, 50);
      d.querySelector("form").addEventListener("submit", function(ev){
        ev.preventDefault();
        var err = document.getElementById("ddg-err"); err.textContent = "";
        sb.auth.signInWithPassword({ email: document.getElementById("ddg-e").value.trim(), password: document.getElementById("ddg-p").value })
          .then(function(r){
            if (r.error){ err.textContent = r.error.message; return; }
            d.remove(); resolve(r.data.user);
          });
      });
    });
  }
  function ready(){
    return sb.auth.getSession().then(function(r){
      if (r.data.session) return r.data.session.user;
      return loginOverlay();
    });
  }

  /* ---------- reads ---------- */
  function loadProjects(){
    return sb.from("projects").select("*").order("sort").then(function(r){ if (r.error) throw r.error; return r.data; });
  }
  function loadEntries(project){
    var q = sb.from("entries").select("*").is("deleted_at", null).order("date", { ascending: false }).limit(10000);
    if (project) q = q.eq("project", project);
    return q.then(function(r){ if (r.error) throw r.error; r.data.forEach(function(e){ e.amt = Number(e.amt); }); return r.data; });
  }

  /* ---------- db shim for a project page ---------- */
  function makeDb(project){
    var entries = [], loaded = false, settings = {};
    var subs = { costs: [], planned: [], rent: [], receipts: [] }, metaSubs = { settings: [], milestones: [] };
    var defaults = (window.DDG_META_DEFAULTS || {});

    function snapFor(store){
      var kind = KIND[store];
      var list = entries.filter(function(e){ return e.kind === kind; });
      return { docs: list.map(function(e){
        return { id: e.id, data: function(){
          return { date: e.date || "", month: e.month || (e.date ? String(e.date).slice(0, 7) : ""), cat: e.cat || (kind === "rent" ? "Rent" : "Other"),
                   desc: e.descr || "", unit: e.unit || "", amt: Number(e.amt) || 0, ts: Date.parse(e.created_at) || 0 };
        } };
      }) };
    }
    function metaSnap(key){
      var v = settings["meta_" + key] || defaults[key] || null;
      return { exists: !!v, data: function(){ return v; } };
    }
    function notify(){
      Object.keys(subs).forEach(function(s){ var sn = snapFor(s); subs[s].forEach(function(cb){ try { cb(sn); } catch (e){ console.error(e); } }); });
      Object.keys(metaSubs).forEach(function(k){ var sn = metaSnap(k); metaSubs[k].forEach(function(cb){ try { cb(sn); } catch (e){ console.error(e); } }); });
    }
    var busy = null;
    function refresh(){
      if (busy) return busy;
      busy = Promise.all([loadEntries(project), sb.from("projects").select("settings").eq("id", project).single()])
        .then(function(r){
          entries = r[0];
          settings = (r[1].data && r[1].data.settings) || {};
          loaded = true; notify();
        })
        .catch(function(err){ console.error(err); toastErr(err); })
        .then(function(){ busy = null; });
      return busy;
    }
    function rowFrom(store, body){
      var kind = KIND[store];
      return {
        project: project, kind: kind,
        date: body.date || null,
        month: body.month || (body.date ? String(body.date).slice(0, 7) : null),
        cat: kind === "rent" ? "Rent" : (body.cat || "Other"),
        descr: body.desc || "", unit: body.unit || null,
        amt: Math.round(Number(body.amt) * 100) / 100
      };
    }
    function dupes(row){
      return entries.filter(function(e){
        return e.kind === row.kind && e.date === row.date && Math.abs(Math.abs(e.amt) - Math.abs(row.amt)) < 0.005;
      });
    }
    function softDelete(id){
      return sb.from("entries").update({ deleted_at: new Date().toISOString() }).eq("id", id)
        .then(function(r){ if (r.error) throw r.error; return refresh(); });
    }
    function setDoc(store, id, body){
      var row = rowFrom(store, body); row.deleted_at = null;
      return sb.from("entries").update(row).eq("id", id).select("id").then(function(r){
        if (r.error) throw r.error;
        if (r.data && r.data.length) return refresh();
        row.id = id;
        return sb.from("entries").insert(row).then(function(r2){ if (r2.error) throw r2.error; return refresh(); });
      });
    }
    function collection(store){
      var api = {
        orderBy: function(){ return api; },
        onSnapshot: function(cb){ subs[store].push(cb); if (loaded) cb(snapFor(store)); return function(){}; },
        add: function(body){
          var row = rowFrom(store, body);
          var d = dupes(row);
          if (d.length){
            var msg = "Possible duplicate — already logged:\n" + d.map(function(x){ return mdy(x.date) + "  " + money(x.amt) + "  " + (x.descr || x.unit || ""); }).join("\n") + "\n\nAdd it anyway?";
            if (!window.confirm(msg)) return Promise.reject(new Error("cancelled"));
          }
          return sb.from("entries").insert(row).select("id").single().then(function(r){
            if (r.error) throw r.error;
            var id = r.data.id;
            return refresh().then(function(){ return { id: id, delete: function(){ return softDelete(id); } }; });
          }).catch(function(err){ toastErr(err); throw err; });
        },
        doc: function(id){
          return {
            set: function(body){ return setDoc(store, id, body).catch(function(err){ toastErr(err); throw err; }); },
            delete: function(){ return softDelete(id).catch(function(err){ toastErr(err); throw err; }); }
          };
        }
      };
      return api;
    }
    function metaDoc(path){
      var key = String(path).split("/")[1];
      return {
        onSnapshot: function(cb){ metaSubs[key].push(cb); if (loaded) cb(metaSnap(key)); return function(){}; },
        set: function(obj){
          return sb.from("projects").select("settings").eq("id", project).single().then(function(r){
            if (r.error) throw r.error;
            var s = r.data.settings || {}; s["meta_" + key] = obj;
            return sb.from("projects").update({ settings: s }).eq("id", project);
          }).then(function(r){ if (r.error) throw r.error; return refresh(); });
        }
      };
    }
    var db = { collection: collection, doc: metaDoc };
    refresh();
    setInterval(function(){ if (!document.hidden) refresh(); }, 60000);
    document.addEventListener("visibilitychange", function(){ if (!document.hidden) refresh(); });
    return db;
  }

  function toastErr(err){
    var m = (err && err.message) || String(err);
    if (m === "cancelled") return;
    var t = document.createElement("div");
    t.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);top:14px;z-index:90;background:#B3403A;color:#fff;padding:10px 14px;border-radius:10px;font:14px system-ui;max-width:calc(100vw - 32px)";
    t.textContent = "Couldn't reach the database: " + m;
    document.body.appendChild(t); setTimeout(function(){ t.remove(); }, 7000);
  }

  window.DDG = {
    sb: sb, ready: ready, loadProjects: loadProjects, loadEntries: loadEntries,
    signOut: function(){ return sb.auth.signOut().then(function(){ location.href = "./"; }); }
  };
  /* project pages call window.claude.use("db") exactly like they did inside Claude */
  window.claude = {
    use: function(name){
      if (name !== "db") return Promise.resolve(null);
      var project = document.body.getAttribute("data-project");
      return ready().then(function(){ return makeDb(project); });
    }
  };
})();
