export interface VentaRaw {
  fecha: string;
  producto: string;
  cantidad: number;
  categoria?: string;
  precio_compra?: number | null;
}

export interface PrediccionPunto {
  ds: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
}

export interface MetricasModelo {
  mape: number;
  mae: number;
  wape: number;
  precision_estimada: number;
}

export interface RecomendacionStock {
  producto: string;
  stock_actual?: number | null;
  stockActual?: number;
  total_unidades_estimadas?: number;
  demandaEstimada?: number;
  sugerencia_compra_neta?: number | null;
  unidades_ajuste?: number;
  promedio_diario_estimado?: number;
  variacion_porcentual?: number;
  accion?: 'AUMENTAR' | 'REDUCIR' | 'MANTENER' | 'COMPRAR' | 'NO_COMPRAR';
  sugerencia?: 'INCREMENTAR' | 'REDUCIR' | 'MANTENER' | 'COMPRAR' | 'NO_COMPRAR' | string;
  mensaje?: string;
  categoria?: string;
}

export function normalizarRecomendacion(raw: Partial<RecomendacionStock> | null | undefined): RecomendacionStock | null {
  if (!raw) return null;

  const accion = raw.accion ?? raw.sugerencia;
  const accionNormalizada =
    accion === 'COMPRAR' ? 'INCREMENTAR' :
    accion === 'AUMENTAR' ? 'INCREMENTAR' :
    accion === 'NO_COMPRAR' ? 'MANTENER' :
    accion === 'REDUCIR' ? 'REDUCIR' :
    accion === 'MANTENER' ? 'MANTENER' :
    raw.sugerencia ?? 'MANTENER';

  return {
    producto: raw.producto ?? '',
    stock_actual: raw.stock_actual ?? null,
    stockActual: raw.stockActual ?? raw.stock_actual ?? 0,
    total_unidades_estimadas: raw.total_unidades_estimadas ?? raw.demandaEstimada ?? 0,
    demandaEstimada: raw.demandaEstimada ?? raw.total_unidades_estimadas ?? 0,
    sugerencia_compra_neta: raw.sugerencia_compra_neta ?? null,
    unidades_ajuste: raw.unidades_ajuste ?? 0,
    promedio_diario_estimado: raw.promedio_diario_estimado ?? 0,
    variacion_porcentual: raw.variacion_porcentual ?? 0,
    accion: raw.accion ?? 'MANTENER',
    sugerencia: accionNormalizada,
    mensaje: raw.mensaje ?? '',
    categoria: raw.categoria,
  };
}

export interface RespuestaPrediccion {
  producto: string;
  dias_proyectados: number;
  metricas: MetricasModelo;
  recomendacion: RecomendacionStock;
  forecast: PrediccionPunto[];
}

export interface VentaAgrupada {
  fecha: string;
  [producto: string]: number | string;
}

export interface PicoVenta {
  producto: string;
  maxCantidad: number;
  fechaPico: string;
}

// --- INTERFACES PARA EL INFORME EJECUTIVO DE INVENTARIO ---

export interface ItemInventarioInput {
  producto: string;
  stock_actual: number;
  categoria?: string;
  precio_unitario?: number; // Opcional
}

export interface ResumenInforme {
  fecha_generacion: string;
  horizonte_dias: number;
  total_productos_analizados: number;
  productos_requieren_compra: number;
  total_unidades_sugeridas: number;
  costo_estimado_inversion?: number | null; // null = no calculable (falta stock o precio)
  precision_promedio_modelo: number;
  total_productos_detectados?: number;
  total_productos_no_proyectados?: number;
  meta_cobertura_dias?: number;
  productos_sin_stock?: string[];
  productos_sin_precio?: string[];
  resumen_ejecutivo?: string;
}

export interface DetalleItemInforme {
  producto: string;
  categoria: string;
  stock_actual: number;
  demanda_proyectada: number;
  promedio_diario: number;
  cobertura_dias: number;
  sugerencia_compra: number;
  precio_unitario?: number; // Opcional
  costo_estimado?: number;   // Opcional
  estado: 'AUMENTAR' | 'REDUCIR' | 'MANTENER' | 'COMPRAR' | 'NO_COMPRAR';
  mensaje: string;
}

export interface RespuestaInforme {
  tipo: 'individual' | 'global';
  producto_seleccionado?: string | null;
  resumen: ResumenInforme;
  detalles: DetalleInformeItem[];
  observaciones: string[];
}

export interface DetalleInformeItem {
  producto: string;
  categoria: string;
  stock_actual: number | null;
  demanda_proyectada: number;
  promedio_diario: number;
  cobertura_dias: number | null;
  sugerencia_compra: number;
  precio_unitario: number | null;
  costo_estimado: number | null;
  estado: string;
  mensaje: string;
  dias_con_ventas?: number;
  registros?: number;
  variacion_porcentual?: number | null;
  metricas?: MetricasModelo | null;
  historico?: { ds: string; y: number }[]; // solo informe individual
  forecast?: PrediccionPunto[];             // solo informe individual
}