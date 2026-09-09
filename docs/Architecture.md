# 🏗️ Arquitectura del Sistema

El sistema está diseñado con una **Arquitectura Multi-Activo** que soporta dominios industriales distintos (Motores y Turbinas), separando los flujos de inferencia de Machine Learning según la naturaleza del equipo físico.

## 1. Motores y Bombas (Dominio AI4I)
Utilizan datos de sensores rotativos estándar. El pipeline se compone de:
- **Detección de Anomalías (Autoencoder):** Detecta comportamiento anómalo. Ver [[Models#Autoencoder]].
- **Clasificación Multi-Falla (XGBoost + SHAP):** Clasifica el tipo de falla (TWF, HDF, PWF, OSF) con explicabilidad. Ver [[Models#XGBoost]].

## 2. Turbinas y Compresores (Dominio CMAPSS)
Utilizan telemetría termodinámica compleja a través de series temporales.
- **Predicción de RUL (LSTM):** Estima el Remaining Useful Life (RUL) en ciclos. Ver [[Models#LSTM]].

## Flujo de Datos y Backend

1. **Simulación Inteligente:** El Frontend incluye un hook (`useSimulation.ts`) que genera secuencias realistas (CMAPSS o AI4I) según el Activo seleccionado y las envía vía WebSockets.
2. **Backend Modular y Asíncrono (FastAPI):** El backend divide responsabilidades en `schemas.py`, `ml_models.py` y `main.py`.
3. **Inferencia No Bloqueante:** Cálculos matemáticamente pesados como TreeSHAP se delegan a un `ThreadPoolExecutor` (vía `asyncio.to_thread`) garantizando que el WebSocket no se congele para otros clientes concurrentes.
4. **UI Dinámica (Next.js):** El Dashboard adapta instantáneamente sus gráficos (SCADA-style) y Paneles si se selecciona un Motor o una Turbina.
