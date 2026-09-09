"""
Plataforma de Mantenimiento Predictivo Industrial — Backend API
================================================================
FastAPI server que expone los 3 modelos de ML como endpoints REST.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import json
from datetime import datetime

from .schemas import (
    SensorReading, ClassificationResponse, AnomalyResponse, 
    RULResponse, FullPredictionResponse, RULSequence, WSMessage
)
from .ml_models import (
    _prepare_features, _classify, _detect_anomaly, _predict_rul,
    xgb_model, autoencoder, lstm_model, ANOMALY_THRESHOLD, useful_sensors, lstm_scaler
)

# ─────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────

app = FastAPI(
    title="Plataforma de Mantenimiento Predictivo Industrial",
    description="API REST para predicción de fallas, detección de anomalías y estimación de vida útil remanente (RUL) en equipos industriales.",
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
# Endpoints REST
# ─────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Verifica que la API y los modelos estén cargados correctamente."""
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
async def predict_classify(reading: SensorReading):
    features = _prepare_features(reading)
    return await _classify(features)


@app.post("/predict/anomaly", response_model=AnomalyResponse)
def predict_anomaly(reading: SensorReading):
    features = _prepare_features(reading)
    return _detect_anomaly(features)


@app.post("/predict/rul", response_model=RULResponse)
def predict_rul(data: RULSequence):
    sequence = np.array(data.sequence)
    if sequence.shape != (30, len(useful_sensors)):
        return {"error": f"Se esperaba una matriz de (30, {len(useful_sensors)}), se recibió {sequence.shape}"}

    scaled = lstm_scaler.transform(sequence)
    return _predict_rul(scaled)


@app.post("/predict/full", response_model=FullPredictionResponse)
async def predict_full(reading: SensorReading):
    features = _prepare_features(reading)
    classification = await _classify(features)
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
    Conexión WebSocket para recibir predicciones en tiempo real.
    Soporta múltiples tipos de activos: MOTOR y TURBINE.
    """
    await websocket.accept()
    try:
        while True:
            raw_data = await websocket.receive_text()
            data_dict = json.loads(raw_data)
            
            # El frontend envía un mensaje indicando el tipo de activo
            msg = WSMessage(**data_dict)
            
            response = {"timestamp": datetime.now().isoformat(), "asset_type": msg.asset_type}

            if msg.asset_type == "MOTOR":
                reading = SensorReading(**msg.data)
                features = _prepare_features(reading)
                # SHAP ya es asincrónico (no bloquea el loop)
                classification = await _classify(features)
                anomaly = _detect_anomaly(features)
                
                response["classification"] = classification.model_dump()
                response["anomaly"] = anomaly.model_dump()
                
            elif msg.asset_type == "TURBINE":
                sequence = np.array(msg.data.get("sequence", []))
                # Verificar shape
                if sequence.shape == (30, len(useful_sensors)):
                    scaled = lstm_scaler.transform(sequence)
                    rul = _predict_rul(scaled)
                    response["rul"] = rul.model_dump()
                else:
                    response["error"] = "Invalid sequence shape for TURBINE."

            await websocket.send_text(json.dumps(response))
            
    except WebSocketDisconnect:
        pass
