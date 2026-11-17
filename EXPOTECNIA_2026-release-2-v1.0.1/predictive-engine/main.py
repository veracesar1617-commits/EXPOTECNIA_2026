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
    stock_actual: Optional[float] = None
    categoria: Optional[str] = None
    precio_unitario: Optional[float] = None

class RequestPrediccion(BaseModel):
    producto: str
    historico: List[PuntoVenta]
    dias_futuros: Optional[int] = 30
    stock_actual: Optional[float] = None
    categoria: Optional[str] = None
    precio_unitario: Optional[float] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None

class RequestInforme(BaseModel):
    dias_futuros: Optional[int] = 30
    historico_global: List[Dict[str, Any]]  # Espera dicts con: fecha, producto, cantidad, categoria (opcional)
    inventario: Optional[List[ItemInventario]] = None
    producto_individual: Optional[str] = None  # Si viene definido, genera informe individual para este producto


# --- FUNCIÓN LÓGICA CORE DE PROCESAMIENTO ---

def _procesar_prediccion_producto(
    producto: str,
    historico: List[Dict[str, Any]],
    dias_futuros: int = 30,
    stock_actual: Optional[float] = None,
    categoria: Optional[str] = None,
    precio_unitario: Optional[float] = None,
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None
) -> Dict[str, Any]:
    # 1. Preparar DataFrame
    df = pd.DataFrame([
        {"ds": p["fecha"], "y": float(p["cantidad"])}
        for p in historico
    ])

    # Convertir las fechas y validar los registros
    df["ds"] = pd.to_datetime(
        df["ds"],
        dayfirst=True,
        errors="coerce"
    )

    if df["ds"].isna().any():
        raise HTTPException(
            status_code=400,
            detail=f"El histórico de '{producto}' contiene fechas inválidas."
        )

    df["ds"] = df["ds"].dt.normalize()

    # Agrupar todas las ventas del producto por día
    df_diario = (
        df.groupby("ds", as_index=False)["y"]
        .sum()
        .sort_values("ds")
    )

    # Validar la cantidad de días con ventas reales
    if len(df_diario) < 10:
        raise HTTPException(
            status_code=400,
            detail=f"El producto '{producto}' necesita al menos 10 días con ventas registradas para el análisis."
        )

    # Determinar el período completo de análisis
    try:
        inicio = (
            pd.to_datetime(fecha_inicio, errors="raise")
            if fecha_inicio
            else df_diario["ds"].min()
        )

        fin = (
            pd.to_datetime(fecha_fin, errors="raise")
            if fecha_fin
            else df_diario["ds"].max()
        )

    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Las fechas del período de análisis no son válidas."
        )

    inicio = inicio.normalize()
    fin = fin.normalize()

    if inicio > fin:
        raise HTTPException(
            status_code=400,
            detail="La fecha de inicio no puede ser posterior a la fecha final."
        )

    # Comprobar que no existan ventas fuera del período indicado
    if (
        (df_diario["ds"] < inicio).any()
        or (df_diario["ds"] > fin).any()
    ):
        raise HTTPException(
            status_code=400,
            detail=f"El histórico de '{producto}' contiene ventas fuera del período indicado."
        )

    # Crear el calendario completo, incluyendo días sin ventas
    calendario = pd.date_range(
        start=inicio,
        end=fin,
        freq="D"
    )

    df_diario = (
        df_diario
        .set_index("ds")
        .reindex(calendario, fill_value=0)
        .rename_axis("ds")
        .reset_index()
    )

    # Diagnóstico de la serie diaria preparada
    print(f"\n========== SERIE DIARIA DE {producto} ==========")
    print("Registros originales:", len(df))
    print("Días del período:", len(df_diario))
    print("Días con demanda:", (df_diario["y"] > 0).sum())
    print("Días sin demanda:", (df_diario["y"] == 0).sum())
    print("Ventas totales:", df_diario["y"].sum())
    print("Primera fecha:", df_diario["ds"].min())
    print("Última fecha:", df_diario["ds"].max())
    print("===============================================\n")


    # 2. Evaluación cronológica del modelo (80/20)
    total_dias = len(df_diario)
    indice_corte = int(total_dias * 0.8)

    df_entrenamiento = df_diario.iloc[:indice_corte]
    df_evaluacion = df_diario.iloc[indice_corte:]

    # Entrenar con el 80% inicial
    modelo_eval = Prophet(
        daily_seasonality=True,
        yearly_seasonality=False
    )
    modelo_eval.fit(df_entrenamiento)

    # Proyectar el 20% restante
    future_eval = modelo_eval.make_future_dataframe(
        periods=len(df_evaluacion),
        freq='D'
    )
    forecast_eval = modelo_eval.predict(future_eval)

    y_true = df_evaluacion['y'].values
    y_pred = np.maximum(
        0,
        forecast_eval.tail(len(df_evaluacion))['yhat'].values
    )

    # Calcular MAE
    mae = float(np.mean(np.abs(y_true - y_pred)))

    # Calcular MAPE únicamente en días con ventas reales
    non_zero_mask = y_true > 0

    if np.any(non_zero_mask):
        mape = float(
            np.mean(
                np.abs(
                    (y_true[non_zero_mask] - y_pred[non_zero_mask])
                    / y_true[non_zero_mask]
                )
            ) * 100
        )
    else:
        mape = 0.0

    # Calcular WAPE considerando todo el período evaluado
    total_ventas_reales = float(np.sum(y_true))

    if total_ventas_reales > 0:
        wape = float(
            np.sum(np.abs(y_true - y_pred))
            / total_ventas_reales * 100
        )
    else:
        wape = 0.0

    precision_pct = max(0.0, min(100.0, 100.0 - mape))

    # 3. Entrenamiento definitivo con todo el histórico
    model = Prophet(
        daily_seasonality=True,
        yearly_seasonality=False
    )
    model.fit(df_diario)



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

    historico_reciente = df_diario.tail(dias_futuros)['y'].values
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
            "wape": round(wape, 2),
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
    historico_dict = [
        {"fecha": p.fecha, "cantidad": p.cantidad}
        for p in req.historico
    ]

    print("\n========== DIAGNÓSTICO DE PREDICCIÓN INDIVIDUAL ==========")
    print("Producto recibido:", repr(req.producto))
    print("Cantidad de registros recibidos:", len(req.historico))
    print("Fecha inicial recibida:", req.fecha_inicio)
    print("Fecha final recibida:", req.fecha_fin)
    print("Primeros registros:", req.historico[:3])
    print("=========================================================\n")

    return _procesar_prediccion_producto(
        producto=req.producto,
        historico=historico_dict,
        dias_futuros=req.dias_futuros,
        stock_actual=req.stock_actual,
        categoria=req.categoria,
        precio_unitario=req.precio_unitario,
        fecha_inicio=req.fecha_inicio,
        fecha_fin=req.fecha_fin
    )


