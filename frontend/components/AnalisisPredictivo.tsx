'use client';

import React, { useState } from 'react';
import { VentaRaw, PrediccionPunto, RecomendacionStock } from './predictivo/types';
import { IngestaVentas } from './predictivo/IngestaVentas';
import { MetricasResumen } from './predictivo/MetricasResumen';
import { TableroPredictivo } from './predictivo/TableroPredictivo';
import { GraficoDistribucion } from './predictivo/GraficoDistribucion';
import { ModuloReportes } from './predictivo/ModuloReportes';

type ModuloActivo = 'dashboard' | 'ingesta' | 'predictivo' | 'reportes';

export default function AnalisisPredictivo() {
  const [datosHistoricos, setDatosHistoricos] = useState<VentaRaw[]>([]);
  const [recomendaciones, setRecomendaciones] = useState<RecomendacionStock[]>([]);
  const [moduloActivo, setModuloActivo] = useState<ModuloActivo>('dashboard');

  const handleDatosCargados = (datos: VentaRaw[]) => {
    setDatosHistoricos(datos);
    setRecomendaciones([]);
  };

  const handlePrediccionCalculada = (prediccionesMap: Record<string, PrediccionPunto[]>) => {
    const nuevasRecomendaciones: RecomendacionStock[] = [];

    Object.entries(prediccionesMap).forEach(([producto, puntos]) => {
      if (puntos.length === 0) return;

      const demandaEstimada = puntos.reduce((acc, p) => acc + Math.max(0, p.yhat), 0);
      const ventasProd = datosHistoricos.filter((d) => d.producto === producto);
      const totalHistorico = ventasProd.reduce((acc, d) => acc + d.cantidad, 0);
      const stockReferencia = Math.round(totalHistorico / (ventasProd.length || 1)) * 30;

      const diferencia = demandaEstimada - stockReferencia;
      const porcentajeAjuste = stockReferencia > 0 ? Math.round((diferencia / stockReferencia) * 100) : 100;

      let sugerencia: 'INCREMENTAR' | 'REDUCIR' | 'MANTENER' = 'MANTENER';
      if (porcentajeAjuste > 5) sugerencia = 'INCREMENTAR';
      if (porcentajeAjuste < -5) sugerencia = 'REDUCIR';

      nuevasRecomendaciones.push({
        producto,
        stockActual: stockReferencia,
        demandaEstimada,
        sugerencia,
        porcentajeAjuste,
      });
    });

    setRecomendaciones(nuevasRecomendaciones);
  };

  return (
   <div className="min-h-screen bg-slate-100">
      {/* 1. BARRA LATERAL (SIDEBAR): Fija con fixed de tope a tope */}
      <aside className="fixed top-0 left-0 w-64 h-screen bg-slate-900 text-white flex flex-col justify-between p-4 shadow-xl shrink-0 z-50 print:hidden">
        <div>
          <div className="flex items-center gap-3 px-2 py-3 border-b border-slate-800 mb-5">
            <div className="bg-blue-600 p-2 rounded-lg text-white font-bold text-lg">🐤</div>
            <div>
              <h2 className="font-bold text-sm leading-tight">Inventario Villarrica</h2>
              <p className="text-[11px] text-slate-400">Sistema Predictivo</p>
            </div>
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => setModuloActivo('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                moduloActivo === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => setModuloActivo('ingesta')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                moduloActivo === 'ingesta'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Carga de Archivos
            </button>

            <button
              onClick={() => setModuloActivo('predictivo')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                moduloActivo === 'predictivo'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Proyección
            </button>

            <button
              onClick={() => setModuloActivo('reportes')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                moduloActivo === 'reportes'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              Reportes
            </button>
          </nav>
        </div>

        <div className="pt-3 border-t border-slate-800 text-xs text-slate-400">
          <p className="font-semibold text-slate-300">Estado del Sistema</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2 h-2 rounded-full ${datosHistoricos.length > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{datosHistoricos.length > 0 ? `${datosHistoricos.length} filas activas` : 'Sin datos cargados'}</span>
          </div>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL: */}
    
      <main className="pl-64 p-6 space-y-6 min-h-screen">
        <header className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {moduloActivo === 'dashboard' && 'Panel General de Control'}
              {moduloActivo === 'ingesta' && 'Carga e Ingesta de Ventas'}
              {moduloActivo === 'predictivo' && 'Análisis Predictivo de Demanda'}
              {moduloActivo === 'reportes' && 'Generación de Reportes'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Sistema Inteligente de Gestión de Inventarios</p>
          </div>

          {datosHistoricos.length > 0 && (
            <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-blue-200">
              Datos Activos: {datosHistoricos.length} filas
            </span>
          )}
        </header>

        {/* CONTENIDO PRINCIPAL */}
        {moduloActivo === 'ingesta' && (
          <IngestaVentas onDatosCargados={handleDatosCargados} />
        )}

        {datosHistoricos.length === 0 && moduloActivo !== 'ingesta' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-6 rounded-xl text-center text-sm space-y-3">
            <p className="font-semibold">No hay datos de ventas cargados en el sistema.</p>
            <button
              onClick={() => setModuloActivo('ingesta')}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700"
            >
              Ir a Carga de Ventas
            </button>
          </div>
        )}

        {datosHistoricos.length > 0 && (
          <div className="space-y-6">
            {moduloActivo === 'dashboard' && (
              <>
                <MetricasResumen datos={datosHistoricos} />
                <GraficoDistribucion datos={datosHistoricos} />
              </>
            )}

            {moduloActivo === 'predictivo' && (
              <TableroPredictivo
                datos={datosHistoricos}
                onPrediccionCalculada={handlePrediccionCalculada}
              />
            )}

            {moduloActivo === 'reportes' && (
              <ModuloReportes
                datos={datosHistoricos}
                recomendaciones={recomendaciones}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}