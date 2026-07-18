/* ════════════════════════════════════════════════
   chat.js — Chat UI logic
════════════════════════════════════════════════ */

let isLoading = false;

// ── Auto-resize textarea ──────────────────────────
const chatInput = document.getElementById("chatInput");
if (chatInput) {
  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
  });
}

// ── Enter to send (Shift+Enter = newline) ─────────
function handleKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ── Send a message ────────────────────────────────
async function sendMessage() {
  if (isLoading) return;
  const input   = document.getElementById("chatInput");
  const message = input.value.trim();
  if (!message) return;

  appendMessage("user", message);
  input.value = "";
  input.style.height = "auto";

  showTyping(true);
  isLoading = true;
  setSendDisabled(true);
  updateMsgCount(1);

  try {
    const res  = await fetch("/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ message }),
    });
    const data = await res.json();
    showTyping(false);

    if (data.error) {
      appendMessage("bot", "⚠️ " + data.error);
    } else {
      appendMessage("bot", data.response);
      if (data.profile) updateDashboardFromProfile(data.profile);
    }
  } catch (err) {
    showTyping(false);
    appendMessage("bot", "⚠️ Network error. Please check your connection and try again.");
  } finally {
    isLoading = false;
    setSendDisabled(false);
  }
}

// ── Quick prompt from pills ───────────────────────
function quickPrompt(text) {
  const input = document.getElementById("chatInput");
  if (!input) return;
  input.value = text;
  input.focus();
  sendMessage();
}

// ── Append a message bubble ───────────────────────
function appendMessage(role, content) {
  const messages = document.getElementById("chatMessages");
  const now      = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isBot    = role === "bot";

  const div   = document.createElement("div");
  div.className = `message ${isBot ? "bot-message" : "user-message"} animate-slide-in`;

  const body = isBot ? renderMarkdown(content) : escapeHtml(content);

  div.innerHTML = `
    <div class="message-avatar">${isBot ? "🥗" : "👤"}</div>
    <div class="message-bubble">
      ${body}
      <div class="message-time">${now}</div>
    </div>`;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// ── Typing indicator ──────────────────────────────
function showTyping(show) {
  const el = document.getElementById("typingIndicator");
  if (!el) return;
  el.classList.toggle("d-none", !show);
  if (show) {
    const messages = document.getElementById("chatMessages");
    messages.scrollTop = messages.scrollHeight;
  }
}

// ── Enable / disable send button ──────────────────
function setSendDisabled(disabled) {
  const btn   = document.getElementById("sendBtn");
  const input = document.getElementById("chatInput");
  if (btn)   btn.disabled   = disabled;
  if (input) input.disabled = disabled;
}

// ── Update message count in dashboard ────────────
function updateMsgCount(delta) {
  const el = document.getElementById("statMessages");
  if (!el) return;
  el.textContent = parseInt(el.textContent || 0) + delta;
}

// ── Clear chat ────────────────────────────────────
async function clearChat() {
  if (!confirm("Clear the chat history?")) return;
  await fetch("/clear-chat", { method: "POST" });
  const messages = document.getElementById("chatMessages");
  while (messages.lastChild) messages.removeChild(messages.lastChild);
  appendMessage("bot", "Chat cleared! How can I help you today? 😊");
  const el = document.getElementById("statMessages");
  if (el) el.textContent = "0";
}

// ── Export chat as .txt ───────────────────────────
function exportChat() {
  const bubbles = document.querySelectorAll(".message-bubble");
  let text = "HealthVerse AI Chat Export\n" + new Date().toLocaleString() + "\n\n";
  document.querySelectorAll(".message").forEach(msg => {
    const role    = msg.classList.contains("user-message") ? "You" : "HealthVerse AI";
    const content = msg.querySelector(".message-bubble")?.innerText?.replace(/\n{3,}/g, "\n\n") || "";
    text += `[${role}]\n${content}\n\n`;
  });
  const blob = new Blob([text], { type: "text/plain" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = "HealthVerse AI-chat.txt";
  a.click();
}

// ── Update dashboard stats from chat profile ─────
function updateDashboardFromProfile(profile) {
  const map = {
    statAge:       profile.age       ? profile.age + " yrs"  : null,
    statWeight:    profile.weight_kg ? profile.weight_kg + " kg" : null,
    statHeight:    profile.height_cm ? profile.height_cm + " cm" : null,
    statDiet:      profile.diet_type || null,
    statCondition: profile.conditions || null,
  };
  for (const [id, val] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el && val) el.textContent = val;
  }
}

// ── Refresh dashboard via API ─────────────────────
async function refreshDashboard() {
  try {
    const res  = await fetch("/dashboard-data");
    const data = await res.json();
    const p    = data.profile || {};
    setEl("statProfile",   data.profile_name || "—");
    setEl("statMessages",  data.message_count || 0);
    setEl("statAge",       p.age       ? p.age + " yrs"       : "—");
    setEl("statWeight",    p.weight_kg ? p.weight_kg + " kg"  : "—");
    setEl("statHeight",    p.height_cm ? p.height_cm + " cm"  : "—");
    setEl("statDiet",      p.diet_type || "—");
    setEl("statCondition", p.conditions || "—");
  } catch (_) {}
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
