/**
 * Shared helpers: mark current nav item from data-nav on <body>.
 */
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var current = document.body.getAttribute("data-nav");
    if (!current) return;
    document.querySelectorAll(".nav a[data-nav-id]").forEach(function (a) {
      if (a.getAttribute("data-nav-id") === current) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  });
})();
