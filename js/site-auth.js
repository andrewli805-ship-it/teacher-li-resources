/**
 * Shared sign-in chrome for the static Pages site.
 * Frontend gating only. Row level security still decides what a session can read or write.
 * The publishable key comes from js/supabase-config.js. Never put a secret key here.
 */
(function () {
  var cfg = window.HOMEWORK_SUPABASE;
  var client = null;

  if (cfg && window.supabase) {
    try {
      client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      });
    } catch (_err) {
      client = null;
    }
  }

  var cachedSession = null;
  var displayName = "";

  function safeNext(raw) {
    if (raw == null) return "";
    var value = String(raw).trim();
    if (!value || value.length > 512) return "";
    if (/[\u0000-\u001F\\]/.test(value)) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return "";
    if (value.indexOf("//") === 0) return "";
    try {
      var url = new URL(value, window.location.href);
      if (url.origin !== window.location.origin) return "";
      if (!/\.html$/i.test(url.pathname)) return "";
      return url.pathname + url.search + url.hash;
    } catch (_err) {
      return "";
    }
  }

  function portalBase() {
    var node = document.querySelector(".site-auth[data-portal]");
    if (node && node.getAttribute("data-portal")) return node.getAttribute("data-portal");
    if (/\/homework\//.test(window.location.pathname)) return "portal.html";
    return "homework/portal.html";
  }

  function loginUrl(next) {
    var base = portalBase();
    var safe = safeNext(next);
    if (!safe) return base;
    return base + "?next=" + encodeURIComponent(safe);
  }

  function fallbackName(session) {
    var email = session && session.user && session.user.email ? session.user.email : "";
    var local = email.split("@")[0];
    return local || "";
  }

  function render() {
    var signedIn = !!(cachedSession && cachedSession.user);
    document.querySelectorAll(".site-auth").forEach(function (root) {
      var guest = root.querySelector(".site-auth-guest");
      var user = root.querySelector(".site-auth-user");
      var name = root.querySelector(".site-auth-name");
      if (guest) guest.hidden = signedIn;
      if (user) user.hidden = !signedIn;
      if (name) name.textContent = signedIn ? displayName || fallbackName(cachedSession) : "";
    });
  }

  function rememberSession(session) {
    cachedSession = session || null;
    if (!cachedSession) {
      displayName = "";
      render();
      return;
    }
    displayName = fallbackName(cachedSession);
    render();
    client
      .from("profiles")
      .select("username")
      .eq("id", cachedSession.user.id)
      .maybeSingle()
      .then(function (result) {
        if (!cachedSession || !cachedSession.user) return;
        if (result.data && result.data.username) {
          displayName = String(result.data.username);
          render();
        }
      });
  }

  function getSession() {
    if (!client) return Promise.resolve(null);
    return client.auth.getSession().then(function (result) {
      var session = result.data ? result.data.session : null;
      cachedSession = session || null;
      return cachedSession;
    });
  }

  function bindUi() {
    document.querySelectorAll(".site-auth .btn-logout").forEach(function (button) {
      if (button.getAttribute("data-bound") === "1") return;
      button.setAttribute("data-bound", "1");
      button.addEventListener("click", function () {
        if (!client) return;
        client.auth.signOut();
      });
    });

    document.querySelectorAll("[data-auth-submit]").forEach(function (link) {
      var here = window.location.pathname + window.location.search + window.location.hash;
      link.setAttribute("href", loginUrl(here));
    });

    if (!client) {
      render();
      return;
    }

    getSession().then(function (session) {
      rememberSession(session);
    });

    client.auth.onAuthStateChange(function (_event, session) {
      rememberSession(session);
    });
  }

  window.TeacherLiAuth = {
    client: client,
    getSession: getSession,
    safeNext: safeNext,
    loginUrl: loginUrl,
    signOut: function () {
      if (!client) return Promise.resolve();
      return client.auth.signOut();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindUi);
  } else {
    bindUi();
  }
})();
