export interface VentaRaw {
  fecha: string;
  producto: string;
  cantidad: number;
  categoria?: string;
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
  costo_estimado_inversion?: number; // Opcional
  precision_promedio_modelo: number;
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
  resumen: ResumenInforme;
  detalles: DetalleItemInforme[];
  observaciones: string[];
}