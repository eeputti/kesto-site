// kesto site: tracking, signup, reveal, counters, sticky cta, week builder. No dependencies.
(function () {
  var SB = "https://eagkefzfmqklryzpuyvm.supabase.co";
  var KEY = "sb_publishable_XpoO9TIKyVm3RJhFQQJJLA_CtXXYbKe"; // public, insert-only table
  var LIVE = /(^|\.)kestosystem\.com$|\.github\.io$/.test(location.hostname);
  var T0 = Date.now();
  var page = document.body.getAttribute("data-page") || "home";

  // ---------- storage (can fail in some in-app browsers) ----------
  function get(k) { try { return localStorage.getItem(k) || sessionStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { try { sessionStorage.setItem(k, v); } catch (e2) {} } }

  // ---------- tracking: page views and clicks ----------
  var qs = new URLSearchParams(location.search);
  var src = qs.get("src") || qs.get("utm_source") || "";
  if (src) set("k_src", src); else src = get("k_src") || "";
  var ref = (document.referrer || "").slice(0, 120);
  var mobile = /iphone|ipad|android|mobile/i.test(navigator.userAgent);
  function track(ev, target) {
    if (!LIVE) return;
    try {
      fetch(SB + "/rest/v1/landing_events", {
        method: "POST", keepalive: true,
        headers: { apikey: KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ event: ev, target: (target || page).slice(0, 60), src: src.slice(0, 40) || null, ref: ref || null, mobile: mobile })
      }).catch(function () {});
    } catch (e) {}
  }
  window.kTrack = track;
  track("view", page);
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-t]");
    if (a) track("click", page + ":" + a.getAttribute("data-t"));
  });

  // ---------- header border on scroll ----------
  var top = document.querySelector(".top");
  function onScroll() { if (top) top.classList.toggle("scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // ---------- reveal + counters ----------
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add("in");
      if (en.target.hasAttribute("data-count")) count(en.target);
      io.unobserve(en.target);
    });
  }, { threshold: 0.15 }) : null;
  document.querySelectorAll(".rv,[data-count]").forEach(function (el) { if (io) io.observe(el); else el.classList.add("in"); });
  function count(el) {
    var to = parseFloat(el.getAttribute("data-count")), suf = el.getAttribute("data-suffix") || "", t0 = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = to + suf; return; }
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / 1100), v = Math.round(to * (1 - Math.pow(1 - p, 3)));
      el.textContent = v + suf;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---------- sticky cta after the hero ----------
  var sticky = document.querySelector(".sticky"), hero = document.querySelector("[data-hero]");
  if (sticky && hero && "IntersectionObserver" in window) {
    document.body.classList.add("has-sticky");
    new IntersectionObserver(function (es) { sticky.classList.toggle("on", !es[0].isIntersecting); }).observe(hero);
  }

  // ---------- signup (free 4-week program) ----------
  var crewUrl = document.body.getAttribute("data-crew") || "crew/";
  document.querySelectorAll("form[data-join]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var box = f.closest(".join"), msg = box.querySelector(".msg"), btn = f.querySelector("button");
      var email = (f.email.value || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.textContent = "check your email address."; return; }
      if (f.website && f.website.value) return; // bots fill the hidden field
      btn.disabled = true; btn.textContent = "...";
      var payload = { email: email, hp: "", t: Date.now() - T0, page: page, src: src };
      function done(via) {
        set("kesto_crew", "1");
        track("signup", page + ":" + (f.getAttribute("data-join") || "form") + ":" + via);
        box.classList.add("done");
        msg.textContent = "thanks. now lock in.";
        setTimeout(function () { location.href = crewUrl + "?welcome=1"; }, 900);
      }
      // backup: if the signup function is down, keep the lead in the insert-only table (agents import it to the list)
      function backup() {
        return fetch(SB + "/rest/v1/landing_events", {
          method: "POST",
          headers: { apikey: KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ event: "lead", target: email.toLowerCase().slice(0, 60), src: src.slice(0, 40) || null, ref: page, mobile: mobile })
        }).then(function (r) { if (!r.ok) throw new Error("backup failed"); done("backup"); });
      }
      fetch(SB + "/functions/v1/email-intake?source=site", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (d) {
        if (d && d.ok) done("intake"); else return backup();
      }).catch(function () {
        return backup().catch(function () {
          btn.disabled = false; btn.textContent = "lock in";
          msg.textContent = "that didn't go through. try again, or email eelis@kestosystem.com.";
        });
      });
    });
  });

  // ---------- crew area (soft gate) ----------
  var unlocked = get("kesto_crew") === "1" || qs.get("welcome") === "1";
  document.querySelectorAll("[data-locked]").forEach(function (el) { el.hidden = unlocked; });
  document.querySelectorAll("[data-unlocked]").forEach(function (el) { el.hidden = !unlocked; });
  if (unlocked && qs.get("welcome") === "1") set("kesto_crew", "1");

  // ---------- build your week ----------
  var wk = document.getElementById("weekgrid");
  if (wk) {
    var ans = {};
    var DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    var L = {
      "30": { easy: "25 to 30 min at talk pace", long: "40 to 45 min", q: "6 × 1 min hard, 1 min easy", lift: "3 main lifts, 3 sets each" },
      "45": { easy: "30 to 40 min at talk pace", long: "50 to 60 min", q: "5 × 3 min hard, 2 min easy", lift: "4 to 5 lifts, 3 to 4 sets" },
      "60": { easy: "40 to 50 min at talk pace", long: "70 to 90 min", q: "6 × 3 min hard, 2 min easy", lift: "5 to 6 lifts + core" }
    };
    // heavy legs always at least one day away from a hard or long run
    var P = {
      strength: { 3: ["LA", "XX", "RE", "XX", "LB", "RC", "XX"], 4: ["LL", "RE", "XX", "LU", "XX", "LF", "RC"], 5: ["LL", "LU", "RE", "XX", "LL", "LU", "RC"], 6: ["LL", "LU", "RE", "LL", "LU", "RE", "XX"] },
      run: { 3: ["RE", "XX", "LF", "XX", "RC", "RL", "XX"], 4: ["RE", "LF", "XX", "RQ", "XX", "RL", "RC"], 5: ["RE", "LF", "XX", "RQ", "LU", "RL", "RC"], 6: ["RE", "RQ", "RE", "LF", "LU", "RL", "XX"] },
      both: { 3: ["LA", "XX", "RE", "XX", "RC", "LB+", "XX"], 4: ["LL", "RE", "XX", "LU", "XX", "RL", "RC"], 5: ["LL", "RE", "LU", "RQ", "XX", "RL", "RC"], 6: ["LL", "RE", "LU", "RQ", "LU2", "RL", "XX"] }
    };
    function cell(c, len) {
      var s = L[len];
      switch (c) {
        case "LA": return ["full body a", "squat, press, row. " + s.lift];
        case "LB": return ["full body b", "deadlift, pull-up, lunge. " + s.lift];
        case "LB+": return ["full body b + run", "deadlift, pull-up, lunge, then 15 to 20 min easy run"];
        case "LF": return ["full body", "squat or deadlift, press, pull. " + s.lift];
        case "LL": return ["lower body", "squat or deadlift focus. " + s.lift];
        case "LU": return ["upper body", "press, pull, carry, core. " + s.lift];
        case "LU2": return ["upper body + core", "lighter day, no heavy legs before the long run"];
        case "RE": return ["easy run", s.easy];
        case "RL": return ["long run", "easy pace, " + s.long];
        case "RQ": return ["intervals", s.q];
        case "RC": return ["recover", "walk + 15 min mobility. sleep."];
        default: return ["rest", "off. eat, sleep, recover."];
      }
    }
    var GOAL = { strength: "get stronger", run: "run better", both: "both, equally" };
    function render() {
      if (!(ans.days && ans.goal && ans.len)) return;
      wk.innerHTML = "";
      P[ans.goal][ans.days].forEach(function (c, i) {
        var x = cell(c, ans.len), d = document.createElement("div");
        d.className = "day" + (c === "XX" || c === "RC" ? " off" : "");
        d.innerHTML = '<span class="d">' + DAYS[i] + '</span><div><div class="t">' + x[0] + '</div><div class="x">' + x[1] + "</div></div>";
        wk.appendChild(d);
      });
      document.getElementById("rtitle").textContent = "your week: " + ans.days + " days, " + GOAL[ans.goal] + ", " + (ans.len === "60" ? "60+" : "~" + ans.len) + " min";
      var r = document.getElementById("result"), first = !r.classList.contains("show");
      r.classList.add("show");
      if (first) { track("quiz_done", ans.days + "_" + ans.goal + "_" + ans.len); r.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }
    document.querySelectorAll(".opts").forEach(function (g) {
      g.addEventListener("click", function (e) {
        var b = e.target.closest(".opt"); if (!b) return;
        g.querySelectorAll(".opt").forEach(function (o) { o.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
        ans[g.getAttribute("data-q")] = b.getAttribute("data-v");
        render();
      });
    });
  }
})();
