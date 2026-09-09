# Plataforma de Mantenimiento Predictivo (YPF Predict)

Plataforma inteligente para la predicción de fallas y estimación de vida útil restante en equipos rotativos e industriales (Motores y Turbinas), utilizando modelos avanzados de Machine Learning y Deep Learning.

## Arquitectura Multi-Activo

El sistema soporta el monitoreo de distintos tipos de activos, adaptando sus modelos matemáticos según la naturaleza del equipo:

### 1. Motores y Bombas (Dominio AI4I)
Utiliza un ensamble de modelos tradicionales y redes no supervisadas:
- **Diagnóstico (XGBoost):** Clasificación multiclase para detectar fallas conocidas como TWF (Tool Wear Failure), HDF (Heat Dissipation Failure) o PWF (Power Failure).
- **Impacto de Variables (TreeSHAP):** Desglose en tiempo real del peso que tiene cada sensor en el diagnóstico actual del modelo XGBoost.
- **Detección de Anomalías (Autoencoder):** Red neuronal no supervisada, entrenada exclusivamente con comportamiento normal. Detecta desviaciones desconocidas utilizando el Error Cuadrático Medio de Reconstrucción (MSE).

### 2. Turbinas y Compresores (Dominio CMAPSS)
Utiliza modelos secuenciales profundos para series temporales:
- **Estimación de Vida Útil (LSTM):** Red Neuronal Long Short-Term Memory que analiza el historial de ciclos termodinámicos continuos (ventana de 30 ciclos) para predecir de forma exacta el RUL (Remaining Useful Life).
- **Telemetría Termodinámica:** Monitoreo en tiempo real de presiones y temperaturas en etapas críticas (quemador, compresores LPC/HPC, bypass).

## Tecnologías

- **Frontend:** React, Next.js, Recharts, TailwindCSS. Implementado en un entorno de React Server Components con un Dashboard reactivo (SCADA-style) adaptativo al Activo mediante WebSockets.
- **Backend:** FastAPI (Python), Uvicorn. Arquitectura modular y asíncrona para servir modelos sin bloqueo de Event Loop (cálculos SHAP asíncronos vía Threads).
- **Machine Learning:** PyTorch (LSTM, Autoencoder), XGBoost, Scikit-Learn.

## Ejecución Local

1. **Instalar dependencias Backend:**
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. **Levantar Backend:**
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```
3. **Levantar Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Próximos Pasos (Fase 4)
- Dockerización de toda la plataforma (`docker-compose` con backend y frontend aislados).
