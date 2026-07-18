"""
HealthVerse AI — AI-powered Nutrition Agent
Flask backend with IBM watsonx.ai (Granite) integration
"""

import os
import json
import re
from datetime import datetime
from flask import (
    Flask, render_template, request, jsonify,
    session, redirect, url_for
)
from dotenv import load_dotenv
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams
from agent_instructions import build_system_prompt, GENERATION_PARAMS, AGENT_NAME

# ── Load environment variables ────────────────────────────────────────────────
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")
app.config["SESSION_TYPE"] = "filesystem"
app.config["PERMANENT_SESSION_LIFETIME"] = 3600  # 1 hour

# ── watsonx.ai client setup ───────────────────────────────────────────────────
# Instruct-capable models use chat tokens; base/code models use plain completion.
_INSTRUCT_MODELS = {
    # IBM Granite instruct variants
    "granite-3-8b-instruct",
    "granite-3-2-8b-instruct",
    "granite-13b-instruct-v2",
    "granite-3-1-8b-instruct",
    "granite-3-3-8b-instruct",
    "granite-3-0-8b-instruct",
    "granite-8b-code-instruct",    # au-syd: supports text_chat + text_generation
    "granite-guardian-3-8b",       # au-syd: supports text_chat + text_generation
    # Meta Llama instruct variants
    "llama-3-3-70b-instruct",
    "llama-3-1-70b-instruct",
    "llama-3-2-11b-vision-instruct",
    "llama-3-8b-instruct",
}

# Fallback preference order — tried in sequence if the configured model fails.
# Priority: instruct/chat models first (better quality), then base models.
# This list covers us-south AND au-syd regions.
_FALLBACK_MODELS = [
    "ibm/granite-8b-code-instruct",          # au-syd  — instruct, text_generation ✓
    "meta-llama/llama-3-3-70b-instruct",     # au-syd  — instruct, text_generation ✓
    "ibm/granite-guardian-3-8b",             # au-syd  — instruct, text_generation ✓
    "ibm/granite-3-8b-instruct",             # us-south — instruct
    "ibm/granite-13b-instruct-v2",           # us-south — instruct
    "meta-llama/llama-3-1-8b",               # au-syd  — base, generation
    "ibm/granite-3-1-8b-base",              # au-syd  — base only (last resort)
]

def _is_instruct_model(model_id: str) -> bool:
    """Return True if the model understands <|system|>/<|user|>/<|assistant|> tokens."""
    name = model_id.split("/")[-1].lower()
    return any(im in name for im in _INSTRUCT_MODELS)


def _get_credentials_and_params():
    """Re-read .env on every call so restarts aren't needed after .env edits."""
    load_dotenv(override=True)                   # force reload each call
    api_key    = os.getenv("IBM_API_KEY", "").strip()
    url        = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com").strip()
    project_id = os.getenv("WATSONX_PROJECT_ID", "").strip()
    model_id   = os.getenv("WATSONX_MODEL_ID", "ibm/granite-3-1-8b-base").strip()

    if not api_key or api_key == "your_ibm_cloud_api_key_here":
        raise EnvironmentError(
            "IBM_API_KEY is missing or still set to the placeholder. "
            "Open nutrition_agent/.env and paste your real IBM Cloud API key."
        )
    if not project_id or project_id == "your_watsonx_project_id_here":
        raise EnvironmentError(
            "WATSONX_PROJECT_ID is missing or still set to the placeholder. "
            "Open nutrition_agent/.env and paste your real watsonx.ai Project ID."
        )

    params = {
        GenParams.MAX_NEW_TOKENS:      GENERATION_PARAMS["max_new_tokens"],
        GenParams.MIN_NEW_TOKENS:      GENERATION_PARAMS["min_new_tokens"],
        GenParams.TEMPERATURE:         GENERATION_PARAMS["temperature"],
        GenParams.TOP_P:               GENERATION_PARAMS["top_p"],
        GenParams.TOP_K:               GENERATION_PARAMS["top_k"],
        GenParams.REPETITION_PENALTY:  GENERATION_PARAMS["repetition_penalty"],
        GenParams.STOP_SEQUENCES:      GENERATION_PARAMS["stop_sequences"],
    }
    return api_key, url, project_id, model_id, params


