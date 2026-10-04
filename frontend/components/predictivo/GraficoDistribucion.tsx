'use client';

import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { VentaRaw } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface GraficoDistribucionProps {
  datos: VentaRaw[];
}

const COLORES = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export function GraficoDistribucion({ datos }: GraficoDistribucionProps) {
  const [vista, setVista] = useState<'categoria' | 'producto'>('categoria');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('TODAS');

  // Listado de categorías disponibles
  const categorias = useMemo(() => {
    if (!datos || datos.length === 0) return ['TODAS'];
    const setCats = new Set<string>();
    datos.forEach((d) => {
      if (d.categoria) setCats.add(d.categoria);
    });
    return ['TODAS', ...Array.from(setCats)];
  }, [datos]);

  // Agrupación de datos dinámica según el modo y el filtro activo
  const datosPie = useMemo(() => {
    if (!datos || datos.length === 0) return [];

    const mapa: Record<string, number> = {};

    // Filtrar por categoría si no se seleccionaron 'TODAS'
    const datosFiltrados =
      categoriaSeleccionada === 'TODAS'
        ? datos
        : datos.filter((d) => d.categoria === categoriaSeleccionada);

    datosFiltrados.forEach((d) => {
      const clave =
        vista === 'categoria' ? d.categoria || 'Sin Categoría' : d.producto;
      mapa[clave] = (mapa[clave] || 0) + d.cantidad;
    });

    return Object.entries(mapa).map(([name, value]) => ({ name, value }));
  }, [datos, vista, categoriaSeleccionada]);

  if (!datos || datos.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <CardTitle>
            {vista === 'categoria'
              ? 'Distribución por Categoría'
              : 'Distribución por Producto'}
          </CardTitle>
          <p className="text-xs text-gray-500">
            Participación en volumen total de unidades vendidas
          </p>
        </div>

        {/* CONTROLES Y FILTROS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Modo (Categoría vs Producto) */}
          <div className="bg-gray-100 p-1 rounded-lg flex items-center border border-gray-200">
            <button
              onClick={() => setVista('categoria')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                vista === 'categoria'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Categorías
            </button>
            <button
              onClick={() => setVista('producto')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                vista === 'producto'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Productos
            </button>
          </div>

          {/* Selector de Categoría (Visible solo al ver Productos) */}
          {vista === 'producto' && categorias.length > 1 && (
            <select
              value={categoriaSeleccionada}
              onChange={(e) => setCategoriaSeleccionada(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1 bg-white text-gray-700 focus:ring-2 focus:ring-blue-500"
            >
              {categorias.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'TODAS' ? 'Todas las categorías' : cat}
                </option>
              ))}
            </select>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {datosPie.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-xs text-gray-400">
            No hay datos disponibles para el filtro seleccionado.
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={datosPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                >
                  {datosPie.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORES[index % COLORES.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [
                    `${value.toLocaleString()} unidades`,
                    'Total Ventas',
                  ]}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}