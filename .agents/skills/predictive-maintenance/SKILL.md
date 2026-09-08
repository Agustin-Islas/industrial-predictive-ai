---
name: predictive-maintenance
description: Assists with implementing the 3-layer predictive maintenance architecture.
---

# Predictive Maintenance Implementation Skill

When assisting the user with the Predictive Maintenance platform, refer to these instructions:

## Core Responsibilities
1. **Model Building:** Ensure adherence to the architecture (Autoencoder -> XGBoost -> LSTM).
2. **Data Handling:** Use pandas for preprocessing. Always apply Min-Max scaling for deep learning models.
3. **API Implementation:** Use FastAPI. Ensure the `/api/predict/full` endpoint aggregates all 3 layers.
4. **Dashboard:** Guide the user in building a Next.js dashboard with a dark, industrial theme. Ensure WebSockets are used for real-time updates.

## Common Tasks
- **Feature Engineering:** Create features like `delta_temp` (process_temp - air_temp), `power`, and `wear_torque_interaction`.
- **SHAP Integration:** Use the `shap` library to generate waterfall and summary plots. Convert SHAP values into natural language explanations.
- **RUL Calculation:** For the C-MAPSS dataset, define a piecewise linear RUL target (cap around 125-130 cycles).

## Reference
Check the project guidelines in `.agents/rules/project_guidelines.md` for overall standards.