def get_watsonx_model():
    """
    Initialise and return a watsonx.ai ModelInference instance.
    Automatically falls back through _FALLBACK_MODELS if the configured
    model ID is not supported in this environment.
    """
    api_key, url, project_id, model_id, params = _get_credentials_and_params()
    credentials = Credentials(url=url, api_key=api_key)

    # Build a candidate list: configured model first, then fallbacks
    candidates = [model_id] + [m for m in _FALLBACK_MODELS if m != model_id]

    last_err = None
    for candidate in candidates:
        try:
            instance = ModelInference(
                model_id=candidate,
                credentials=credentials,
                project_id=project_id,
                params=params,
            )
            # Probe with a minimal generation to confirm /text/generation works.
            instance.generate_text(prompt="Hi", params={GenParams.MAX_NEW_TOKENS: 3})
            # Success — tag the resolved model ID for prompt-format selection.
            instance._active_model_id = candidate
            print(f"[HealthVerse AI] Using model: {candidate}", flush=True)
            return instance
        except Exception as e:
            last_err = e
            err_str  = str(e).lower()
            # Catch every variant of "this model can't do generation here"
            skip_signals = [
                "not supported",
                "invalid model",
                "not found",
                "model_no_support_for_function",   # au-syd base models
                "no_support_for_function",
                "does not support",
                "unsupported",
                "400",                              # bad-request from wrong endpoint
            ]
            if any(sig in err_str for sig in skip_signals):
                print(f"[HealthVerse AI] Skipping {candidate}: {str(e)[:120]}", flush=True)
                continue      # try next candidate
            raise             # unexpected error (auth, network) — propagate immediately

    raise RuntimeError(
        f"None of the candidate models are available in your environment.\n"
        f"Candidates tried: {candidates}\n"
        f"Last error: {last_err}\n"
        f"Run the model-listing command in README.md to find a supported model, "
        f"then set WATSONX_MODEL_ID in your .env file."
    )

# ── Prompt builder ────────────────────────────────────────────────────────────
def build_prompt(system_prompt: str, history: list[dict], user_message: str,
                 model_id: str = "") -> str:
    """
    Build a prompt compatible with both instruct and base Granite models.

    - Instruct models (e.g. granite-3-8b-instruct):
        Use  <|system|> / <|user|> / <|assistant|>  chat tokens.
    - Base / code models (e.g. granite-3-1-8b-base, granite-8b-code-instruct):
        Use a plain-text Human/Assistant completion format.

    Pass `model_id` = the actual resolved model (from model._active_model_id)
    so the prompt format is correct even when auto-fallback picked a different model.
    """
    if not model_id:
        model_id = os.getenv("WATSONX_MODEL_ID", "ibm/granite-3-1-8b-base")

    if _is_instruct_model(model_id):
        # ── Instruct format ──────────────────────────────────────────
        prompt = f"<|system|>\n{system_prompt}\n"
        for turn in history[-8:]:
            role    = turn.get("role", "user")
            content = turn.get("content", "")
            if role == "user":
                prompt += f"<|user|>\n{content}\n"
            else:
                prompt += f"<|assistant|>\n{content}\n"
        prompt += f"<|user|>\n{user_message}\n<|assistant|>\n"
    else:
        # ── Plain-text completion format (base / code models) ────────
        prompt  = (
            f"You are a nutrition expert AI assistant. {system_prompt}\n\n"
        )
        for turn in history[-6:]:
            role    = turn.get("role", "user")
            content = turn.get("content", "")
            if role == "user":
                prompt += f"Human: {content}\n"
            else:
                prompt += f"Assistant: {content}\n"
        prompt += f"Human: {user_message}\nAssistant:"

    return prompt

