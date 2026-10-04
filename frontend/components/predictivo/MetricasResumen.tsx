'use client';

import React, { useState, useMemo } from 'react';
import { VentaRaw, PicoVenta } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

interface MetricasResumenProps {
  datos: VentaRaw[];
}

export function MetricasResumen({ datos }: MetricasResumenProps) {
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('TODAS');

  // 1. Obtener listado de categorías únicas presentes en los datos
  const categorias = useMemo(() => {
    if (!datos || datos.length === 0) return ['TODAS'];
    const setCats = new Set<string>();
    datos.forEach((d) => {
      if (d.categoria) setCats.add(d.categoria);
    });
    return ['TODAS', ...Array.from(setCats)];
  }, [datos]);

  // 2. Filtrar los registros según la categoría activa
  const datosFiltrados = useMemo(() => {
    if (!datos) return [];
    if (categoriaSeleccionada === 'TODAS') return datos;
    return datos.filter((d) => d.categoria === categoriaSeleccionada);
  }, [datos, categoriaSeleccionada]);

  // 3. Cálculos de KPIs y Picos sobre los datos filtrados
  const { totalVentas, productoEstrella, picosPorProducto } = useMemo(() => {
    if (!datosFiltrados || datosFiltrados.length === 0) {
      return { totalVentas: 0, productoEstrella: '-', picosPorProducto: [] };
    }

    let total = 0;
    const ventasPorProd: Record<string, number> = {};
    const picosMap: Record<string, { maxCantidad: number; fechaPico: string }> = {};

    datosFiltrados.forEach((item) => {
      total += item.cantidad;

      // Suma total por producto
      ventasPorProd[item.producto] = (ventasPorProd[item.producto] || 0) + item.cantidad;

      // Cálculo del pico de venta histórico
      if (!picosMap[item.producto] || item.cantidad > picosMap[item.producto].maxCantidad) {
        picosMap[item.producto] = {
          maxCantidad: item.cantidad,
          fechaPico: item.fecha,
        };
      }
    });

    // Encontrar producto estrella
    let maxProd = '-';
    let maxCant = -1;
    Object.entries(ventasPorProd).forEach(([prod, cant]) => {
      if (cant > maxCant) {
        maxCant = cant;
        maxProd = prod;
      }
    });

    // Formatear picos por producto
    const picosList: PicoVenta[] = Object.entries(picosMap).map(([producto, info]) => ({
      producto,
      maxCantidad: info.maxCantidad,
      fechaPico: info.fechaPico,
    }));

    return {
      totalVentas: total,
      productoEstrella: maxProd,
      picosPorProducto: picosList,
    };
  }, [datosFiltrados]);

  if (!datos || datos.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* BARRA DE FILTROS POR CATEGORÍA */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-2 shrink-0">
          Categoría:
        </span>
        {categorias.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoriaSeleccionada(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ${
              categoriaSeleccionada === cat
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* TARJETAS DE KPIS PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: Total Registros */}
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <CardContent className="pt-6">
            <p className="text-sm font-medium opacity-80">Registros Cargados</p>
            <p className="text-3xl font-bold mt-1">{datosFiltrados.length.toLocaleString()}</p>
            {categoriaSeleccionada !== 'TODAS' && (
              <p className="text-[11px] opacity-75 mt-1">Filtrado por: {categoriaSeleccionada}</p>
            )}
          </CardContent>
        </Card>

        {/* KPI 2: Total Unidades */}
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-0">
          <CardContent className="pt-6">
            <p className="text-sm font-medium opacity-80">Total Unidades Vendidas</p>
            <p className="text-3xl font-bold mt-1">{totalVentas.toLocaleString()}</p>
            {categoriaSeleccionada !== 'TODAS' && (
              <p className="text-[11px] opacity-75 mt-1">Filtrado por: {categoriaSeleccionada}</p>
            )}
          </CardContent>
        </Card>

        {/* KPI 3: Producto Estrella */}
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-0">
          <CardContent className="pt-6">
            <p className="text-sm font-medium opacity-80">Producto Más Vendido</p>
            <p className="text-2xl font-bold mt-1 truncate">{productoEstrella}</p>
            {categoriaSeleccionada !== 'TODAS' && (
              <p className="text-[11px] opacity-75 mt-1">Líder en {categoriaSeleccionada}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PICOS DE VENTA HISTÓRICOS */}
      <Card>
        <CardHeader>
          <CardTitle>Picos Históricos de Venta por Producto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {picosPorProducto.map((pico) => (
              <div
                key={pico.producto}
                className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{pico.producto}</p>
                  <p className="text-xs text-gray-500">Fecha: {pico.fechaPico}</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                  {pico.maxCantidad} uds
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}