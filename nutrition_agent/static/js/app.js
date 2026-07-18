/* ════════════════════════════════════════════════
   app.js — Global utilities: theme, tips, init
════════════════════════════════════════════════ */

// ── Theme toggle ─────────────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const icon = document.getElementById("themeIcon");
  if (html.dataset.theme === "dark") {
    html.dataset.theme = "light";
    icon.className = "bi bi-moon-stars";
    localStorage.setItem("HealthVerse AI_theme", "light");
  } else {
    html.dataset.theme = "dark";
    icon.className = "bi bi-sun";
    localStorage.setItem("HealthVerse AI_theme", "dark");
  }
}

function applyTheme() {
  const saved = localStorage.getItem("HealthVerse AI_theme") || "light";
  document.documentElement.dataset.theme = saved;
  const icon = document.getElementById("themeIcon");
  if (icon) {
    icon.className = saved === "dark" ? "bi bi-sun" : "bi bi-moon-stars";
  }
}
applyTheme();

// ── Rotating tips ─────────────────────────────────
(function startTipCarousel() {
  const tips = document.querySelectorAll(".tip-item");
  if (!tips.length) return;
  let idx = 0;
  setInterval(() => {
    tips[idx].classList.remove("active");
    idx = (idx + 1) % tips.length;
    tips[idx].classList.add("active");
  }, 4500);
})();

// ── Smooth-scroll nav anchors ─────────────────────
document.querySelectorAll('a[href^="#"], a[href*="#"]').forEach(a => {
  a.addEventListener("click", e => {
    const hash = a.getAttribute("href").split("#")[1];
    if (!hash) return;
    const target = document.getElementById(hash);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

// ── Utility: escape HTML ──────────────────────────
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ── Utility: render markdown safely ──────────────
function renderMarkdown(text) {
  if (typeof marked !== "undefined") {
    // Allow tables in marked
    marked.use({ breaks: true });
    return marked.parse(text);
  }
  // Fallback: wrap in pre
  return `<pre style="white-space:pre-wrap">${escapeHtml(text)}</pre>`;
}

// ── Refresh dashboard on load ─────────────────────
window.addEventListener("DOMContentLoaded", () => {
  if (typeof refreshDashboard === "function") refreshDashboard();
  if (typeof loadProfiles    === "function") loadProfiles();
});
