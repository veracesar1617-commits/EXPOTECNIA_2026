from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from prophet import Prophet
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELOS DE ENTRADA ---

class PuntoVenta(BaseModel):
    fecha: str
    cantidad: float

class ItemInventario(BaseModel):
    producto: str
    stock_actual: float
    categoria: Optional[str] = None
    precio_unitario: Optional[float] = None

class RequestPrediccion(BaseModel):
    producto: str
    historico: List[PuntoVenta]
    dias_futuros: Optional[int] = 30
    stock_actual: Optional[float] = None
    categoria: Optional[str] = None
    precio_unitario: Optional[float] = None

class RequestInforme(BaseModel):
    dias_futuros: Optional[int] = 30
    historico_global: List[Dict[str, Any]]  # Espera dicts con: fecha, producto, cantidad, categoria (opcional)
    inventario: List[ItemInventario]        # Lista de productos con stock actual


# --- FUNCIÓN LÓGICA CORE DE PROCESAMIENTO ---

def _procesar_prediccion_producto(
    producto: str,
    historico: List[Dict[str, Any]],
    dias_futuros: int = 30,
    stock_actual: Optional[float] = None,
    categoria: Optional[str] = None,
    precio_unitario: Optional[float] = None
) -> Dict[str, Any]:
    if len(historico) < 10:
        raise HTTPException(
            status_code=400,
            detail=f"El producto '{producto}' necesita al menos 10 registros históricos para entrenar Prophet."
        )

    # 1. Preparar DataFrame
    df = pd.DataFrame([{"ds": p["fecha"], "y": float(p["cantidad"])} for p in historico])
    df['ds'] = pd.to_datetime(df['ds'])

    # 2. Entrenar Modelo Prophet
    model = Prophet(daily_seasonality=True, yearly_seasonality=False)
    model.fit(df)

    # 3. Métricas
    df_eval = model.predict(df[['ds']])
    y_true = df['y'].values
    y_pred = df_eval['yhat'].values

    non_zero_mask = y_true > 0
    if np.any(non_zero_mask):
        mape = float(np.mean(np.abs((y_true[non_zero_mask] - y_pred[non_zero_mask]) / y_true[non_zero_mask])) * 100)
    else:
        mape = 0.0

    mae = float(np.mean(np.abs(y_true - y_pred)))
    precision_pct = max(0.0, min(100.0, 100.0 - mape))

    # 4. Proyección Futura
    future = model.make_future_dataframe(periods=dias_futuros, freq='D')
    forecast = model.predict(future)

    proyeccion_futura = forecast.tail(dias_futuros)[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]

    predicciones = []
    total_demanda_proyectada = 0.0

    for _, row in proyeccion_futura.iterrows():
        val_yhat = max(0, round(float(row['yhat']), 2))
        total_demanda_proyectada += val_yhat
        predicciones.append({
            "ds": row['ds'].strftime('%Y-%m-%d'),
            "yhat": val_yhat,
            "yhat_lower": max(0, round(float(row['yhat_lower']), 2)),
            "yhat_upper": max(0, round(float(row['yhat_upper']), 2))
        })

    total_demanda_redondeada = round(total_demanda_proyectada)
    promedio_diario_proyectado = round(total_demanda_proyectada / dias_futuros, 1)

    historico_reciente = df.tail(dias_futuros)['y'].values
    total_historico = float(np.sum(historico_reciente)) if len(historico_reciente) > 0 else total_demanda_proyectada
    promedio_diario_historico = float(np.mean(historico_reciente)) if len(historico_reciente) > 0 else promedio_diario_proyectado

    diferencia_unidades = round(total_demanda_proyectada - total_historico)

    if promedio_diario_historico > 0:
        variacion_pct = round(((promedio_diario_proyectado - promedio_diario_historico) / promedio_diario_historico) * 100, 1)
    else:
        variacion_pct = 0.0

    # 5. Recomendación de Stock
    stock_actual_val = stock_actual if stock_actual is not None else None
    sugerencia_compra_neta = None
    dias_cobertura = 0.0

    if stock_actual_val is not None:
        sugerencia_compra_neta = max(0, round(total_demanda_redondeada - stock_actual_val))
        dias_cobertura = round(stock_actual_val / promedio_diario_proyectado, 1) if promedio_diario_proyectado > 0 else 0.0

        if stock_actual_val >= total_demanda_redondeada:
            accion = "NO_COMPRAR"
            exceso = round(stock_actual_val - total_demanda_redondeada)
            mensaje = f"Tienes {round(stock_actual_val)} Uds. en bodega, suficientes para cubrir la demanda estimada de {total_demanda_redondeada} Uds. en los próximos {dias_futuros} días (cobertura para ~{dias_cobertura} días). Se sugiere NO realizar nuevos pedidos (Superávit de {exceso} Uds.)."
        else:
            accion = "COMPRAR"
            mensaje = f"Tienes {round(stock_actual_val)} Uds. en bodega y se estima una demanda de {total_demanda_redondeada} Uds. Se recomienda realizar una orden de compra por {sugerencia_compra_neta} Uds. para cubrir los próximos {dias_futuros} días."
    else:
        if variacion_pct > 5.0:
            accion = "AUMENTAR"
            mensaje = f"Se detecta un aumento del {abs(variacion_pct)}% en la demanda de {producto}. Se sugiere aumentar las compras en +{abs(diferencia_unidades)} Uds. respecto al período anterior."
        elif variacion_pct < -5.0:
            accion = "REDUCIR"
            mensaje = f"Se estima una caída del {abs(variacion_pct)}% en la demanda de {producto}. Se sugiere reducir las compras en -{abs(diferencia_unidades)} Uds. respecto al período anterior."
        else:
            accion = "MANTENER"
            mensaje = f"La demanda de {producto} se mantiene estable (variación del {variacion_pct}%). Se sugiere mantener la compra habitual similar al período anterior."

    return {
        "producto": producto,
        "categoria": categoria,
        "precio_unitario": precio_unitario,
        "dias_proyectados": dias_futuros,
        "dias_cobertura": dias_cobertura,
        "metricas": {
            "mape": round(mape, 2),
            "mae": round(mae, 2),
            "precision_estimada": round(precision_pct, 1)
        },
        "recomendacion": {
            "producto": producto,
            "categoria": categoria,
            "stock_actual": round(stock_actual_val) if stock_actual_val is not None else None,
            "total_unidades_estimadas": total_demanda_redondeada,
            "sugerencia_compra_neta": sugerencia_compra_neta,
            "unidades_ajuste": diferencia_unidades,
            "promedio_diario_estimado": promedio_diario_proyectado,
            "variacion_porcentual": variacion_pct,
            "accion": accion,
            "mensaje": mensaje
        },
        "forecast": predicciones
    }


