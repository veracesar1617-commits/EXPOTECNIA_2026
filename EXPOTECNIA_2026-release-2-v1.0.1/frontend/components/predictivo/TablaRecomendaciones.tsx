'use client';

import React from 'react';
import { RecomendacionStock } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface TablaRecomendacionesProps {
  recomendaciones: RecomendacionStock[];
}

export function TablaRecomendaciones({ recomendaciones }: TablaRecomendacionesProps) {
  if (!recomendaciones || recomendaciones.length === 0) return null;

  const getBadgeStyle = (sugerencia: RecomendacionStock['sugerencia']) => {
    switch (sugerencia) {
      case 'INCREMENTAR':
        return 'bg-naranja text-carbon border-naranja-oscuro';
      case 'REDUCIR':
        return 'bg-durazno text-carbon border-naranja/40';
      default:
        return 'bg-niebla text-pizarra border-plata';
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Recomendaciones y Plan de Inventario</CardTitle>
        <p className="text-detalle text-pizarra">
          Sugerencias automáticas de ajuste de stock basadas en las proyecciones de demanda.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-detalle text-left text-carbon border-collapse">
            <thead className="text-detalle uppercase bg-niebla/40 text-pizarra border-b border-niebla">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3 text-right">Stock Actual</th>
                <th className="px-4 py-3 text-right">Demanda Estimada</th>
                <th className="px-4 py-3 text-center">Acción Sugerida</th>
                <th className="px-4 py-3 text-right">Ajuste (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-niebla">
              {recomendaciones.map((rec, index) => (
                <tr key={index} className="hover:bg-niebla/40 transition-colors">
                  <td className="px-4 py-3 font-semibold text-carbon">{rec.producto}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{rec.stockActual}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-naranja-oscuro">
                    {Math.round(rec.demandaEstimada)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-detalle font-semibold border ${getBadgeStyle(
                        rec.sugerencia
                      )}`}
                    >
                      {rec.sugerencia}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {rec.porcentajeAjuste > 0 ? `+${rec.porcentajeAjuste}%` : `${rec.porcentajeAjuste}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