# ── Helper: clean model output ────────────────────────────────────────────────
def clean_response(text: str) -> str:
    """Strip residual special tokens and completion-format prefixes."""
    for tok in ["<|user|>", "<|assistant|>", "<|system|>", "<|endoftext|>",
                "Human:", "Assistant:"]:
        # Only strip from the very start if it leaked
        if text.startswith(tok):
            text = text[len(tok):]
    # Remove any follow-on turns the model hallucinated
    for stop in ["\nHuman:", "\nAssistant:", "<|user|>", "<|system|>"]:
        idx = text.find(stop)
        if idx != -1:
            text = text[:idx]
    return text.strip()

# ─────────────────────────────────────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Landing / Chat page."""
    if "chat_history" not in session:
        session["chat_history"] = []
    if "user_profiles" not in session:
        session["user_profiles"] = {}
    if "active_profile" not in session:
        session["active_profile"] = "Me"
        session["user_profiles"]["Me"] = {}
    return render_template("index.html", agent_name=AGENT_NAME)


@app.route("/chat", methods=["POST"])
def chat():
    """Handle a chat message and return the AI response."""
    data    = request.get_json(force=True)
    message = data.get("message", "").strip()
    if not message:
        return jsonify({"error": "Empty message"}), 400

    # Retrieve session state
    history        = session.get("chat_history", [])
    user_profiles  = session.get("user_profiles", {})
    active_profile = session.get("active_profile", "Me")
    profile        = user_profiles.get(active_profile, {})

    # Extract profile details from the message automatically
    profile = _auto_extract_profile(message, profile)
    user_profiles[active_profile] = profile
    session["user_profiles"]      = user_profiles

    # Build prompt and call model
    system_prompt = build_system_prompt(profile)

    try:
        model    = get_watsonx_model()
        active   = getattr(model, "_active_model_id", "")
        prompt   = build_prompt(system_prompt, history, message, model_id=active)
        result   = model.generate_text(prompt=prompt)
        response = clean_response(result)
    except EnvironmentError as e:
        response = (
            f"⚠️ Configuration error: {e}. "
            "Please check your .env file and restart the server."
        )
    except Exception as e:
        response = (
            f"⚠️ I encountered an issue reaching the AI service: {str(e)[:200]}. "
            "Please try again in a moment."
        )

    # Persist conversation
    history.append({"role": "user",      "content": message,  "time": _now()})
    history.append({"role": "assistant", "content": response,  "time": _now()})
    session["chat_history"] = history[-40:]   # keep last 20 turns

    return jsonify({"response": response, "profile": profile})


@app.route("/clear-chat", methods=["POST"])
def clear_chat():
    session["chat_history"] = []
    return jsonify({"status": "cleared"})


# ── Profile management ────────────────────────────────────────────────────────

@app.route("/profiles", methods=["GET"])
def get_profiles():
    profiles = session.get("user_profiles", {})
    active   = session.get("active_profile", "Me")
    return jsonify({"profiles": list(profiles.keys()), "active": active})


@app.route("/profiles", methods=["POST"])
def save_profile():
    data    = request.get_json(force=True)
    name    = data.get("name", "").strip()
    profile = data.get("profile", {})
    if not name:
        return jsonify({"error": "Profile name required"}), 400
    profiles = session.get("user_profiles", {})
    profiles[name] = profile
    session["user_profiles"]  = profiles
    session["active_profile"] = name
    return jsonify({"status": "saved", "name": name})


@app.route("/profiles/switch", methods=["POST"])
def switch_profile():
    data    = request.get_json(force=True)
    name    = data.get("name", "").strip()
    profiles = session.get("user_profiles", {})
    if name not in profiles:
        return jsonify({"error": "Profile not found"}), 404
    session["active_profile"] = name
    session["chat_history"]   = []
    return jsonify({"status": "switched", "name": name, "profile": profiles[name]})