# --- ENDPOINTS ---

@app.post("/predict")
def predecir_demanda(req: RequestPrediccion):
    historico_dict = [{"fecha": p.fecha, "cantidad": p.cantidad} for p in req.historico]
    return _procesar_prediccion_producto(
        producto=req.producto,
        historico=historico_dict,
        dias_futuros=req.dias_futuros,
        stock_actual=req.stock_actual,
        categoria=req.categoria,
        precio_unitario=req.precio_unitario
    )


@app.post("/reports/inventory-forecast")
def generar_informe_inventario(req: RequestInforme):
    df_global = pd.DataFrame(req.historico_global)
    if df_global.empty:
        raise HTTPException(status_code=400, detail="El histórico global de ventas está vacío.")

    detalles_informe = []
    total_unidades_a_comprar = 0
    productos_en_riesgo = 0
    costo_total_estimado = 0.0
    precisiones = []

    for item in req.inventario:
        df_prod = df_global[df_global["producto"] == item.producto]
        if df_prod.empty or len(df_prod) < 10:
            continue

        historico_prod = df_prod.to_dict(orient="records")

        res_pred = _procesar_prediccion_producto(
            producto=item.producto,
            historico=historico_prod,
            dias_futuros=req.dias_futuros,
            stock_actual=item.stock_actual,
            categoria=item.categoria,
            precio_unitario=item.precio_unitario
        )

        rec = res_pred["recomendacion"]
        metricas = res_pred["metricas"]
        sugerencia_compra = rec["sugerencia_compra_neta"] or 0
        precio = item.precio_unitario or 0.0

        if rec["accion"] == "COMPRAR":
            productos_en_riesgo += 1

        total_unidades_a_comprar += sugerencia_compra
        costo_total_estimado += sugerencia_compra * precio
        precisiones.append(metricas["precision_estimada"])

        detalles_informe.append({
            "producto": item.producto,
            "categoria": item.categoria or "Sin categoría",
            "stock_actual": item.stock_actual,
            "demanda_proyectada": rec["total_unidades_estimadas"],
            "promedio_diario": rec["promedio_diario_estimado"],
            "cobertura_dias": res_pred["dias_cobertura"],
            "sugerencia_compra": sugerencia_compra,
            "precio_unitario": precio,
            "costo_estimado": round(sugerencia_compra * precio, 2),
            "estado": rec["accion"],
            "mensaje": rec["mensaje"]
        })

    # Priorizar en la lista los productos con urgencia de compra
    detalles_informe.sort(key=lambda x: (x["estado"] != "COMPRAR", -x["sugerencia_compra"]))

    precision_promedio = round(float(np.mean(precisiones)), 1) if precisiones else 0.0

    return {
        "resumen": {
            "fecha_generacion": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "horizonte_dias": req.dias_futuros,
            "total_productos_analizados": len(detalles_informe),
            "productos_requieren_compra": productos_en_riesgo,
            "total_unidades_sugeridas": total_unidades_a_comprar,
            "costo_estimado_inversion": round(costo_total_estimado, 2),
            "precision_promedio_modelo": precision_promedio
        },
        "detalles": detalles_informe,
        "observaciones": [
            f"Informe procesado sobre {len(detalles_informe)} SKUs para una ventana proyectada de {req.dias_futuros} días.",
            f"Se identificaron {productos_en_riesgo} productos con riesgo de desabastecimiento.",
            "Metodología aplicada: Modelado estacional con Facebook Prophet."
        ]
    }