def _fmt_gs(valor: float) -> str:
    """Guaraníes con separador de miles por punto: 19574000 -> '19.574.000'."""
    return f"{int(round(valor)):,}".replace(",", ".")


def _fmt_dec(valor: float, decimales: int = 1) -> str:
    """Decimales con coma: 4.7 -> '4,7'."""
    return f"{valor:.{decimales}f}".replace(".", ",")


ORDEN_ESTADOS = {"COMPRAR": 0, "NO_COMPRAR": 1, "SIN_STOCK": 2, "HISTORIAL_INSUFICIENTE": 3}


@app.post("/reports/inventory-forecast")
def generar_informe_inventario(req: RequestInforme):
    df_global = pd.DataFrame(req.historico_global)
    print("\n========== DIAGNÓSTICO DE REGISTROS (INFORMES) ==========")
    print("Total de registros recibidos:", len(df_global))

    if df_global.empty:
        raise HTTPException(status_code=400, detail="El histórico global de ventas está vacío.")

    for col in ("fecha", "producto", "cantidad"):
        if col not in df_global.columns:
            raise HTTPException(status_code=400, detail=f"El histórico no contiene la columna obligatoria '{col}'.")

    # Normalizar nombres de producto (evita que 'Cookie ' y 'Cookie' sean productos distintos
    # o que no crucen con el inventario enviado por el frontend)
    df_global["producto"] = df_global["producto"].apply(lambda x: str(x).strip() if pd.notna(x) else x)

    # Asegurar columnas opcionales en el DataFrame global
    if "precio_compra" not in df_global.columns:
        df_global["precio_compra"] = None
    if "categoria" not in df_global.columns:
        df_global["categoria"] = "Sin categoría"

    # Asegurar que precio_compra sea numérico (evita errores al comparar None/texto con > 0)
    df_global["precio_compra"] = pd.to_numeric(df_global["precio_compra"], errors="coerce")

    # Ordenar cronológicamente para que el "último" precio sea realmente el más reciente
    df_global["_fecha"] = pd.to_datetime(df_global["fecha"], dayfirst=True, errors="coerce").dt.normalize()
    df_global = df_global.sort_values("_fecha", kind="stable")

    # Determinar si el informe es individual o global
    producto_individual = req.producto_individual.strip() if req.producto_individual else None
    if producto_individual:
        if producto_individual not in set(df_global["producto"].dropna()):
            raise HTTPException(status_code=400, detail=f"El producto '{producto_individual}' no existe en el histórico.")
        productos_a_procesar = [producto_individual]
        tipo_informe = "individual"
    else:
        productos_a_procesar = df_global["producto"].dropna().unique().tolist()
        tipo_informe = "global"

    horizonte = req.dias_futuros or 30

    detalles_informe = []
    productos_omitidos = []       # historial insuficiente o fallo de proyección
    productos_sin_stock = []      # proyectados, pero sin stock real (no se calcula cobertura ni pedido)
    productos_sin_precio = []     # sin precio válido (no entran en la inversión)
    productos_evaluados = 0       # proyectados CON stock real
    productos_en_riesgo = 0       # su stock no cubre la demanda del horizonte
    total_unidades_a_comprar = 0
    costo_total_estimado = 0.0
    hay_costo_calculable = False
    precisiones = []

    # Datos de inventario enviados por el frontend (stock real y precio confirmados por el usuario)
    inventario_dict = {item.producto.strip(): item for item in (req.inventario or [])}

    def _detalle_omitido(producto, categoria, stock, precio, dias, registros, mensaje):
        productos_omitidos.append(mensaje)
        detalles_informe.append({
            "producto": producto,
            "categoria": categoria,
            "stock_actual": stock,
            "demanda_proyectada": 0,
            "promedio_diario": 0.0,
            "cobertura_dias": None,
            "sugerencia_compra": 0,
            "precio_unitario": precio,
            "costo_estimado": None,
            "estado": "HISTORIAL_INSUFICIENTE",
            "mensaje": mensaje,
            "dias_con_ventas": dias,
            "registros": registros,
        })

    for producto in productos_a_procesar:
        df_prod = df_global[df_global["producto"] == producto].copy()

        # Contar DÍAS distintos con ventas (mismo criterio que usa el motor predictivo)
        dias_con_ventas = int(df_prod["_fecha"].dropna().nunique())
        print(f"Producto: {producto!r} | Registros: {len(df_prod)} | Días distintos: {dias_con_ventas}")

        item_inv = inventario_dict.get(producto)
        stock_real = item_inv.stock_actual if item_inv is not None else None  # None = falta el stock real
        cat_inv = str(df_prod["categoria"].iloc[0]) if not df_prod.empty else "Sin categoría"
        categoria_val = item_inv.categoria if (item_inv is not None and item_inv.categoria) else cat_inv

        # Precio unitario: el que confirmó el usuario en la tabla de inventario (precargado desde el CSV
        # pero editable) manda. Solo si el producto no vino en el inventario se usa el último precio válido del CSV.
        if item_inv is not None:
            precio = float(item_inv.precio_unitario) if (item_inv.precio_unitario and item_inv.precio_unitario > 0) else None
        else:
            df_con_precio = df_prod[df_prod["precio_compra"].notna() & (df_prod["precio_compra"] > 0)]
            precio = float(df_con_precio["precio_compra"].iloc[-1]) if not df_con_precio.empty else None

        # 1. Historial insuficiente: se reporta, no se descarta
        if df_prod.empty or dias_con_ventas < 10:
            _detalle_omitido(
                producto, categoria_val, stock_real, precio, dias_con_ventas, len(df_prod),
                f"El producto '{producto}' cuenta con {len(df_prod)} registros en {dias_con_ventas} días distintos. Se requieren al menos 10 días con ventas para proyectarlo."
            )
            continue

        historico_prod = df_prod[["fecha", "cantidad"]].to_dict(orient="records")

        # 2. Procesar predicción mediante el motor estacional Prophet (Intacto).
        #    Se pasa el stock REAL (o None si falta; nunca se inventa ni se asume 0).
        #    Un fallo en un producto no rompe el informe global.
        try:
            res_pred = _procesar_prediccion_producto(
                producto=producto,
                historico=historico_prod,
                dias_futuros=horizonte,
                stock_actual=stock_real,
                categoria=categoria_val,
                precio_unitario=precio,
            )
        except HTTPException as e:
            _detalle_omitido(
                producto, categoria_val or "Sin categoría", stock_real, precio,
                dias_con_ventas, len(df_prod),
                f"No se pudo proyectar '{producto}': {e.detail}"
            )
            continue

        rec = res_pred["recomendacion"]
        metricas = res_pred["metricas"]
        precisiones.append(metricas["precision_estimada"])

        if precio is None:
            productos_sin_precio.append(producto)

        if stock_real is None:
            # Sin stock real no hay cobertura, ni cantidad a comprar, ni estado de compra.
            productos_sin_stock.append(producto)
            estado = "SIN_STOCK"
            sugerencia_compra = 0
            cobertura = None
            costo_item = None
            mensaje = (
                f"Falta el stock real de '{producto}': se proyecta una demanda de "
                f"{rec['total_unidades_estimadas']} uds. en {horizonte} días, pero no se calcula cobertura ni pedido."
            )
        else:
            productos_evaluados += 1
            estado = rec["accion"]  # COMPRAR / NO_COMPRAR
            sugerencia_compra = rec["sugerencia_compra_neta"] or 0
            cobertura = res_pred["dias_cobertura"]
            mensaje = rec["mensaje"]

            if estado == "COMPRAR":
                productos_en_riesgo += 1
            total_unidades_a_comprar += sugerencia_compra

            # 3. Inversión estimada = Unidades sugeridas × Precio unitario (solo si hay precio válido)
            costo_item = None
            if precio is not None and precio > 0:
                costo_item = round(sugerencia_compra * precio, 2)
                costo_total_estimado += costo_item
                hay_costo_calculable = True

        detalle = {
            "producto": producto,
            "categoria": categoria_val or "Sin categoría",
            "stock_actual": stock_real,
            "demanda_proyectada": rec["total_unidades_estimadas"],
            "promedio_diario": rec["promedio_diario_estimado"],
            "cobertura_dias": cobertura,
            "sugerencia_compra": sugerencia_compra,
            "precio_unitario": precio,
            "costo_estimado": costo_item,
            "estado": estado,
            "mensaje": mensaje,
            "dias_con_ventas": dias_con_ventas,
            "registros": len(df_prod),
            "variacion_porcentual": rec["variacion_porcentual"],
            "metricas": metricas,
        }

        # Para el informe individual se adjunta la serie para el gráfico de demanda
        if tipo_informe == "individual":
            serie = (
                df_prod.dropna(subset=["_fecha"])
                .assign(_cant=pd.to_numeric(df_prod["cantidad"], errors="coerce").fillna(0))
                .groupby("_fecha")["_cant"].sum()
            )
            if not serie.empty:
                serie = serie.reindex(pd.date_range(serie.index.min(), serie.index.max(), freq="D"), fill_value=0)
            detalle["historico"] = [
                {"ds": d.strftime("%Y-%m-%d"), "y": float(v)} for d, v in serie.tail(60).items()
            ]
            detalle["forecast"] = res_pred["forecast"]

        detalles_informe.append(detalle)

    print("\n=======================================================\n")

    # Orden: primero los que hay que reponer (mayor pedido primero), luego suficientes,
    # luego los que faltan datos y al final los sin historial suficiente
    detalles_informe.sort(key=lambda x: (ORDEN_ESTADOS.get(x["estado"], 2), -x["sugerencia_compra"]))

    precision_promedio = round(float(np.mean(precisiones)), 1) if precisiones else 0.0
    inversion_total = round(costo_total_estimado, 2) if hay_costo_calculable else None

    # --- Resumen ejecutivo redactado automáticamente ---
    partes = []
    if productos_evaluados == 0:
        partes.append(
            "No se pudo evaluar la reposición de ningún producto: faltan datos de stock real o historial suficiente."
        )
    else:
        if productos_en_riesgo == 0:
            partes.append(
                f"Los {productos_evaluados} productos evaluados tienen stock suficiente para cubrir la demanda "
                f"proyectada de los próximos {horizonte} días. No se requiere realizar pedidos."
            )
        else:
            partes.append(
                f"{productos_en_riesgo} de {productos_evaluados} productos no cubren la demanda proyectada "
                f"para los próximos {horizonte} días."
            )
            if inversion_total is not None:
                partes.append(
                    f"Se recomienda ordenar {total_unidades_a_comprar:,} unidades".replace(",", ".")
                    + f" con una inversión estimada de Gs. {_fmt_gs(inversion_total)}."
                )
            else:
                partes.append(
                    f"Se recomienda ordenar {total_unidades_a_comprar:,} unidades".replace(",", ".")
                    + "; la inversión no se puede calcular porque falta el precio de los productos a reponer."
                )
            urgentes = sorted(
                [d for d in detalles_informe if d["estado"] == "COMPRAR" and d["cobertura_dias"] is not None],
                key=lambda d: d["cobertura_dias"],
            )[:2]
            if len(urgentes) == 1:
                partes.append(f"El más urgente es {urgentes[0]['producto']} ({_fmt_dec(urgentes[0]['cobertura_dias'])} días de cobertura).")
            elif len(urgentes) == 2:
                partes.append(
                    f"Los más urgentes son {urgentes[0]['producto']} ({_fmt_dec(urgentes[0]['cobertura_dias'])} días de cobertura) "
                    f"y {urgentes[1]['producto']} ({_fmt_dec(urgentes[1]['cobertura_dias'])} días)."
                )
            restantes = productos_evaluados - productos_en_riesgo
            if restantes == 1:
                partes.append("El producto restante tiene stock suficiente y no requiere pedido.")
            elif restantes > 1:
                partes.append(f"Los {restantes} productos restantes tienen stock suficiente y no requieren pedido.")

    excluidos = []
    if productos_sin_stock:
        excluidos.append(f"{len(productos_sin_stock)} sin stock real")
    if productos_omitidos:
        excluidos.append(f"{len(productos_omitidos)} sin historial suficiente")
    if excluidos:
        partes.append("No entran en los cálculos de pedido: " + " y ".join(excluidos) + ".")
    if productos_sin_precio:
        partes.append(
            f"{len(productos_sin_precio)} producto(s) sin precio unitario no se incluyen en la inversión estimada."
        )
    resumen_ejecutivo = " ".join(partes)

    observaciones = [
        f"Informe procesado sobre {productos_evaluados} producto(s) con stock real para una ventana proyectada de {horizonte} días.",
        f"Se identificaron {productos_en_riesgo} productos con riesgo de desabastecimiento.",
        f"Metodología: modelado estacional con Prophet. La precisión promedio del modelo es de {_fmt_dec(precision_promedio)} %.",
        "Stock, precios y categorías provienen de los datos ingresados antes de generar el informe.",
    ]
    if productos_sin_stock:
        observaciones.append(
            f"Sin stock real ({', '.join(productos_sin_stock)}): se muestra su demanda proyectada, pero no se calculó cobertura, pedido ni inversión."
        )
    if productos_sin_precio:
        observaciones.append(
            f"Sin precio unitario ({', '.join(productos_sin_precio)}): no se incluyen en la inversión estimada."
        )

    return {
        "tipo": tipo_informe,
        "producto_seleccionado": producto_individual,
        "resumen": {
            "fecha_generacion": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "horizonte_dias": horizonte,
            "meta_cobertura_dias": horizonte,
            "total_productos_detectados": len(productos_a_procesar),
            "total_productos_analizados": productos_evaluados,
            "total_productos_no_proyectados": len(productos_omitidos),
            "productos_requieren_compra": productos_en_riesgo,
            "total_unidades_sugeridas": total_unidades_a_comprar,
            "costo_estimado_inversion": inversion_total,
            "productos_sin_stock": productos_sin_stock,
            "productos_sin_precio": productos_sin_precio,
            "precision_promedio_modelo": precision_promedio,
            "resumen_ejecutivo": resumen_ejecutivo,
        },
        "detalles": detalles_informe,
        "observaciones": observaciones,
    }
