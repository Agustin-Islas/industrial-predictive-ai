#  Documentación de Notebooks — Fase 1 (Machine Learning)

Este documento describe qué hace cada notebook del proyecto, los resultados obtenidos, y las decisiones técnicas tomadas.

---

## Notebook 01: Análisis Exploratorio del AI4I (`01_eda_ai4i.ipynb`)

### Objetivo
Explorar el dataset AI4I 2020 Predictive Maintenance (UCI/Kaggle) para entender la distribución de variables, detectar el desbalance de clases, y crear nuevas features derivadas.

### Qué hace paso a paso
1. **Carga del CSV** original `ai4i2020.csv` (10,000 registros, 14 columnas)
2. **Inspección general**: tipos de datos, valores nulos, estadísticas descriptivas
3. **Análisis de desbalance**: solo 339 fallas (3.39%) sobre 10,000 muestras — el dataset es altamente desbalanceado
4. **Distribución por tipo de falla**: HDF (115), PWF (91), OSF (78), TWF (45), RNF (19)
5. **Feature Engineering** — se crean 3 variables derivadas:
   - `delta_temp`: Diferencia entre temperatura de proceso y temperatura ambiente (indicador de disipación térmica)
   - `power_kw`: Potencia mecánica calculada como `(Torque x RPM) / 9549`
   - `wear_torque`: Interacción entre desgaste de herramienta y torque aplicado
6. **Exportación** del dataset enriquecido a `data/ai4i2020_fe.csv`

### Resultado
- Dataset limpio y enriquecido con 3 features adicionales, listo para alimentar los modelos de las fases siguientes

---

## Notebook 02: Clasificación Multi-Falla con XGBoost + SHAP (`02_classification_xgboost.ipynb`)

### Objetivo
Entrenar un clasificador que prediga el **tipo específico de falla** (no solo sí/no) y agregar **explicabilidad** mediante SHAP para justificar cada predicción.

### Qué hace paso a paso
1. **Carga** del dataset enriquecido `ai4i2020_fe.csv`
2. **Filtrado**: se eliminan las fallas aleatorias (RNF) ya que por definición no son predecibles por telemetría
3. **Creación del target multi-clase**: 0=Normal, 1=TWF, 2=HDF, 3=PWF, 4=OSF
4. **Split** 80/20 estratificado
5. **Manejo de desbalance**: se usa `compute_sample_weight('balanced')` para darle más peso a las clases minoritarias
6. **Entrenamiento** de XGBClassifier (multi:softprob, 5 clases, max_depth=5, 100 árboles)
7. **Evaluación**: Classification Report + Matriz de Confusión
8. **Explicabilidad SHAP**: TreeExplainer genera un gráfico de importancia de features por clase
9. **Exportación** del modelo a `models/xgboost_classifier.pkl` y el explainer a `models/shap_explainer.pkl`

### Resultados

| Clase | Precision | Recall | F1 | Support |
|-------|-----------|--------|-----|---------|
| Normal | 1.00 | 0.98 | 0.99 | 1931 |
| TWF (Desgaste) | 0.04 | 0.11 | 0.06 | 9 |
| HDF (Calor) | 0.88 | 1.00 | 0.94 | 23 |
| PWF (Potencia) | 1.00 | 1.00 | 1.00 | 18 |
| OSF (Sobreesfuerzo) | 0.70 | 1.00 | 0.82 | 16 |

- **Accuracy global: 98%**
- TWF tiene F1 bajísimo (0.06) porque solo hay 9 muestras en test — es un problema de cantidad de datos, no del modelo
- HDF, PWF y OSF se detectan con recall del 100% (no se escapa ninguna falla real)

### Decisiones técnicas
- Se renombran las columnas del DataFrame para eliminar caracteres `[`, `]`, `<` que XGBoost no acepta en los feature names
- Se usa `sample_weight` en lugar de SMOTE para manejar el desbalance

---

## Notebook 03: Detección de Anomalías con Autoencoder (`03_anomaly_autoencoder.ipynb`)

### Objetivo
Entrenar una red neuronal que detecte **comportamiento anómalo nunca antes visto**, sin depender de etiquetas de fallas conocidas.

### Qué hace paso a paso
1. **Separación** de datos normales vs datos con falla
2. **Normalización** con StandardScaler (fit solo en datos normales)
3. **Arquitectura del Autoencoder** en PyTorch:
   - Encoder: 8 -> 16 -> 8 -> **4** (espacio latente comprimido)
   - Decoder: 4 -> 8 -> 16 -> 8 (reconstrucción)
4. **Entrenamiento** durante 50 epochs (solo con datos normales) usando MSE Loss
5. **Cálculo del umbral de anomalía**: percentil 99 del error de reconstrucción sobre datos normales de validación
6. **Visualización**: histograma superpuesto del error de reconstrucción para datos normales (verde) vs fallas conocidas (rojo)
7. **Exportación**: modelo a `models/autoencoder.pt`, scaler a `models/scalers/autoencoder_scaler.pkl`, umbral a `models/anomaly_threshold.txt`

