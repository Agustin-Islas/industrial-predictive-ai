from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class SensorReading(BaseModel):
    air_temperature: float = Field(..., description="Temperatura ambiente (K)")
    process_temperature: float = Field(..., description="Temperatura de proceso (K)")
    rotational_speed: float = Field(..., description="Velocidad rotacional (RPM)")
    torque: float = Field(..., description="Torque (Nm)")
    tool_wear: float = Field(..., description="Desgaste de herramienta (min)")

class RULSequence(BaseModel):
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

class WSPayloadMotor(BaseModel):
    reading: SensorReading

class WSPayloadTurbine(BaseModel):
    sequence: List[List[float]]

class WSMessage(BaseModel):
    asset_type: str = Field(..., description="Tipo de activo: 'MOTOR' o 'TURBINE'")
    data: dict
