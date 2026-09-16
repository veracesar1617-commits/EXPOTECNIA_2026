from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import pandas as pd
from prophet import Prophet

app = FastAPI(title="Motor Predictivo de Demanda")

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modelos de Pydantic para validar los datos que envía React
class VentaItem(BaseModel):
    fecha: str
    cantidad: float

class PredictionPayload(BaseModel):
    dias_proyeccion: int = 30
    historico: List[VentaItem]

@app.post("/predict")
def predict(payload: PredictionPayload):
    try:
        if len(payload.historico) < 5:
            raise HTTPException(status_code=400, detail="Se requieren al menos 5 registros históricos.")

        # Convertir a DataFrame de pandas
        data = [item.model_dump() for item in payload.historico]
        df = pd.DataFrame(data)

        # Renombrar columnas para Prophet
        df['fecha'] = pd.to_datetime(df['fecha'])
        df_prophet = df.rename(columns={'fecha': 'ds', 'cantidad': 'y'})

        # Crear y entrenar modelo Prophet
        model = Prophet(yearly_seasonality=False, weekly_seasonality=True, daily_seasonality=False)
        model.fit(df_prophet)

        # Proyectar días futuros
        future = model.make_future_dataframe(periods=payload.dias_proyeccion)
        forecast = model.predict(future)

        # Formatear la respuesta solo para el rango futuro
        forecast_future = forecast.tail(payload.dias_proyeccion)
        
        predicciones = []
        for _, row in forecast_future.iterrows():
            predicciones.append({
                "ds": row['ds'].strftime('%Y-%m-%d'),
                "yhat": round(max(0, float(row['yhat'])), 2),
                "yhat_lower": round(max(0, float(row['yhat_lower'])), 2),
                "yhat_upper": round(max(0, float(row['yhat_upper'])), 2)
            })

        return {
            "status": "success",
            "dias_proyectados": payload.dias_proyeccion,
            "predicciones": predicciones
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))