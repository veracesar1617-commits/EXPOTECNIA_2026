// components/predictivo/VistaInformePDF.tsx
'use client';

import React from 'react';
import { RespuestaInforme } from './types';
import { Button } from '../ui/Buttons';

interface VistaInformePDFProps {
  informe: RespuestaInforme;
  onVolver?: () => void;
}

export function VistaInformePDF({ informe, onVolver }: VistaInformePDFProps) {
  const resumen = informe?.resumen || {
    fecha_generacion: new Date().toISOString().slice(0, 10),
    horizonte_dias: 30,
    total_productos_analizados: 0,
    productos_requieren_compra: 0,
    total_unidades_sugeridas: 0,
    precision_promedio_modelo: 0,
  };

  const detalles = informe?.detalles || [];
  const observaciones = informe?.observaciones || [];

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* BARRA DE HERRAMIENTAS SUPERIOR (Se oculta al imprimir) */}
      <div className="print:hidden flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Informe Generado Exitosamente</h2>
          <p className="text-xs text-gray-500">
            Puedes exportar este informe a PDF o imprimirlo directamente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onVolver && (
            <Button onClick={onVolver} className="bg-gray-100 hover:bg-gray-200 text-gray-700">
              ← Volver al Tablero
            </Button>
          )}
          <Button onClick={handleImprimir} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            Imprimir / Guardar en PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENTO PDF IMPRIMIBLE (Estilos adaptados para Print/Pantalla) */}
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-md print:shadow-none print:border-none print:p-0 max-w-5xl mx-auto text-gray-800">
        
        {/* 1. ENCABEZADO INSTITUCIONAL */}
        <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-indigo-950 uppercase tracking-wide">
              Informe Predictivo de Reorden
            </h1>
            <p className="text-sm font-semibold text-indigo-600">
              Departamento de Inventarios & Planificación de Demanda
            </p>
          </div>
          <div className="text-right text-xs text-gray-500 space-y-1">
            <p><strong className="text-gray-700">Fecha Generación:</strong> {resumen.fecha_generacion}</p>
            <p><strong className="text-gray-700">Horizonte Proyectado:</strong> {resumen.horizonte_dias} Días</p>
            <p><strong className="text-gray-700">Metodología:</strong> Machine Learning (Prophet)</p>
          </div>
        </div>

        {/* 2. TARJETAS DE RESUMEN EJECUTIVO (KPIs) - Reorganizado en 3 Columnas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-indigo-50/60 p-3.5 rounded-lg border border-indigo-100">
            <span className="text-[10px] uppercase font-bold text-indigo-800 block">Total Productos</span>
            <span className="text-xl font-black text-indigo-900">{resumen.total_productos_analizados} SKUs</span>
          </div>

          <div className="bg-red-50 p-3.5 rounded-lg border border-red-100">
            <span className="text-[10px] uppercase font-bold text-red-800 block">Requieren Compra</span>
            <span className="text-xl font-black text-red-700">{resumen.productos_requieren_compra} SKUs</span>
          </div>

          <div className="bg-blue-50 p-3.5 rounded-lg border border-blue-100">
            <span className="text-[10px] uppercase font-bold text-blue-800 block">Unidades Totales a Comprar</span>
            <span className="text-xl font-black text-blue-700">{(resumen.total_unidades_sugeridas || 0).toLocaleString()} Uds.</span>
          </div>
        </div>

        {/* 3. TABLA PRINCIPAL DE DIAGNÓSTICO */}
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-800 mb-2 uppercase tracking-wider border-l-4 border-indigo-600 pl-2">
            Detalle de Diagnóstico y Sugerencias de Pedido
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 uppercase">
                  <th className="p-2.5 font-bold">Producto</th>
                  <th className="p-2.5 font-bold">Categoría</th>
                  <th className="p-2.5 font-bold text-center">Stock Actual</th>
                  <th className="p-2.5 font-bold text-center">Demanda Est.</th>
                  <th className="p-2.5 font-bold text-center">Cobertura</th>
                  <th className="p-2.5 font-bold text-center">Pedido Sugerido</th>
                  <th className="p-2.5 font-bold text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {detalles.map((item, idx) => (
                  <tr key={idx} className={item.estado === 'COMPRAR' || item.sugerencia_compra > 0 ? 'bg-red-50/30' : ''}>
                    <td className="p-2.5 font-semibold text-gray-900">{item.producto}</td>
                    <td className="p-2.5 text-gray-500">{item.categoria || 'General'}</td>
                    <td className="p-2.5 text-center font-medium">{item.stock_actual} Uds.</td>
                    <td className="p-2.5 text-center font-medium">{Math.round(item.demanda_proyectada || 0)} Uds.</td>
                    <td className="p-2.5 text-center text-gray-600">{item.cobertura_dias} días</td>
                    <td className="p-2.5 text-center font-black text-indigo-700">
                      {item.sugerencia_compra > 0 ? `+${item.sugerencia_compra} Uds.` : '0 Uds.'}
                    </td>
                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.estado === 'COMPRAR' || item.sugerencia_compra > 0
                          ? 'bg-red-600 text-white' 
                          : item.estado === 'NO_COMPRAR' || item.estado === 'REDUCIR'
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.estado === 'COMPRAR' || item.sugerencia_compra > 0 
                          ? 'COMPRAR' 
                          : item.estado === 'NO_COMPRAR' || item.estado === 'REDUCIR'
                          ? 'SOBRESTOCK' 
                          : 'OPTIMO'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. OBSERVACIONES Y NOTAS */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h4 className="text-xs font-bold text-gray-700 uppercase mb-1">Notas Estratégicas y Observaciones</h4>
          <ul className="list-disc list-inside text-[11px] text-gray-600 space-y-1">
            {observaciones.map((obs, idx) => (
              <li key={idx}>{obs}</li>
            ))}
            <li>Precisión promedio del modelo estimada en un: <strong>{resumen.precision_promedio_modelo}%</strong>.</li>
          </ul>
        </div>

        {/* PIE DE PÁGINA FORMAL */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between items-center text-[10px] text-gray-400">
          <p>Sistema Predictivo de Inventario — Generado automáticamente</p>
          <p>Página 1 de 1</p>
        </div>
      </div>
    </div>
  );
}