'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { VentaRaw, PrediccionPunto } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Buttons';
import { Loader } from '../ui/Loader';

interface MetricasModelo {
  mape: number;
  mae: number;
  precision_estimada: number;
}

interface RecomendacionStock {
  stock_actual?: number | null;
  total_unidades_estimadas: number;
  sugerencia_compra_neta?: number | null;
  unidades_ajuste: number;
  promedio_diario_estimado: number;
  variacion_porcentual: number;
  accion: 'AUMENTAR' | 'REDUCIR' | 'MANTENER' | 'COMPRAR' | 'NO_COMPRAR';
  mensaje: string;
}

interface TableroPredictivoProps {
  datos: VentaRaw[];
  onPrediccionCalculada?: (predicciones: Record<string, PrediccionPunto[]>) => void;
}

export function TableroPredictivo({ datos, onPrediccionCalculada }: TableroPredictivoProps) {
  const [productoSeleccionado, setProductoSeleccionado] = useState<string>('');
  const [diasHorizonte, setDiasHorizonte] = useState<number>(30);
  const [stockActualInput, setStockActualInput] = useState<string>('');
  const [cargandoPrediccion, setCargandoPrediccion] = useState(false);
  const [errorPrediccion, setErrorPrediccion] = useState<string | null>(null);

  const [predicciones, setPredicciones] = useState<PrediccionPunto[] | null>(null);
  const [metricasML, setMetricasML] = useState<MetricasModelo | null>(null);
  const [recomendacion, setRecomendacion] = useState<RecomendacionStock | null>(null);

  const productos = useMemo(() => {
    const setProds = new Set(datos.map((d) => d.producto));
    const lista = Array.from(setProds);
    if (lista.length > 0 && !productoSeleccionado) {
      setProductoSeleccionado(lista[0]);
    }
    return lista;
  }, [datos, productoSeleccionado]);

  const historicoCompleto = useMemo(() => {
    if (!productoSeleccionado) return [];
    const mapa: Record<string, number> = {};
    datos
      .filter((d) => d.producto === productoSeleccionado)
      .forEach((d) => {
        mapa[d.fecha] = (mapa[d.fecha] || 0) + d.cantidad;
      });

    return Object.entries(mapa)
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([fecha, cantidad]) => ({ ds: fecha, cantidad }));
  }, [datos, productoSeleccionado]);

  const generarPrediccion = async () => {
    if (!productoSeleccionado) return;

    setCargandoPrediccion(true);
    setErrorPrediccion(null);

    const ventasEnviar = historicoCompleto.map((h) => ({
      fecha: h.ds,
      cantidad: h.cantidad,
    }));

    const stockNumero = stockActualInput !== '' ? Number(stockActualInput) : null;

    try {
      const response = await fetch('http://127.0.0.1:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto: productoSeleccionado,
          historico: ventasEnviar,
          dias_futuros: diasHorizonte,
          stock_actual: stockNumero,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error en el servidor predictivo (Status: ${response.status})`);
      }

      const resData = await response.json();
      const rawForecast = resData.forecast || [];

      if (rawForecast.length === 0) {
        throw new Error('El modelo no devolvió proyecciones.');
      }

      const forecastFormateado: PrediccionPunto[] = rawForecast.map((p: any) => ({
        ds: String(p.ds).slice(0, 10),
        yhat: Math.max(0, p.yhat),
        yhat_lower: Math.max(0, p.yhat_lower),
        yhat_upper: Math.max(0, p.yhat_upper),
      }));

      setPredicciones(forecastFormateado);
      setMetricasML(resData.metricas || null);
      setRecomendacion(resData.recomendacion || null);

      if (onPrediccionCalculada) {
        onPrediccionCalculada({ [productoSeleccionado]: forecastFormateado });
      }
    } catch (err: any) {
      console.error('Error al generar predicción:', err);
      setErrorPrediccion(err.message || 'No se pudo conectar con el servidor de ML.');
    } finally {
      setCargandoPrediccion(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* PANEL DE CONTROL DE PARÁMETROS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h3 className="text-base font-semibold text-gray-800">Configuración del Pronóstico</h3>
          <p className="text-xs text-gray-500">
            Selecciona producto, horizonte e inventario en bodega para entrenar Prophet
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={productoSeleccionado}
            onChange={(e) => {
              setProductoSeleccionado(e.target.value);
              setPredicciones(null);
              setMetricasML(null);
              setRecomendacion(null);
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 focus:ring-2 focus:ring-blue-500"
          >
            {productos.map((prod) => (
              <option key={prod} value={prod}>
                {prod}
              </option>
            ))}
          </select>

          <select
            value={diasHorizonte}
            onChange={(e) => setDiasHorizonte(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>7 Días (Semanal)</option>
            <option value={15}>15 Días (Quincenal)</option>
            <option value={30}>30 Días (Mensual)</option>
            <option value={90}>90 Días (Trimestral)</option>
          </select>

          <div className="flex items-center gap-1 border border-gray-300 rounded-lg px-3 py-2 bg-white">
            <span className="text-xs text-gray-400 font-medium">Stock:</span>
            <input
              type="number"
              min="0"
              placeholder="Opcional"
              value={stockActualInput}
              onChange={(e) => setStockActualInput(e.target.value)}
              className="w-20 text-sm text-gray-800 outline-none bg-transparent"
            />
          </div>

          <Button onClick={generarPrediccion} disabled={cargandoPrediccion}>
            {cargandoPrediccion ? 'Calculando...' : 'Predecir Demanda'}
          </Button>
        </div>
      </div>

      {/* TARJETA DE MÉTRICAS ML */}
      {metricasML && (
        <Card className="border-indigo-200 bg-indigo-50/30">
          <CardHeader>
            <CardTitle className="text-indigo-900 text-sm flex items-center gap-2">
              Diagnóstico de Confiabilidad del Modelo (Prophet ML)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm text-center">
                <span className="text-xs text-gray-500 block">Precisión Estimada del Modelo</span>
                <span
                  className={`text-lg font-bold ${
                    metricasML.precision_estimada >= 80 ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {metricasML.precision_estimada}%
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm text-center">
                <span className="text-xs text-gray-500 block">MAPE (Error % Promedio)</span>
                <span className="text-lg font-bold text-gray-800">{metricasML.mape}%</span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm text-center">
                <span className="text-xs text-gray-500 block">MAE (Margen de Error Diario)</span>
                <span className="text-lg font-bold text-gray-800">±{metricasML.mae} Uds.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GRÁFICO PREDICTIVO */}
      <Card>
        <CardHeader>
          <CardTitle>Proyección  ({diasHorizonte} Días)</CardTitle>
        </CardHeader>
        <CardContent>
          {cargandoPrediccion && <Loader mensaje="Ajustando parámetros de Machine Learning..." />}
          {errorPrediccion && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg">{errorPrediccion}</div>
          )}

          {predicciones && predicciones.length > 0 && !cargandoPrediccion && (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={predicciones}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="ds" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="yhat_upper"
                    stroke="none"
                    fill="#93c5fd"
                    fillOpacity={0.4}
                    name="Límite Superior"
                  />
                  <Area
                    type="monotone"
                    dataKey="yhat_lower"
                    stroke="none"
                    fill="#ffffff"
                    fillOpacity={1}
                    name="Límite Inferior"
                  />
                  <Line
                    type="monotone"
                    dataKey="yhat"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 2 }}
                    name="Demanda Proyectada"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RECUADRO DE RECOMENDACIÓN EJECUTIVA */}
      {recomendacion && !cargandoPrediccion && (
        <Card className="border-l-4 border-l-blue-600 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-gray-800 font-bold">
                Recomendación Ejecutiva de Inventario
              </span>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  recomendacion.accion === 'COMPRAR'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : recomendacion.accion === 'NO_COMPRAR'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : recomendacion.accion === 'AUMENTAR'
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : recomendacion.accion === 'REDUCIR'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {recomendacion.accion === 'COMPRAR' && ' COMPRAR AHORA'}
                {recomendacion.accion === 'NO_COMPRAR' && ' NO COMPRAR (SOBRESTOCK)'}
                {recomendacion.accion === 'AUMENTAR' && ' AUMENTAR STOCK'}
                {recomendacion.accion === 'REDUCIR' && ' REDUCIR STOCK'}
                {recomendacion.accion === 'MANTENER' && 'MANTENER NIVEL ACTUAL'}
              </span>
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-1">
              <div className="lg:col-span-5 bg-gray-50 p-3.5 rounded-xl border border-gray-100 flex flex-col justify-center">
                <p className="text-xs text-gray-700 leading-relaxed font-medium">
                  {recomendacion.mensaje}
                </p>
                <p className="text-[11px] text-gray-400 mt-2">
                  *Cálculo para un horizonte de {diasHorizonte} días de operación.
                </p>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                {recomendacion.sugerencia_compra_neta !== undefined &&
                recomendacion.sugerencia_compra_neta !== null ? (
                  <div className="bg-blue-50/80 p-2.5 rounded-lg border border-blue-200 flex flex-col justify-center">
                    <span className="text-[10px] text-blue-800 uppercase tracking-wider block font-bold">
                      Pedido Sugerido
                    </span>
                    <span className="text-base font-black text-blue-700">
                      {recomendacion.sugerencia_compra_neta} Uds.
                    </span>
                    <span className="text-[10px] text-blue-600 block font-medium">
                      Compra neta requerida
                    </span>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex flex-col justify-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">
                      Ajuste vs Histórico
                    </span>
                    <span
                      className={`text-base font-bold ${
                        recomendacion.unidades_ajuste > 0
                          ? 'text-blue-600'
                          : recomendacion.unidades_ajuste < 0
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                      }`}
                    >
                      {recomendacion.unidades_ajuste > 0
                        ? `+${recomendacion.unidades_ajuste}`
                        : recomendacion.unidades_ajuste}{' '}
                      Uds.
                    </span>
                    <span className="text-[10px] text-gray-400 block">
                      {recomendacion.variacion_porcentual > 0
                        ? `+${recomendacion.variacion_porcentual}%`
                        : `${recomendacion.variacion_porcentual}%`}{' '}
                      vs. anterior
                    </span>
                  </div>
                )}

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex flex-col justify-center">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">
                    Demanda Estimada
                  </span>
                  <span className="text-base font-bold text-gray-800">
                    ~{recomendacion.total_unidades_estimadas.toLocaleString()} Uds.
                  </span>
                  <span className="text-[10px] text-gray-400 block">
                    En {diasHorizonte} días
                  </span>
                </div>

                {recomendacion.stock_actual !== undefined && recomendacion.stock_actual !== null ? (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex flex-col justify-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">
                      Stock en Bodega
                    </span>
                    <span className="text-base font-bold text-slate-700">
                      {recomendacion.stock_actual} Uds.
                    </span>
                    <span className="text-[10px] text-gray-400 block">
                      Disponible actualmente
                    </span>
                  </div>
                ) : (
                  <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 flex flex-col justify-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">
                      Ritmo Diario
                    </span>
                    <span className="text-base font-bold text-indigo-700">
                      {recomendacion.promedio_diario_estimado} Uds./día
                    </span>
                    <span className="text-[10px] text-gray-400 block">
                      Venta proyectada/día
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}