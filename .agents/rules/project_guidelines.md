# Guidelines for Predictive Maintenance Project

## 1. Project Overview
This project builds an industrial predictive maintenance platform using a 3-layer architecture:
- Anomaly Detection (Autoencoder)
- Multi-failure Classification (XGBoost + SHAP)
- Remaining Useful Life Prediction (LSTM)

## 2. Technology Stack
- **Data Science/ML:** Python, Pandas, Scikit-Learn, XGBoost, PyTorch, SHAP
- **Backend:** FastAPI (Python), Uvicorn
- **Frontend:** Next.js (React), Vanilla CSS, Recharts, WebSockets
- **Deployment:** Docker

## 3. Workflow & Code Standards
- **Data Preprocessing:** Always normalize sensor data using Min-Max scaling for LSTMs.
- **Model Explainability:** Every classification must be accompanied by a SHAP-based natural language explanation.
- **API Design:** Use REST for static predictions and WebSockets for real-time telemetry streaming.
- **Frontend Design:** Industrial aesthetic (dark theme, cyan/green/red accents, monospace fonts for data).

## 4. Datasets
- **AI4I 2020:** Used for Anomaly Detection (Layer 1) and Classification (Layer 2).
- **NASA C-MAPSS (FD001):** Used for Remaining Useful Life (RUL) prediction (Layer 3).