@app.route("/profiles/delete", methods=["POST"])
def delete_profile():
    data     = request.get_json(force=True)
    name     = data.get("name", "").strip()
    profiles = session.get("user_profiles", {})
    if name in profiles and name != "Me":
        del profiles[name]
        session["user_profiles"] = profiles
        if session.get("active_profile") == name:
            session["active_profile"] = "Me"
    return jsonify({"status": "deleted"})


# ── BMI Calculator endpoint ───────────────────────────────────────────────────

@app.route("/bmi", methods=["POST"])
def calculate_bmi():
    data   = request.get_json(force=True)
    weight = float(data.get("weight", 0))   # kg
    height = float(data.get("height", 0))   # cm
    age    = int(data.get("age", 25))
    gender = data.get("gender", "other")

    if weight <= 0 or height <= 0:
        return jsonify({"error": "Invalid weight/height"}), 400

    h_m  = height / 100
    bmi  = round(weight / (h_m ** 2), 1)

    if bmi < 18.5:
        category, advice_key = "Underweight", "weight_gain"
    elif bmi < 25:
        category, advice_key = "Normal weight", "maintain"
    elif bmi < 30:
        category, advice_key = "Overweight", "weight_loss"
    else:
        category, advice_key = "Obese", "weight_loss"

    # Mifflin-St Jeor BMR
    if gender.lower() == "female":
        bmr = 10 * weight + 6.25 * height - 5 * age - 161
    else:
        bmr = 10 * weight + 6.25 * height - 5 * age + 5

    tdee = {
        "sedentary":   round(bmr * 1.2),
        "light":       round(bmr * 1.375),
        "moderate":    round(bmr * 1.55),
        "active":      round(bmr * 1.725),
        "very_active": round(bmr * 1.9),
    }

    return jsonify({
        "bmi":      bmi,
        "category": category,
        "bmr":      round(bmr),
        "tdee":     tdee,
        "advice":   advice_key,
    })


# ── Meal Plan generator ───────────────────────────────────────────────────────

@app.route("/meal-plan", methods=["POST"])
def generate_meal_plan():
    data         = request.get_json(force=True)
    goal         = data.get("goal", "balanced diet")
    calories     = data.get("calories", 2000)
    diet_type    = data.get("diet_type", "vegetarian")
    days         = min(int(data.get("days", 3)), 7)
    profile_name = session.get("active_profile", "Me")
    profiles     = session.get("user_profiles", {})
    profile      = profiles.get(profile_name, {})

    prompt_text = (
        f"Generate a detailed {days}-day Indian meal plan for a person with the following goal: {goal}. "
        f"Target calories per day: {calories} kcal. Diet type: {diet_type}. "
        f"Include Breakfast, Mid-Morning Snack, Lunch, Evening Snack, and Dinner for each day. "
        f"For each meal, list ingredients with approximate quantities and calorie count. "
        f"Use Indian recipes and locally available ingredients. "
        f"Format clearly with Day headings and meal sub-headings."
    )

    system_prompt = build_system_prompt(profile)

    try:
        model  = get_watsonx_model()
        active = getattr(model, "_active_model_id", "")
        prompt = build_prompt(system_prompt, [], prompt_text, model_id=active)
        result = model.generate_text(prompt=prompt)
        plan   = clean_response(result)
    except Exception as e:
        plan = f"⚠️ Could not generate meal plan: {str(e)[:200]}"

    return jsonify({"meal_plan": plan, "days": days, "goal": goal})


# ── Nutrition analysis ────────────────────────────────────────────────────────

