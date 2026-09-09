import os
import numpy as np
import pandas as pd
import joblib
import torch
import torch.nn as nn
import asyncio

from .schemas import ClassificationResponse, AnomalyResponse, RULResponse, SensorReading

# ─────────────────────────────────────────────
# Modelos PyTorch
# ─────────────────────────────────────────────

class Autoencoder(nn.Module):
    def __init__(self, input_dim=8):
        super(Autoencoder, self).__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 16), nn.ReLU(True),
            nn.Linear(16, 8), nn.ReLU(True),
            nn.Linear(8, 4)
        )
        self.decoder = nn.Sequential(
            nn.Linear(4, 8), nn.ReLU(True),
            nn.Linear(8, 16), nn.ReLU(True),
            nn.Linear(16, input_dim)
        )

    def forward(self, x):
        return self.decoder(self.encoder(x))

class RULPredictorLSTM(nn.Module):
    def __init__(self, input_dim, hidden_dim=64, num_layers=2):
        super(RULPredictorLSTM, self).__init__()
        self.lstm = nn.LSTM(input_dim, hidden_dim, num_layers, batch_first=True, dropout=0.2)
        self.fc1 = nn.Linear(hidden_dim, 32)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(32, 1)

    def forward(self, x):
        out, _ = self.lstm(x)
        out = out[:, -1, :]
        out = self.relu(self.fc1(out))
        out = self.fc2(out)
        return out


# ─────────────────────────────────────────────
# Inicialización de Modelos
# ─────────────────────────────────────────────

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")

# XGBoost + SHAP
xgb_model = joblib.load(os.path.join(MODELS_DIR, "xgboost_classifier.pkl"))
shap_explainer = joblib.load(os.path.join(MODELS_DIR, "shap_explainer.pkl"))

# Autoencoder
ae_scaler = joblib.load(os.path.join(MODELS_DIR, "scalers", "autoencoder_scaler.pkl"))
autoencoder = Autoencoder(input_dim=8)
autoencoder.load_state_dict(torch.load(os.path.join(MODELS_DIR, "autoencoder.pt"), weights_only=True))
autoencoder.eval()

with open(os.path.join(MODELS_DIR, "anomaly_threshold.txt"), "r") as f:
    ANOMALY_THRESHOLD = float(f.read().strip())

# LSTM
useful_sensors = joblib.load(os.path.join(MODELS_DIR, "useful_sensors_cmapss.pkl"))
lstm_scaler = joblib.load(os.path.join(MODELS_DIR, "scalers", "lstm_scaler.pkl"))
lstm_model = RULPredictorLSTM(input_dim=len(useful_sensors))
lstm_model.load_state_dict(torch.load(os.path.join(MODELS_DIR, "lstm_rul.pt"), weights_only=True))
lstm_model.eval()

FAILURE_LABELS = {0: "Normal", 1: "TWF (Desgaste)", 2: "HDF (Calor)", 3: "PWF (Potencia)", 4: "OSF (Sobreesfuerzo)"}
XGB_FEATURES = ['Air temperature K', 'Process temperature K', 'Rotational speed rpm',
                'Torque Nm', 'Tool wear min', 'delta_temp', 'power_kw', 'wear_torque']

# ─────────────────────────────────────────────
# Funciones de Inferencia
# ─────────────────────────────────────────────

def _prepare_features(reading: SensorReading) -> np.ndarray:
    delta_temp = reading.process_temperature - reading.air_temperature
    power_kw = (reading.torque * reading.rotational_speed) / 9549
    wear_torque = reading.tool_wear * reading.torque
    return np.array([[
        reading.air_temperature, reading.process_temperature,
        reading.rotational_speed, reading.torque, reading.tool_wear,
        delta_temp, power_kw, wear_torque
    ]])


def _classify_sync(features: np.ndarray) -> ClassificationResponse:
    df = pd.DataFrame(features, columns=XGB_FEATURES)
    pred_class = int(xgb_model.predict(df)[0])
    pred_proba = xgb_model.predict_proba(df)[0]

    # SHAP es muy costoso computacionalmente, por lo que debe ejecutarse
    # dentro de un thread si se llama asincrónicamente.
    shap_values = shap_explainer.shap_values(df)
    if isinstance(shap_values, list):
        sv = shap_values[pred_class][0]
    else:
        sv = shap_values[0, :, pred_class]

    explanation = {feat: round(float(val), 4) for feat, val in zip(XGB_FEATURES, sv)}

    return ClassificationResponse(
        predicted_class=pred_class,
        predicted_label=FAILURE_LABELS.get(pred_class, "Desconocido"),
        probabilities={FAILURE_LABELS[i]: round(float(p), 4) for i, p in enumerate(pred_proba)},
        shap_explanation=explanation,
    )

async def _classify(features: np.ndarray) -> ClassificationResponse:
    """Envuelve la ejecución sincrónica pesada (SHAP) en un thread."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _classify_sync, features)


def _detect_anomaly(features: np.ndarray) -> AnomalyResponse:
    scaled = ae_scaler.transform(features)
    tensor = torch.FloatTensor(scaled)

    with torch.no_grad():
        reconstruction = autoencoder(tensor)
        error = float(torch.mean((reconstruction - tensor) ** 2).item())

    is_anomaly = error > ANOMALY_THRESHOLD

    if error < ANOMALY_THRESHOLD * 0.5:
        severity = "normal"
    elif error < ANOMALY_THRESHOLD:
        severity = "watch"
    elif error < ANOMALY_THRESHOLD * 2:
        severity = "warning"
    else:
        severity = "critical"

    return AnomalyResponse(
        reconstruction_error=round(error, 6),
        threshold=round(ANOMALY_THRESHOLD, 6),
        is_anomaly=is_anomaly,
        severity=severity,
    )


def _predict_rul(sequence: np.ndarray) -> RULResponse:
    tensor = torch.FloatTensor(sequence).unsqueeze(0)

    with torch.no_grad():
        rul = float(lstm_model(tensor).item())

    rul = max(0, rul)

    if rul > 80:
        risk = "low"
    elif rul > 40:
        risk = "medium"
    elif rul > 15:
        risk = "high"
    else:
        risk = "critical"

    return RULResponse(predicted_rul=round(rul, 1), risk_level=risk)
