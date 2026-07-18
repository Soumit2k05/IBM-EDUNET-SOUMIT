/* ════════════════════════════════════════════════
   bmi.js — BMI Calculator
════════════════════════════════════════════════ */

async function calculateBMI() {
  const weight = parseFloat(document.getElementById("bmiWeight").value);
  const height = parseFloat(document.getElementById("bmiHeight").value);
  const age    = parseInt(document.getElementById("bmiAge").value) || 25;
  const gender = document.getElementById("bmiGender").value;
  const result = document.getElementById("bmiResult");

  if (!weight || !height || weight < 20 || height < 50) {
    result.className  = "bmi-result mt-3";
    result.innerHTML  = `<span style="color:var(--danger)">⚠️ Please enter valid weight and height.</span>`;
    result.classList.remove("d-none");
    return;
  }

  try {
    const res  = await fetch("/bmi", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ weight, height, age, gender }),
    });
    const data = await res.json();

    if (data.error) {
      result.innerHTML = `<span style="color:var(--danger)">${data.error}</span>`;
    } else {
      const cls   = bmiClass(data.bmi);
      const emoji = bmiEmoji(data.category);
      result.innerHTML = `
        <div class="d-flex align-items-center gap-3 mb-2">
          <div class="bmi-number ${cls}">${data.bmi}</div>
          <div>
            <div class="fw-semibold" style="font-size:.95rem">${emoji} ${data.category}</div>
            <div style="font-size:.75rem;color:var(--text-muted)">BMI Score</div>
          </div>
        </div>
        <div class="bmi-gauge mb-2">${renderBmiGauge(data.bmi)}</div>
        <div style="font-size:.82rem;color:var(--text-secondary)">
          <strong>BMR:</strong> ${data.bmr} kcal/day &nbsp;|&nbsp;
          <strong>Maintain:</strong> ~${data.tdee.moderate} kcal (moderate activity)
        </div>
        <div style="font-size:.78rem;margin-top:.5rem;color:var(--text-muted)">
          ${tdeeTable(data.tdee)}
        </div>
        <div style="font-size:.75rem;margin-top:.6rem;color:var(--text-muted)">
          💬 Ask HealthVerse AI for a personalised plan based on these numbers!
        </div>
      `;
      result.classList.remove("d-none");

      // Pre-fill chat with BMI context
      const chatIn = document.getElementById("chatInput");
      if (chatIn && !chatIn.value) {
        chatIn.placeholder = `I am ${age} yrs, ${weight}kg, ${height}cm — BMI ${data.bmi} (${data.category}). Suggest a meal plan.`;
      }
    }
  } catch (err) {
    result.innerHTML = `<span style="color:var(--danger)">⚠️ Calculation failed. Please try again.</span>`;
  }
  result.classList.remove("d-none");
}

function bmiClass(bmi) {
  if (bmi < 18.5) return "bmi-underweight";
  if (bmi < 25)   return "bmi-normal";
  if (bmi < 30)   return "bmi-overweight";
  return "bmi-obese";
}

function bmiEmoji(cat) {
  const map = {
    "Underweight":   "⚠️",
    "Normal weight": "✅",
    "Overweight":    "⚠️",
    "Obese":         "🔴",
  };
  return map[cat] || "📊";
}

function renderBmiGauge(bmi) {
  // A simple CSS gauge bar
  const capped = Math.min(Math.max(bmi, 10), 45);
  const pct    = ((capped - 10) / 35) * 100;
  const color  = bmi < 18.5 ? "#e3b341" : bmi < 25 ? "#3fb950" : bmi < 30 ? "#f0883e" : "#f85149";
  return `
    <div style="background:var(--border-color);border-radius:6px;height:8px;overflow:hidden;position:relative">
      <div style="width:${pct}%;background:${color};height:100%;border-radius:6px;transition:width .6s ease"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted);margin-top:2px">
      <span>10</span><span style="color:#e3b341">18.5</span><span style="color:#3fb950">25</span><span style="color:#f0883e">30</span><span>45+</span>
    </div>`;
}

function tdeeTable(tdee) {
  const rows = [
    ["🛋️ Sedentary",    tdee.sedentary],
    ["🚶 Light",        tdee.light],
    ["🏃 Moderate",     tdee.moderate],
    ["💪 Active",       tdee.active],
    ["🏋️ Very Active",  tdee.very_active],
  ];
  return `<table style="width:100%;font-size:.75rem;border-collapse:collapse">
    <tr><th style="text-align:left;padding-bottom:2px;color:var(--accent)">Activity</th>
        <th style="text-align:right;color:var(--accent)">kcal/day</th></tr>
    ${rows.map(([l, v]) => `<tr><td>${l}</td><td style="text-align:right;font-weight:600">${v}</td></tr>`).join("")}
  </table>`;
}
