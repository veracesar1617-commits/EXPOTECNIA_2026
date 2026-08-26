from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import pandas as pd
from prophet import Prophet

app = FastAPI(
    title="Motor Predictivo de Demanda",
    description="Microservicio de Series Temporales con Prophet para Mipymes de Paraguay",
    version="1.0.0"
)

# Configuración de CORS para permitir peticiones desde el Frontend (Next.js)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permite peticiones desde cualquier origen en desarrollo
    allow_credentials=True,
    allow_methods=["*"],  # Permite GET, POST, OPTIONS, etc.
    allow_headers=["*"],
)

class RegistroVenta(BaseModel):
    fecha: str
    cantidad: float

class SolicitudPrediccion(BaseModel):
    dias_proyeccion: int = 30
    historico: List[RegistroVenta]

@app.get("/")
def home():
    return {"status": "online", "message": "Motor Predictivo FastAPI + Prophet Operativo"}

@app.post("/predict")
def generar_prediccion(data: SolicitudPrediccion):
    try:
        if len(data.historico) < 5:
            raise HTTPException(status_code=400, detail="Se requieren al menos 5 registros históricos.")

        # Convertir JSON entrante a DataFrame de Pandas
        df = pd.DataFrame([item.dict() for item in data.historico])
        df = df.rename(columns={"fecha": "ds", "cantidad": "y"})
        df['ds'] = pd.to_datetime(df['ds'])

        # Entrenar modelo Prophet
        model = Prophet(daily_seasonality=True, yearly_seasonality=False, weekly_seasonality=False)
        model.fit(df)

        # Generar fechas futuras
        future = model.make_future_dataframe(periods=data.dias_proyeccion)
        forecast = model.predict(future)

        # Filtrar solo el horizonte futuro proyectado
        resultado = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(data.dias_proyeccion)
        resultado['ds'] = resultado['ds'].dt.strftime('%Y-%m-%d')

        return {
            "status": "success",
            "dias_proyectados": data.dias_proyeccion,
            "predicciones": resultado.to_dict(orient="records")
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))