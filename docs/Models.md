# 🧠 Modelos de Machine Learning

Detalle de los modelos implementados en el proyecto. Todos los modelos se encuentran en la carpeta `notebooks/` para experimentación y `models/` para producción.

## Dominio: Motores (Dataset AI4I 2020)

### Autoencoder
- **Framework:** PyTorch
- **Propósito:** Detectar anomalías midiendo el error de reconstrucción de las señales de entrada (Detección no supervisada).
- **Input:** Variables operativas estáticas normalizadas.
- **Output:** Score de anomalía (Error de reconstrucción MSE).

### XGBoost + SHAP
- **Framework:** Scikit-Learn / XGBoost
- **Propósito:** Clasificar el tipo de falla inminente y proveer interpretabilidad mediante valores SHAP.
- **Input:** Variables operativas y features derivadas (ej. delta_temp, power_kw).
- **Output:** Probabilidades multiclase y matriz de impacto de variables (TreeSHAP).

## Dominio: Turbinas (Dataset CMAPSS NASA)

### LSTM (Long Short-Term Memory)
- **Framework:** PyTorch
- **Propósito:** Predecir el Remaining Useful Life (RUL) utilizando el comportamiento termodinámico temporal (secuencial).
- **Input:** Ventanas deslizantes de 30 ciclos de las señales termodinámicas de los sensores (Matriz 30x12).
- **Output:** Ciclos restantes estimados de vida útil.
