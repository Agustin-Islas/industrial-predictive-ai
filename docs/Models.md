# 🧠 Modelos de Machine Learning

Detalle de los modelos implementados en el proyecto. Todos los modelos se encuentran en la carpeta `notebooks/` para experimentación y `models/` para producción.

## Autoencoder
- **Framework:** PyTorch
- **Propósito:** Detectar anomalías midiendo el error de reconstrucción de las señales de entrada.
- **Input:** Variables operativas normalizadas.
- **Output:** Score de anomalía.

## XGBoost + SHAP
- **Framework:** Scikit-Learn / XGBoost
- **Propósito:** Clasificar el tipo de falla inminente y proveer interpretabilidad.
- **Input:** Variables operativas y features derivadas (ej. delta_temp).
- **Output:** Probabilidades multiclase y valores SHAP.

## LSTM
- **Framework:** PyTorch
- **Propósito:** Predecir el Remaining Useful Life (RUL) utilizando series temporales.
- **Input:** Ventanas deslizantes de 30 ciclos de las señales de los sensores.
- **Output:** Ciclos restantes estimados.