### Resultados
- **Loss final (Epoch 50):** 0.0166
- **Umbral de anomalía:** 0.1124
- Convergencia limpia: la curva de entrenamiento baja de 0.11 a 0.0166 en 50 epochs
- El gráfico de distribución muestra separación visible entre datos normales y datos con falla

### Decisiones técnicas
- Se usa `device = torch.device('cpu')` porque el dataset es pequeño (10K filas) y evita conflictos con drivers CUDA en Windows
- El umbral se calcula como percentil 99 (no 95) para minimizar falsos positivos en producción

---

## Notebook 04: Análisis Exploratorio del NASA C-MAPSS (`04_eda_cmapss.ipynb`)

### Objetivo
Preparar el dataset de degradación de turbinas de la NASA para entrenar el modelo LSTM de predicción de vida útil.

### Qué hace paso a paso
1. **Carga** del dataset `train_FD001.txt` (sin cabeceras — se asignan manualmente)
2. **Cálculo del RUL**: para cada motor, RUL = ciclo máximo - ciclo actual
3. **Piecewise Linear Clipping**: se limita el RUL máximo a 125 ciclos (estándar en la literatura, porque predecir una falla a más de 125 ciclos es poco fiable y no aporta valor)
4. **Visualización de degradación**: gráfico dual de un sensor vs RUL para un motor de ejemplo
5. **Selección de features**: se calcula la correlación de los 21 sensores con el RUL y se descartan los que tienen |correlación| < 0.5
6. **Exportación** de la lista de sensores útiles a `models/useful_sensors_cmapss.pkl`

### Resultados
- **20,631 registros**, **100 motores** en el set de entrenamiento
- **12 sensores seleccionados**: sensor_2, 3, 4, 7, 8, 11, 12, 13, 15, 17, 20, 21
- Los sensores descartados (1, 5, 6, 9, 10, 14, 16, 18, 19) tienen varianza nula o no correlacionan con la degradación — consistente con la literatura académica del C-MAPSS

---

## Notebook 05: Predicción de Vida Útil (LSTM) (`05_rul_lstm.ipynb`)

### Objetivo
Entrenar una red LSTM que, dada una ventana temporal de 30 ciclos de lecturas de sensores, prediga cuántos ciclos le quedan al motor antes de fallar.

### Qué hace paso a paso
1. **Carga** de train, test y ground truth del FD001
2. **Normalización** con MinMaxScaler (fit solo en train, transform en ambos)
3. **Ventanas deslizantes**: para entrenamiento, se generan todas las posibles ventanas de 30 ciclos consecutivos. Para test, se toma solo la última ventana de cada motor
4. **Arquitectura LSTM**:
   - 2 capas LSTM con 64 unidades ocultas y dropout 0.2
   - Capa densa: 64 -> 32 -> 1 (output continuo: RUL en ciclos)
5. **Entrenamiento mejorado** (100 epochs):
   - Learning rate inicial: 0.005 (5x más alto que la versión anterior)
   - `ReduceLROnPlateau`: reduce el LR a la mitad si el loss se estanca por 10 epochs
   - `clip_grad_norm`: gradient clipping para estabilidad numérica
   - Se guarda automáticamente el mejor modelo (`lstm_rul_best.pt`)
6. **Evaluación sobre set de test**: RMSE y MAE sobre los 100 motores de test
7. **Gráficos**: scatter plot de RUL predicho vs real + barras de error por motor
8. **Exportación** del modelo final a `models/lstm_rul.pt`

### Resultados
- Referencia de la literatura: RMSE ~12-13 ciclos para modelos LSTM bien tuneados sobre FD001
- Pendiente de re-ejecución con la versión mejorada (100 epochs + scheduler)

### Decisiones técnicas
- Se usa `clip(max=125)` sobre los labels de test para consistencia con el entrenamiento
- Para motores con menos de 30 ciclos en test, se aplica zero-padding al inicio de la secuencia
- Se guarda el "mejor" modelo durante el entrenamiento (early stopping implícito por checkpointing)

---

## Artefactos Generados (carpeta `models/`)

| Archivo | Modelo | Descripción |
|---------|--------|-------------|
| `xgboost_classifier.pkl` | XGBoost | Clasificador multi-falla (5 clases) |
| `shap_explainer.pkl` | SHAP | TreeExplainer para generar explicaciones |
| `autoencoder.pt` | PyTorch | Autoencoder para detección de anomalías |
| `anomaly_threshold.txt` | — | Umbral numérico para clasificar anomalías |
| `lstm_rul.pt` | PyTorch | LSTM para predicción de RUL |
| `lstm_rul_best.pt` | PyTorch | Mejor checkpoint del LSTM durante entrenamiento |
| `scalers/autoencoder_scaler.pkl` | Scikit-learn | StandardScaler del autoencoder |
| `scalers/lstm_scaler.pkl` | Scikit-learn | MinMaxScaler de la LSTM |
| `useful_sensors_cmapss.pkl` | — | Lista de 12 sensores seleccionados |
