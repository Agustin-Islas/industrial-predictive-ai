# Industrial Predictive AI: Plataforma de Mantenimiento Predictivo Industrial ️

**[🌐 Ver Demo en Vivo (App)](https://industrial-predictive-ai.vercel.app)** | **[📄 Ver API Docs (Swagger)](https://industrial-predictive-ai.onrender.com/docs)**

> **Transformando datos de telemetría en disponibilidad operativa.** Una solución *end-to-end* que aplica Deep Learning y Machine Learning para anticipar fallas en activos críticos, optimizando los programas de mantenimiento y reduciendo el tiempo de inactividad no planificado (Unplanned Downtime).

##  Valor Industrial y Caso de Negocio

El mantenimiento reactivo y preventivo tradicional a menudo resulta en costos innecesarios o paradas catastróficas imprevistas. **Industrial Predictive AI** introduce una estrategia de **Mantenimiento Predictivo (PdM)** orientada a la industria pesada:

- **Reducción de Paradas Imprevistas:** Detección temprana de anomalías termodinámicas y mecánicas antes de que alcancen umbrales críticos de falla.
- **Mantenimiento Basado en Condición (CBM):** Transición de mantenimientos basados en calendario a intervenciones basadas en el estado real del activo.
- **Optimización de OEE (Overall Equipment Effectiveness):** Maximiza el tiempo de actividad al predecir el Remaining Useful Life (RUL) de equipos de ciclo continuo.
- **Decisiones Explicables (XAI):** En entornos industriales, la "caja negra" no es aceptable. Se incorpora **SHAP** (SHapley Additive exPlanations) para justificar y explicar al operario *por qué* el modelo predice una falla.

##  Arquitectura de Machine Learning Multi-Activo

El núcleo de la plataforma no depende de un único modelo genérico, sino que emplea una arquitectura ensamblada, especializada según la naturaleza de la máquina (respaldada por los datasets de referencia industrial **NASA CMAPSS** y **AI4I**):

### 1. Motores y Bombas (Clasificación y Detección de Novedades)
Evalúa mediciones instantáneas de torque, RPM y temperaturas para equipos rotativos.
- **Diagnóstico Preciso (XGBoost):** Clasificador multiclase robusto para detectar firmas de falla específicas: TWF (Desgaste), HDF (Disipación de Calor), PWF (Falla de Potencia) y OSF (Sobreesfuerzo).
- **Monitoreo No Supervisado (Autoencoder):** Red neuronal profunda entrenada exclusivamente con comportamiento "sano". Detecta de inmediato cualquier desviación operativa no clasificada mediante el Error Cuadrático de Reconstrucción (MSE).

### 2. Turbinas de Gas y Compresores Mayores (Series Temporales)
Analiza la degradación termodinámica prolongada (presiones y temperaturas en LPC, HPC y quemador).
- **Pronóstico de RUL (LSTM):** Red Neuronal Recurrente (Long Short-Term Memory) que consume ventanas secuenciales de 30 ciclos operativos para proyectar con rigor matemático los ciclos de vida útil restantes antes del colapso funcional.

##  Notebooks de Experimentación (Jupyter)

Todo el proceso de Análisis Exploratorio (EDA), Feature Engineering y Entrenamiento de los modelos está documentado paso a paso en los notebooks de experimentación adjuntos. Son el origen matemático de los modelos en producción:

1. [01_eda_ai4i.ipynb](notebooks/01_eda_ai4i.ipynb): Análisis Exploratorio del dataset AI4I. Limpieza de datos, análisis de correlación y visualización de las distribuciones de los distintos modos de falla rotativa (TWF, HDF, PWF, OSF).
2. [02_classification_xgboost.ipynb](notebooks/02_classification_xgboost.ipynb): Entrenamiento del modelo de Clasificación Multiclase. Optimización de hiperparámetros, validación cruzada y extracción del explicador TreeSHAP para la interpretabilidad en planta.
3. [03_anomaly_autoencoder.ipynb](notebooks/03_anomaly_autoencoder.ipynb): Diseño y entrenamiento de la red neuronal Autoencoder en PyTorch. Se entrena solo con muestras "Sanas" para aprender a calcular el umbral dinámico del Error de Reconstrucción (MSE).
4. [04_eda_cmapss.ipynb](notebooks/04_eda_cmapss.ipynb): Análisis profundo del dataset CMAPSS de la NASA (Turbinas de Gas). Identificación matemática de los 12 sensores termodinámicos con mayor correlación a la degradación a lo largo del tiempo de vida del motor.
5. [05_rul_lstm.ipynb](notebooks/05_rul_lstm.ipynb): Construcción de la red neuronal recurrente LSTM. Formateo de las series temporales en secuencias deslizantes (ventanas de 30 ciclos) y entrenamiento de la red para predecir de forma continua el RUL (Remaining Useful Life).

##  Ingeniería de Software y Despliegue

La solución va más allá de un *notebook* de experimentación, implementando un entorno de producción que procesa un flujo de telemetría en tiempo real:

- **Procesamiento Asíncrono de Inferencia:** Backend desarrollado en **FastAPI (Python)** manejando WebSockets bidireccionales. Los cálculos matemáticos pesados (inferencia del árbol SHAP) se delegan a un `ThreadPoolExecutor` para asegurar un flujo concurrente sin bloquear el *Event Loop*.
- **Frontend Reactivo (SCADA-style):** Interfaz construida con **Next.js y Recharts**, diseñada con criterios de usabilidad industrial. La plataforma reacciona dinámicamente, cambiando por completo su disposición gráfica según el equipo físico que el operador esté monitoreando.
- **Streaming de Datos Simulados:** Motor de simulación estocástica que inyecta ruido blanco y gradientes de degradación, imitando sensores reales de redes PLC/SCADA.

##  Tecnologías Utilizadas

- **Inteligencia Artificial:** PyTorch (LSTM, Autoencoders), Scikit-Learn, XGBoost, SHAP.
- **Backend:** Python 3.11, FastAPI, Uvicorn, Asyncio.
- **Frontend:** React, Next.js, TailwindCSS, Recharts.
- **Arquitectura:** WebSockets (Real-time), Arquitectura de Microservicios (en proceso de Dockerización).

## ️ Ejecución Local

1. **Instalar Backend:**
   ```bash
   python -m venv venv
   source venv/Scripts/activate # o venv\Scripts\activate en Windows
   pip install -r requirements.txt
   uvicorn backend.main:app --host 0.0.0.0 --port 8000
   ```
2. **Instalar Frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---
*Desarrollado como demostración técnica de integración entre Ingeniería de Datos, Inteligencia Artificial y Desarrollo Full-Stack orientado a la Industria 4.0.*
