# 🏗️ Arquitectura del Sistema

El sistema está diseñado en 3 capas de inteligencia que operan en conjunto para proveer alertas tempranas, explicables y precisas.

## Capas de Inteligencia

1. **Detección de Anomalías (Autoencoder):** Detecta comportamiento anómalo. Ver [[Models#Autoencoder]].
2. **Clasificación Multi-Falla (XGBoost + SHAP):** Clasifica el tipo de falla (TWF, HDF, PWF, OSF) con explicabilidad. Ver [[Models#XGBoost]].
3. **Predicción de RUL (LSTM):** Estima el Remaining Useful Life (RUL) en ciclos. Ver [[Models#LSTM]].

## Flujo de Datos

1. Los sensores industriales envían datos (simulados vía WebSocket).
2. El **Backend (FastAPI)** recibe los datos y consulta los 3 modelos simultáneamente.
3. Se genera un JSON unificado con la predicción, el análisis de anomalía, y la explicación SHAP.
4. El **Frontend (Next.js)** consume este endpoint y actualiza el Dashboard en tiempo real.
