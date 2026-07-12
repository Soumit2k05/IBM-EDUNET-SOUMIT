/* ════════════════════════════════════════════════
   profiles.js — Family profile management
════════════════════════════════════════════════ */

// ── Load profiles from server & render ───────────
async function loadProfiles() {
  try {
    const res  = await fetch("/profiles");
    const data = await res.json();
    renderProfileDropdown(data.profiles, data.active);
    renderProfileCards(data.profiles, data.active);
    setEl("activeProfileName", data.active);
    setEl("statProfile", data.active);
  } catch (_) {}
}

// ── Render profile dropdown in navbar ────────────
function renderProfileDropdown(profiles, active) {
  const menu = document.getElementById("profileDropdownMenu");
  if (!menu) return;

  // Keep header and divider + add-member link
  menu.innerHTML = `
    <li><h6 class="dropdown-header">Family Profiles</h6></li>
    ${profiles.map(name => `
      <li class="${name === active ? "active-profile" : ""}">
        <a class="dropdown-item d-flex align-items-center gap-2" href="#"
           onclick="switchProfile('${escapeHtml(name)}');return false">
          <i class="bi bi-person${name === active ? "-fill" : ""}"></i>
          ${escapeHtml(name)}
          ${name === active ? '<i class="bi bi-check-lg ms-auto text-accent"></i>' : ""}
        </a>
      </li>`).join("")}
    <li><hr class="dropdown-divider"/></li>
    <li>
      <a class="dropdown-item text-accent" href="#"
         data-bs-toggle="modal" data-bs-target="#addProfileModal">
        <i class="bi bi-person-plus me-1"></i>Add Family Member
      </a>
    </li>`;
}

// ── Render profile cards in Family section ────────
function renderProfileCards(profiles, active) {
  const container = document.getElementById("profileCards");
  if (!container) return;

  container.innerHTML = profiles.map(name => {
    const isActive = name === active;
    return `
      <div class="col-6 col-md-3 col-lg-2">
        <div class="profile-card ${isActive ? "active" : ""}" onclick="switchProfile('${escapeHtml(name)}')">
          <div class="profile-avatar">${profileEmoji(name)}</div>
          <div class="profile-name">${escapeHtml(name)}</div>
          ${isActive ? '<div class="profile-detail" style="color:var(--accent)">✓ Active</div>' : ""}
          ${name !== "Me" ? `
            <div class="text-center mt-2">
              <button class="btn btn-xs" style="font-size:.7rem"
                      onclick="deleteProfile(event,'${escapeHtml(name)}')">
                <i class="bi bi-trash3"></i>
              </button>
            </div>` : ""}
        </div>
      </div>`;
  }).join("");
}

// ── Save a new profile ─────────────────────────────
async function saveProfile() {
  const name = document.getElementById("profileName").value.trim();
  if (!name) {
    alert("Please enter a name for this profile.");
    return;
  }

  const profile = {
    age:        document.getElementById("profileAge").value,
    gender:     document.getElementById("profileGender").value,
    weight_kg:  document.getElementById("profileWeight").value,
    height_cm:  document.getElementById("profileHeight").value,
    diet_type:  document.getElementById("profileDiet").value,
    conditions: document.getElementById("profileConditions").value,
    region:     document.getElementById("profileRegion").value,
  };

  try {
    await fetch("/profiles", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name, profile }),
    });

    // Close modal and reload
    bootstrap.Modal.getInstance(document.getElementById("addProfileModal"))?.hide();
    clearProfileForm();
    await loadProfiles();
  } catch (err) {
    alert("Failed to save profile. Please try again.");
  }
}

// ── Switch active profile ─────────────────────────
async function switchProfile(name) {
  try {
    const res  = await fetch("/profiles/switch", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.status === "switched") {
      setEl("activeProfileName", name);
      setEl("statProfile", name);
      await loadProfiles();
      refreshDashboard();

      // Notify in chat
      const chatInput = document.getElementById("chatInput");
      if (chatInput) {
        appendMessage("bot",
          `Switched to profile: **${name}**. I'll tailor all advice for this family member now! 😊`);
      }
    }
  } catch (_) {}
}

// ── Delete a profile ──────────────────────────────
async function deleteProfile(event, name) {
  event.stopPropagation();
  if (!confirm(`Delete profile "${name}"?`)) return;
  try {
    await fetch("/profiles/delete", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name }),
    });
    await loadProfiles();
    refreshDashboard();
  } catch (_) {}
}

// ── Helpers ───────────────────────────────────────
function profileEmoji(name) {
  const map = {
    "me":     "🧑",
    "mom":    "👩",
    "dad":    "👨",
    "child":  "👧",
    "son":    "👦",
    "daughter":"👧",
    "spouse": "💑",
    "wife":   "👩",
    "husband":"👨",
    "grandma":"👵",
    "grandpa":"👴",
    "baby":   "👶",
  };
  return map[name.toLowerCase()] || "👤";
}

function clearProfileForm() {
  ["profileName","profileAge","profileWeight","profileHeight",
   "profileConditions","profileRegion"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const gender = document.getElementById("profileGender");
  const diet   = document.getElementById("profileDiet");
  if (gender) gender.value = "";
  if (diet)   diet.value   = "";
}
