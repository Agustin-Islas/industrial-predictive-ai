FROM python:3.10-slim

WORKDIR /app

# Instalar dependencias del sistema requeridas para ML
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente y los modelos
COPY backend/ backend/
COPY models/ models/
COPY data/ data/

# Configurar el PYTHONPATH para que encuentre el módulo backend
ENV PYTHONPATH=/app

# Exponer el puerto 7860 (Estándar de Hugging Face Spaces)
EXPOSE 7860

# Configurar permisos para Hugging Face (requiere que el usuario no sea root en algunos entornos, 
# pero por defecto HF crea un usuario con UID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app
COPY --chown=user . $HOME/app/

# Iniciar la aplicación en el puerto 7860
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
