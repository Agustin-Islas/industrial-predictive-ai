#  Datasets Utilizados

El proyecto utiliza dos datasets complementarios para entrenar las distintas capas de la [[Architecture]].

## 1. AI4I 2020 Predictive Maintenance
- **Fuente:** UCI Machine Learning Repository / Kaggle
- **Propósito:** Entrenar el Autoencoder y el clasificador XGBoost.
- **Características:** 10,000 registros, variables de temperatura, RPM, torque y desgaste. Contiene 5 tipos de fallas.

## 2. NASA C-MAPSS (FD001)
- **Fuente:** NASA Ames Prognostics Data Repository
- **Propósito:** Entrenar la red LSTM para predecir el Remaining Useful Life (RUL).
- **Características:** Series temporales multivariadas de degradación de motores turbofan (run-to-failure).
