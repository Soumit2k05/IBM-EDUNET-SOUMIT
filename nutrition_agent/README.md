# 🥗 NutriBot — AI-Powered Nutrition Agent

> An intelligent nutrition coaching web application powered by **IBM watsonx.ai** with Granite models.  
> Built with **Python Flask** + **Bootstrap 5** with full dark-mode, animations, and mobile responsiveness.

---

## ✨ Features

| Feature | Description |
|---|---|
| 💬 **AI Chat** | Real-time conversational nutrition coaching via IBM Granite LLM |
| 📊 **Nutrition Dashboard** | Live profile stats — age, weight, BMI, diet type |
| 🗓️ **AI Meal Planner** | 1–7 day Indian meal plans by goal, diet type, and calorie target |
| 🔬 **Nutrition Analyzer** | Instant calorie & macronutrient breakdown of any food/meal |
| ⚖️ **BMI Calculator** | BMI + BMR + full TDEE table by activity level |
| 👨‍👩‍👧‍👦 **Family Profiles** | Multi-user support — manage and switch between family member profiles |
| 🌙 **Dark Mode** | Full dark/light theme toggle, persisted in localStorage |
| 📱 **Mobile Responsive** | Fully responsive Bootstrap 5 layout for all screen sizes |
| 🇮🇳 **Indian Food Focus** | Traditional recipes, regional ingredients, Ayurvedic superfoods |
| ⚙️ **AGENT_INSTRUCTIONS** | Centralised config file to tune agent behaviour without touching backend |

---

## 📁 Project Structure

```
nutrition_agent/
├── app.py                    ← Flask backend, routes, watsonx.ai integration
├── agent_instructions.py     ← 🔧 AGENT CONFIG: persona, diet specs, safety rules
├── requirements.txt
├── .env.example              ← Copy to .env and fill in your credentials
├── .env                      ← ⚠️  NOT committed to Git
├── .gitignore
├── templates/
│   ├── base.html             ← Navbar, modals, footer
│   └── index.html            ← Main page: chat, dashboard, planner, analyzer
└── static/
    ├── css/
    │   └── style.css         ← Full theme system, animations, responsive
    └── js/
        ├── app.js            ← Global utils, theme toggle, tips carousel
        ├── chat.js           ← Chat UI: send, receive, typing indicator, export
        ├── bmi.js            ← BMI/BMR/TDEE calculator
        ├── mealplanner.js    ← Meal plan generator & nutrition analyzer
        └── profiles.js       ← Family profile CRUD
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10 or higher
- IBM Cloud account with **watsonx.ai** access
- A watsonx.ai **Project ID**

### 2. Clone / download the project
```bash
# If using Git:
git clone <your-repo-url>
cd nutrition_agent

# Or just navigate to the folder:
cd "C:\Users\SOUMIT MAL\Downloads\Internships\IBM-EDUNET\BOB TEST\nutrition_agent"
```

### 3. Create a virtual environment
```bash
python -m venv venv

# Windows:
venv\Scripts\activate

# macOS/Linux:
source venv/bin/activate
```

### 4. Install dependencies
```bash
pip install -r requirements.txt
```

### 5. Configure environment variables
```bash
# Copy the example file:
copy .env.example .env        # Windows
cp .env.example .env          # macOS/Linux
```

Now edit `.env` and fill in your values:
```env
IBM_API_KEY=your_ibm_cloud_api_key_here
WATSONX_PROJECT_ID=your_watsonx_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-3-8b-instruct
FLASK_SECRET_KEY=any-random-string-at-least-32-chars
FLASK_ENV=development
FLASK_DEBUG=True
```

### 6. Run the application
```bash
python app.py
```

Open your browser at: **http://localhost:5000**

---

## 🔑 Getting IBM watsonx.ai Credentials

### IBM Cloud API Key
1. Go to [https://cloud.ibm.com/iam/apikeys](https://cloud.ibm.com/iam/apikeys)
2. Click **Create an IBM Cloud API key**
3. Copy the key and paste it into `.env` as `IBM_API_KEY`

### watsonx.ai Project ID
1. Go to [https://dataplatform.cloud.ibm.com](https://dataplatform.cloud.ibm.com)
2. Open your watsonx.ai project
3. Go to **Manage** → **General** tab
4. Copy the **Project ID**
5. Paste it into `.env` as `WATSONX_PROJECT_ID`

### Supported Granite Model IDs
| Model ID | Description |
|---|---|
| `ibm/granite-3-8b-instruct` | ✅ Recommended — fast & capable |
| `ibm/granite-13b-instruct-v2` | More capable, slower |
| `ibm/granite-3-2-8b-instruct-preview-rc` | Latest preview |

---

## ⚙️ Customising the Agent (`agent_instructions.py`)

Edit [`agent_instructions.py`](agent_instructions.py) to customise the AI without touching the backend:

```python
# Change the agent's name and persona
AGENT_NAME = "NutriBot"
AGENT_PERSONA = "You are NutriBot, a friendly nutrition specialist..."

# Toggle diet specialisations on/off
DIET_SPECIALISATIONS = {
    "indian_traditional": True,
    "diabetic_friendly":  True,
    "keto":               False,   # Turn off keto
    ...
}

# Tune generation parameters
GENERATION_PARAMS = {
    "temperature":    0.7,    # Higher = more creative
    "max_new_tokens": 1024,   # Longer responses
    ...
}
```

---

## 🌐 Deployment

### Option A: Local (Development)
```bash
python app.py
```

### Option B: Production with Gunicorn (Linux/macOS)
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

### Option C: Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "2", "-b", "0.0.0.0:5000", "app:app"]
```

```bash
docker build -t nutribot .
docker run -p 5000:5000 --env-file .env nutribot
```

### Option D: IBM Code Engine
```bash
ibmcloud ce application create \
  --name nutribot \
  --image us.icr.io/<namespace>/nutribot:latest \
  --env-from-secret nutribot-secrets \
  --port 5000
```

---

## 🩺 Safety & Disclaimer

NutriBot is an AI assistant for **educational and informational purposes only**.  
It is **not a substitute** for professional medical advice, diagnosis, or treatment.  
Always consult a registered dietitian or doctor before making significant dietary changes,  
especially if you have a medical condition.

---

## 🛠️ Troubleshooting

| Issue | Solution |
|---|---|
| `EnvironmentError: IBM_API_KEY...` | Check your `.env` file exists and has the correct values |
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` in your virtual environment |
| `401 Unauthorized` | Your IBM API key may have expired — generate a new one |
| `404 Project Not Found` | Double-check your `WATSONX_PROJECT_ID` in the watsonx.ai dashboard |
| Model returns empty text | Try a different `WATSONX_MODEL_ID` or increase `max_new_tokens` |

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

<div align="center">
  <strong>Built with ❤️ using IBM watsonx.ai + Granite Models</strong><br/>
  IBM EDUNET Internship Project
</div>
