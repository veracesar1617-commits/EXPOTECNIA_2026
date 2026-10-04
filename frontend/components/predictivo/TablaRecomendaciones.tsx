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
        return 'bg-green-100 text-green-800 border-green-200';
      case 'REDUCIR':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recomendaciones y Plan de Inventario</CardTitle>
        <p className="text-sm text-gray-500">
          Sugerencias automáticas de ajuste de stock basadas en las proyecciones de demanda.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700 border-collapse">
            <thead className="text-xs uppercase bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3 text-right">Stock Actual</th>
                <th className="px-4 py-3 text-right">Demanda Estimada</th>
                <th className="px-4 py-3 text-center">Acción Sugerida</th>
                <th className="px-4 py-3 text-right">Ajuste (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recomendaciones.map((rec, index) => (
                <tr key={index} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-900">{rec.producto}</td>
                  <td className="px-4 py-3 text-right font-mono">{rec.stockActual}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-600 font-semibold">
                    {Math.round(rec.demandaEstimada)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${getBadgeStyle(
                        rec.sugerencia
                      )}`}
                    >
                      {rec.sugerencia}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
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