@app.route("/analyze", methods=["POST"])
def analyze_nutrition():
    data  = request.get_json(force=True)
    foods = data.get("foods", "")
    if not foods:
        return jsonify({"error": "No food items provided"}), 400

    prompt_text = (
        f"Analyse the nutritional content of the following foods/meal:\n{foods}\n\n"
        "Provide a breakdown table with: Food Item | Quantity | Calories | Protein(g) | "
        "Carbs(g) | Fat(g) | Fibre(g) | Key Micronutrients. "
        "Then give a total row and an overall health assessment with improvement suggestions."
    )

    system_prompt = build_system_prompt(session.get("user_profiles", {}).get(
        session.get("active_profile", "Me"), {}))

    try:
        model    = get_watsonx_model()
        active   = getattr(model, "_active_model_id", "")
        prompt   = build_prompt(system_prompt, [], prompt_text, model_id=active)
        analysis = clean_response(model.generate_text(prompt=prompt))
    except Exception as e:
        analysis = f"⚠️ Analysis failed: {str(e)[:200]}"

    return jsonify({"analysis": analysis})


# ── Dashboard data ────────────────────────────────────────────────────────────

@app.route("/dashboard-data")
def dashboard_data():
    profile_name = session.get("active_profile", "Me")
    profiles     = session.get("user_profiles", {})
    profile      = profiles.get(profile_name, {})
    history      = session.get("chat_history", [])
    return jsonify({
        "profile":       profile,
        "profile_name":  profile_name,
        "message_count": len([m for m in history if m["role"] == "user"]),
        "profiles":      list(profiles.keys()),
    })


# ─────────────────────────────────────────────────────────────────────────────
#  UTILITIES
# ─────────────────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now().strftime("%H:%M")


def _auto_extract_profile(message: str, profile: dict) -> dict:
    """
    Use regex heuristics to pull common profile fields from natural
    language messages so the system prompt always has fresh context.
    """
    msg = message.lower()

    # Age
    m = re.search(r'\b(\d{1,3})\s*(?:years?\s*old|yr|yrs)\b', msg)
    if m:
        profile["age"] = m.group(1)

    # Weight
    m = re.search(r'\b(\d{2,3}(?:\.\d)?)\s*(?:kg|kilograms?)\b', msg)
    if m:
        profile["weight_kg"] = m.group(1)

    # Height (cm)
    m = re.search(r'\b(\d{3})\s*(?:cm|centimeters?)\b', msg)
    if m:
        profile["height_cm"] = m.group(1)

    # Height (feet/inches)
    m = re.search(r"\b(\d)'(\d{1,2})\b", msg)
    if m:
        ft, inch = int(m.group(1)), int(m.group(2))
        profile["height_cm"] = str(round((ft * 30.48) + (inch * 2.54), 1))

    # Gender
    if re.search(r'\b(male|man|boy)\b', msg):
        profile["gender"] = "male"
    elif re.search(r'\b(female|woman|girl)\b', msg):
        profile["gender"] = "female"

    # Diet type
    for diet in ["vegan", "vegetarian", "non-vegetarian", "eggetarian", "jain", "keto", "paleo"]:
        if diet in msg:
            profile["diet_type"] = diet
            break

    # Medical conditions
    for cond in ["diabetes", "hypertension", "thyroid", "pcos", "pcod",
                 "cholesterol", "kidney", "heart", "anaemia", "obesity"]:
        if cond in msg:
            existing = profile.get("conditions", "")
            if cond not in existing:
                profile["conditions"] = (existing + ", " + cond).strip(", ")

    # Location / region
    for region in ["mumbai", "delhi", "bangalore", "bengaluru", "chennai", "kolkata",
                   "hyderabad", "pune", "kerala", "gujarat", "rajasthan", "punjab",
                   "west bengal", "maharashtra", "tamil nadu", "karnataka"]:
        if region in msg:
            profile["region"] = region.title()
            break

    return profile


if __name__ == "__main__":
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "True").lower() == "true"
    app.run(debug=debug, host="0.0.0.0", port=port)
