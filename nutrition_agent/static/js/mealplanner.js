/* ════════════════════════════════════════════════
   mealplanner.js — Meal Plan & Nutrition Analyzer
════════════════════════════════════════════════ */

// ── Generate Meal Plan ────────────────────────────
async function generateMealPlan() {
  const goal     = document.getElementById("planGoal").value;
  const diet     = document.getElementById("planDiet").value;
  const calories = document.getElementById("planCalories").value;
  const days     = document.getElementById("planDays").value;

  const loading = document.getElementById("mealPlanLoading");
  const output  = document.getElementById("mealPlanOutput");

  loading.classList.remove("d-none");
  output.classList.add("d-none");
  output.innerHTML = "";

  try {
    const res  = await fetch("/meal-plan", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ goal, diet_type: diet, calories, days }),
    });
    const data = await res.json();

    loading.classList.add("d-none");

    if (data.error) {
      output.innerHTML = `<p style="color:var(--danger)">⚠️ ${data.error}</p>`;
    } else {
      output.innerHTML = renderMarkdown(data.meal_plan);
      addCopyBtn(output, data.meal_plan);
    }
    output.classList.remove("d-none");
  } catch (err) {
    loading.classList.add("d-none");
    output.innerHTML = `<p style="color:var(--danger)">⚠️ Failed to generate meal plan. Please try again.</p>`;
    output.classList.remove("d-none");
  }
}

// ── Analyze Nutrition ─────────────────────────────
async function analyzeNutrition() {
  const foods   = document.getElementById("analyzerInput").value.trim();
  const loading = document.getElementById("analyzerLoading");
  const output  = document.getElementById("analyzerOutput");

  if (!foods) {
    alert("Please enter the foods or meal you want to analyse.");
    return;
  }

  loading.classList.remove("d-none");
  output.classList.add("d-none");
  output.innerHTML = "";

  try {
    const res  = await fetch("/analyze", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ foods }),
    });
    const data = await res.json();

    loading.classList.add("d-none");

    if (data.error) {
      output.innerHTML = `<p style="color:var(--danger)">⚠️ ${data.error}</p>`;
    } else {
      output.innerHTML = renderMarkdown(data.analysis);
      addCopyBtn(output, data.analysis);
    }
    output.classList.remove("d-none");
  } catch (err) {
    loading.classList.add("d-none");
    output.innerHTML = `<p style="color:var(--danger)">⚠️ Analysis failed. Please try again.</p>`;
    output.classList.remove("d-none");
  }
}

// ── Helper: add a Copy button below output ────────
function addCopyBtn(container, text) {
  const btn = document.createElement("button");
  btn.className = "btn btn-xs mt-3";
  btn.innerHTML = `<i class="bi bi-clipboard me-1"></i>Copy to Clipboard`;
  btn.onclick = () => {
    navigator.clipboard.writeText(text).then(() => {
      btn.innerHTML = `<i class="bi bi-check-lg me-1"></i>Copied!`;
      setTimeout(() => {
        btn.innerHTML = `<i class="bi bi-clipboard me-1"></i>Copy to Clipboard`;
      }, 2000);
    });
  };
  container.appendChild(btn);
}
