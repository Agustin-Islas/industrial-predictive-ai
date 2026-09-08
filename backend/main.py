"""
Plataforma de Mantenimiento Predictivo Industrial — Backend API
================================================================
FastAPI server que expone los 3 modelos de ML como endpoints REST.
"""

import os
import numpy as np
import pandas as pd
import joblib
import torch
import torch.nn as nn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import asyncio
import json

# ─────────────────────────────────────────────
# Modelos PyTorch (definiciones de arquitectura)
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
# Carga de modelos y artefactos
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

# Features del XGBoost (sin corchetes, como se entreno)
XGB_FEATURES = ['Air temperature K', 'Process temperature K', 'Rotational speed rpm',
                'Torque Nm', 'Tool wear min', 'delta_temp', 'power_kw', 'wear_torque']


# ─────────────────────────────────────────────
# Schemas (Pydantic)
# ─────────────────────────────────────────────

class SensorReading(BaseModel):
    air_temperature: float = Field(..., description="Temperatura ambiente (K)")
    process_temperature: float = Field(..., description="Temperatura de proceso (K)")
    rotational_speed: float = Field(..., description="Velocidad rotacional (RPM)")
    torque: float = Field(..., description="Torque (Nm)")
    tool_wear: float = Field(..., description="Desgaste de herramienta (min)")


class RULSequence(BaseModel):
    """Secuencia temporal de lecturas de sensores para prediccion de RUL."""
    sequence: List[List[float]] = Field(..., description="Matriz de 30 lecturas x 12 sensores")


class ClassificationResponse(BaseModel):
    predicted_class: int
    predicted_label: str
    probabilities: dict
    shap_explanation: dict


class AnomalyResponse(BaseModel):
    reconstruction_error: float
    threshold: float
    is_anomaly: bool
    severity: str


class RULResponse(BaseModel):
    predicted_rul: float
    risk_level: str


class FullPredictionResponse(BaseModel):
    classification: ClassificationResponse
    anomaly: AnomalyResponse
    timestamp: str


# ─────────────────────────────────────────────
# Funciones auxiliares
# ─────────────────────────────────────────────

def _prepare_features(reading: SensorReading) -> np.ndarray:
    """Calcula las features derivadas a partir de una lectura de sensores."""
    delta_temp = reading.process_temperature - reading.air_temperature
    power_kw = (reading.torque * reading.rotational_speed) / 9549
    wear_torque = reading.tool_wear * reading.torque
    return np.array([[
        reading.air_temperature, reading.process_temperature,
        reading.rotational_speed, reading.torque, reading.tool_wear,
        delta_temp, power_kw, wear_torque
    ]])


def _classify(features: np.ndarray) -> ClassificationResponse:
    """Ejecuta el clasificador XGBoost + SHAP."""
    df = pd.DataFrame(features, columns=XGB_FEATURES)
    pred_class = int(xgb_model.predict(df)[0])
    pred_proba = xgb_model.predict_proba(df)[0]

    # SHAP values
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


def _detect_anomaly(features: np.ndarray) -> AnomalyResponse:
    """Ejecuta el autoencoder para deteccion de anomalias."""
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
    """Ejecuta la LSTM para prediccion de RUL."""
    tensor = torch.FloatTensor(sequence).unsqueeze(0)

    with torch.no_grad():
        rul = float(lstm_model(tensor).item())

    rul = max(0, rul)  # RUL no puede ser negativo

    if rul > 80:
        risk = "low"
    elif rul > 40:
        risk = "medium"
    elif rul > 15:
        risk = "high"
    else:
        risk = "critical"

    return RULResponse(predicted_rul=round(rul, 1), risk_level=risk)


# ─────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────

app = FastAPI(
    title="Plataforma de Mantenimiento Predictivo Industrial",
    description="API REST para prediccion de fallas, deteccion de anomalias y estimacion de vida util remanente (RUL) en equipos industriales.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Verifica que la API y los modelos esten cargados correctamente."""
    return {
        "status": "healthy",
        "models_loaded": {
            "xgboost": xgb_model is not None,
            "autoencoder": autoencoder is not None,
            "lstm": lstm_model is not None,
        },
        "anomaly_threshold": ANOMALY_THRESHOLD,
    }


@app.post("/predict/classify", response_model=ClassificationResponse)
def predict_classify(reading: SensorReading):
    """
    Clasifica una lectura de sensores en uno de 5 tipos de falla.
    Devuelve la prediccion, probabilidades por clase, y explicacion SHAP.
    """
    features = _prepare_features(reading)
    return _classify(features)


@app.post("/predict/anomaly", response_model=AnomalyResponse)
def predict_anomaly(reading: SensorReading):
    """
    Detecta si una lectura de sensores es anomala usando el Autoencoder.
    Devuelve el error de reconstruccion, el umbral, y la severidad.
    """
    features = _prepare_features(reading)
    return _detect_anomaly(features)


@app.post("/predict/rul", response_model=RULResponse)
def predict_rul(data: RULSequence):
    """
    Predice la Vida Util Remanente (RUL) a partir de una secuencia de 30 lecturas de sensores.
    """
    sequence = np.array(data.sequence)
    if sequence.shape != (30, len(useful_sensors)):
        return {"error": f"Se esperaba una matriz de (30, {len(useful_sensors)}), se recibio {sequence.shape}"}

    scaled = lstm_scaler.transform(sequence)
    return _predict_rul(scaled)


@app.post("/predict/full", response_model=FullPredictionResponse)
def predict_full(reading: SensorReading):
    """
    Ejecuta los 3 modelos (Clasificacion + Anomalia) sobre una unica lectura.
    Nota: RUL requiere una secuencia temporal y se debe llamar por separado.
    """
    from datetime import datetime

    features = _prepare_features(reading)
    classification = _classify(features)
    anomaly = _detect_anomaly(features)

    return FullPredictionResponse(
        classification=classification,
        anomaly=anomaly,
        timestamp=datetime.now().isoformat(),
    )


# ─────────────────────────────────────────────
# WebSocket (Streaming en Tiempo Real)
# ─────────────────────────────────────────────

@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """
    Conexion WebSocket para recibir predicciones en tiempo real.
    El cliente envia lecturas de sensores como JSON y recibe las predicciones al instante.
    """
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            reading_data = json.loads(data)
            reading = SensorReading(**reading_data)

            features = _prepare_features(reading)
            classification = _classify(features)
            anomaly = _detect_anomaly(features)

            from datetime import datetime
            response = {
                "classification": classification.model_dump(),
                "anomaly": anomaly.model_dump(),
                "timestamp": datetime.now().isoformat(),
            }

            await websocket.send_text(json.dumps(response))
    except WebSocketDisconnect:
        pass
