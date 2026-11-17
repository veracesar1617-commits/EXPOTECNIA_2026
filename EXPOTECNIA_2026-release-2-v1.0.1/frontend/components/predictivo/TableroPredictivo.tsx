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
  ReferenceLine,
} from 'recharts';
import { VentaRaw, PrediccionPunto } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Buttons';
import { Loader } from '../ui/Loader';
import { Aviso } from '../ui/Aviso';
import {
  COLOR_SERIE_PREDICCION,
  COLOR_SERIE_REAL,
  COLOR_BANDA_CONFIANZA,
  COLOR_FONDO_GRAFICO,
  COLOR_CUADRICULA,
  COLOR_EJES,
  ESTILO_TOOLTIP,
} from './paleta';

interface FilaGrafico {
  ds: string;
  real?: number;
  yhat?: number;
  yhat_lower?: number;
  yhat_upper?: number;
}

const fechaAISO = (fecha: string): string => {
  const valor = String(fecha ?? '').trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
    const [dia, mes, anio] = valor.split('/');
    return `${anio}-${mes}-${dia}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(valor)) return valor.slice(0, 10);
  return valor;
};

interface MetricasModelo {
  mape: number;
  mae: number;
  wape: number;
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

  return datos
    .filter((d) => d.producto === productoSeleccionado)
    .map((d) => ({
      ds: d.fecha,
      cantidad: d.cantidad,
    }))
    .sort((a, b) => {
      const convertirFecha = (fecha: string) => {
        const [dia, mes, anio] = fecha.split('/').map(Number);
        return new Date(anio, mes - 1, dia).getTime();
      };

      return convertirFecha(a.ds) - convertirFecha(b.ds);
    });
  }, [datos, productoSeleccionado]);
  
  const rangoFechas = useMemo(() => {
  if (datos.length === 0) return null;


  
  const convertirFecha = (fecha: string): Date | null => {
    const valor = fecha.trim();

    let dia: number;
    let mes: number;
    let anio: number;

    // Formato DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) {
      [dia, mes, anio] = valor.split('/').map(Number);
    }
    // Formato YYYY-MM-DD
    else if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      [anio, mes, dia] = valor.split('-').map(Number);
    } else {
      return null;
    }

    const fechaConvertida = new Date(anio, mes - 1, dia);

    // Comprobar que la fecha sea válida
    if (
      fechaConvertida.getFullYear() !== anio ||
      fechaConvertida.getMonth() !== mes - 1 ||
      fechaConvertida.getDate() !== dia
    ) {
      return null;
    }

    return fechaConvertida;
  };

  const fechasValidas = datos
    .map((d) => convertirFecha(d.fecha))
    .filter((fecha): fecha is Date => fecha !== null);

  if (fechasValidas.length === 0) return null;

  const fechaMinima = new Date(
    Math.min(...fechasValidas.map((f) => f.getTime()))
  );

  const fechaMaxima = new Date(
    Math.max(...fechasValidas.map((f) => f.getTime()))
  );

  const formatoISO = (fecha: Date) => {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
  };

  return {
    fechaInicio: formatoISO(fechaMinima),
    fechaFin: formatoISO(fechaMaxima),
  };
}, [datos]);

const datosGrafico = useMemo<FilaGrafico[]>(() => {
  if (!predicciones || predicciones.length === 0) return [];

  const filas = new Map<string, FilaGrafico>();

  historicoCompleto.forEach((h) => {
    const ds = fechaAISO(h.ds);
    const previa = filas.get(ds);
    filas.set(ds, { ds, real: (previa?.real ?? 0) + h.cantidad });
  });

  predicciones.forEach((p) => {
    filas.set(p.ds, { ...(filas.get(p.ds) ?? { ds: p.ds }), ...p });
  });

  return Array.from(filas.values()).sort((a, b) => a.ds.localeCompare(b.ds));
}, [historicoCompleto, predicciones]);

const ultimaFechaReal = useMemo(() => {
  if (historicoCompleto.length === 0) return null;
  return historicoCompleto.map((h) => fechaAISO(h.ds)).sort().pop() ?? null;
}, [historicoCompleto]);

  const generarPrediccion = async () => {
    if (!productoSeleccionado) return;

    setCargandoPrediccion(true);
    setErrorPrediccion(null);

    const ventasEnviar = historicoCompleto.map((h) => ({
      fecha: h.ds,
      cantidad: h.cantidad,
    }));

    if (!rangoFechas) {
  setErrorPrediccion(
    'No se pudo determinar el período de fechas del archivo histórico.'
  );
  setCargandoPrediccion(false);
  return;
}

    const stockNumero = stockActualInput !== '' ? Number(stockActualInput) : null;
    console.log('Período global:', rangoFechas);
    console.log('Producto seleccionado:', productoSeleccionado); // Agregado para depuración
    console.log('Registros del producto:', ventasEnviar.length);

    try {
      const response = await fetch('http://127.0.0.1:8000/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        producto: productoSeleccionado,
        historico: ventasEnviar,
        dias_futuros: diasHorizonte,
        stock_actual: stockNumero,
        fecha_inicio: rangoFechas.fechaInicio,
        fecha_fin: rangoFechas.fechaFin,
        }),
      });

      
      if (!response.ok) {
      let detalleServidor = '';

    try {
      const errorData = await response.json();

      if (typeof errorData.detail === 'string') {
      detalleServidor = errorData.detail;
      }
    } catch {
    // Si la respuesta no contiene JSON válido, usamos un mensaje general.
    }

    if (
      response.status === 400 &&
      detalleServidor.includes('necesita al menos 10 registros históricos')
    ) {
      throw new Error(
      'No es posible generar una proyección para este producto porque ' +
      'necesita al menos 10 registros históricos de ventas. ' +
      'Selecciona otro producto con suficientes registros o incorpora más datos.'
     );
  }

  throw new Error(
    `Error en el servidor predictivo (Status: ${response.status})`
  );
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-niebla shadow-sm">
        <div>
          <h3 className="font-display text-titulo-3 font-bold text-carbon">Configuración del Pronóstico</h3>
          <p className="text-detalle text-pizarra">
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
            className="border border-plata rounded-xl px-3 py-2 text-detalle bg-crema text-carbon focus:ring-2 focus:ring-naranja"
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
            className="border border-plata rounded-xl px-3 py-2 text-detalle bg-crema text-carbon focus:ring-2 focus:ring-naranja"
          >
            <option value={7}>7 Días (Semanal)</option>
            <option value={15}>15 Días (Quincenal)</option>
            <option value={30}>30 Días (Mensual)</option>
            <option value={90}>90 Días (Trimestral)</option>
          </select>

          <div className="flex items-center gap-1 border border-plata rounded-xl px-3 py-2 bg-crema">
            <span className="text-detalle text-pizarra font-medium">Stock:</span>
            <input
              type="number"
              min="0"
              placeholder="Opcional"
              value={stockActualInput}
              onChange={(e) => setStockActualInput(e.target.value)}
              className="w-20 text-detalle text-carbon outline-none bg-transparent"
            />
          </div>

          <Button onClick={generarPrediccion} disabled={cargandoPrediccion}>
            {cargandoPrediccion ? 'Calculando...' : 'Predecir Demanda'}
          </Button>
        </div>
      </div>

      
{/* TARJETA DE MÉTRICAS ML */}
{metricasML && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        Diagnóstico de Confiabilidad del Modelo (Prophet ML)
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        <div className="bg-niebla/40 p-3 rounded-xl text-center">
          <span className="text-detalle text-pizarra block">
            Precisión Estimada del Modelo
          </span>
          <span
            className={`text-titulo-3 font-semibold tabular-nums ${
              metricasML.precision_estimada >= 80
                ? 'text-carbon'
                : 'text-naranja-oscuro'
            }`}
          >
            {metricasML.precision_estimada}%
          </span>
        </div>

        {/* MAPE */}
        <div className="bg-niebla/40 p-3 rounded-xl text-center">
          <span className="text-detalle text-pizarra block">
            MAPE (Error % Promedio)
          </span>
          <span className="text-titulo-3 font-semibold tabular-nums text-carbon">
            {metricasML.mape}%
          </span>
        </div>

        {/* MAE */}
        <div className="bg-niebla/40 p-3 rounded-xl text-center">
          <span className="text-detalle text-pizarra block">
            MAE (Margen de Error Diario)
          </span>
          <span className="text-titulo-3 font-semibold tabular-nums text-carbon">
            ±{metricasML.mae} Uds.
          </span>
        </div>

        {/* WAPE */}
        <div className="bg-niebla/40 p-3 rounded-xl text-center">
          <span className="text-detalle text-pizarra block">
            WAPE (Error % Ponderado)
          </span>
          <span className="text-titulo-3 font-semibold tabular-nums text-carbon">
            {metricasML.wape}%
          </span>
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
            <Aviso>
              <p>{errorPrediccion}</p>
            </Aviso>
          )}

          {predicciones && predicciones.length > 0 && !cargandoPrediccion && (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={datosGrafico}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLOR_CUADRICULA} />
                  <XAxis dataKey="ds" tick={{ fontSize: 12, fill: COLOR_EJES }} stroke={COLOR_CUADRICULA} minTickGap={32} />
                  <YAxis tick={{ fontSize: 12, fill: COLOR_EJES }} stroke={COLOR_CUADRICULA} />
                  <Tooltip {...ESTILO_TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 12, color: COLOR_EJES }} />
                  <Area
                    type="monotone"
                    dataKey="yhat_upper"
                    stroke="none"
                    fill={COLOR_BANDA_CONFIANZA}
                    fillOpacity={1}
                    name="Límite Superior"
                  />
                  <Area
                    type="monotone"
                    dataKey="yhat_lower"
                    stroke="none"
                    fill={COLOR_FONDO_GRAFICO}
                    fillOpacity={1}
                    legendType="none"
                    name="Límite Inferior"
                  />
                  {ultimaFechaReal && (
                    <ReferenceLine
                      x={ultimaFechaReal}
                      stroke={COLOR_EJES}
                      strokeDasharray="3 3"
                      label={{ value: 'Último dato', position: 'top', fill: COLOR_EJES, fontSize: 12 }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="real"
                    stroke={COLOR_SERIE_REAL}
                    strokeWidth={2}
                    dot={false}
                    name="real" //Demanda Proyectada
                  />
                  <Line
                    type="monotone"
                    dataKey="yhat"
                    stroke={COLOR_SERIE_PREDICCION}
                    strokeWidth={2.5}
                    strokeDasharray="6 4"
                    dot={false}
                    name="Predicción"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RECUADRO DE RECOMENDACIÓN EJECUTIVA */}
      {recomendacion && !cargandoPrediccion && (
        <Card className="border-l-4 border-l-naranja">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-carbon font-semibold">
                Recomendación Ejecutiva de Inventario
              </span>

              <span
                className={`px-3 py-1 rounded-full font-sans text-detalle font-semibold ${
                  recomendacion.accion === 'COMPRAR'
                    ? 'bg-naranja text-carbon shadow-sm'
                    : recomendacion.accion === 'NO_COMPRAR'
                    ? 'bg-niebla text-carbon border border-plata'
                    : recomendacion.accion === 'AUMENTAR'
                    ? 'bg-durazno text-naranja-oscuro border border-naranja/40'
                    : recomendacion.accion === 'REDUCIR'
                    ? 'bg-durazno text-carbon border border-naranja/40'
                    : 'bg-niebla text-carbon border border-plata'
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
              <div className="lg:col-span-5 bg-niebla/40 p-3.5 rounded-xl border border-niebla flex flex-col justify-center">
                <p className="text-cuerpo text-carbon">
                  {recomendacion.mensaje}
                </p>
                <p className="text-detalle text-pizarra mt-2">
                  *Cálculo para un horizonte de {diasHorizonte} días de operación.
                </p>
              </div>

              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                {recomendacion.sugerencia_compra_neta !== undefined &&
                recomendacion.sugerencia_compra_neta !== null ? (
                  <div className="bg-durazno p-2.5 rounded-xl border border-naranja/40 flex flex-col justify-center">
                    <span className="text-detalle text-carbon uppercase tracking-wider block font-semibold">
                      Pedido Sugerido
                    </span>
                    <span className="text-titulo-3 font-semibold tabular-nums text-naranja-oscuro">
                      {recomendacion.sugerencia_compra_neta} Uds.
                    </span>
                    <span className="text-detalle text-pizarra block font-medium">
                      Compra neta requerida
                    </span>
                  </div>
                ) : (
                  <div className="bg-niebla/40 p-2.5 rounded-xl border border-niebla flex flex-col justify-center">
                    <span className="text-detalle text-pizarra uppercase tracking-wider block font-semibold">
                      Ajuste vs Histórico
                    </span>
                    <span
                      className={`text-titulo-3 font-semibold tabular-nums ${
                        recomendacion.unidades_ajuste > 0
                          ? 'text-carbon'
                          : recomendacion.unidades_ajuste < 0
                          ? 'text-naranja-oscuro'
                          : 'text-carbon'
                      }`}
                    >
                      {recomendacion.unidades_ajuste > 0
                        ? `+${recomendacion.unidades_ajuste}`
                        : recomendacion.unidades_ajuste}{' '}
                      Uds.
                    </span>
                    <span className="text-detalle text-pizarra block">
                      {recomendacion.variacion_porcentual > 0
                        ? `+${recomendacion.variacion_porcentual}%`
                        : `${recomendacion.variacion_porcentual}%`}{' '}
                      vs. anterior
                    </span>
                  </div>
                )}

                <div className="bg-niebla/40 p-2.5 rounded-xl border border-niebla flex flex-col justify-center">
                  <span className="text-detalle text-pizarra uppercase tracking-wider block font-semibold">
                    Demanda Estimada
                  </span>
                  <span className="text-titulo-3 font-semibold tabular-nums text-carbon">
                    ~{recomendacion.total_unidades_estimadas.toLocaleString()} Uds.
                  </span>
                  <span className="text-detalle text-pizarra block">
                    En {diasHorizonte} días
                  </span>
                </div>

                {recomendacion.stock_actual !== undefined && recomendacion.stock_actual !== null ? (
                  <div className="bg-niebla/40 p-2.5 rounded-xl border border-niebla flex flex-col justify-center">
                    <span className="text-detalle text-pizarra uppercase tracking-wider block font-semibold">
                      Stock en Bodega
                    </span>
                    <span className="text-titulo-3 font-semibold tabular-nums text-carbon">
                      {recomendacion.stock_actual} Uds.
                    </span>
                    <span className="text-detalle text-pizarra block">
                      Disponible actualmente
                    </span>
                  </div>
                ) : (
                  <div className="bg-niebla/40 p-2.5 rounded-xl border border-niebla flex flex-col justify-center">
                    <span className="text-detalle text-pizarra uppercase tracking-wider block font-semibold">
                      Ritmo Diario
                    </span>
                    <span className="text-titulo-3 font-semibold tabular-nums text-carbon">
                      {recomendacion.promedio_diario_estimado} Uds./día
                    </span>
                    <span className="text-detalle text-pizarra block">
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