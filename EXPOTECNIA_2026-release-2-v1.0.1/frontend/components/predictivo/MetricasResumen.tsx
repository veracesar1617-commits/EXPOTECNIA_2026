'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';import { VentaRaw, PicoVenta } from './types';
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

  const [mostrarCategorias, setMostrarCategorias] = useState(false);

  if (!datos || datos.length === 0) return null;

  return (
    <div className="space-y-4">

  {/* FILTRO DE CATEGORÍAS */}
  <div className="flex items-center gap-3 pb-1">

    <span className="text-detalle font-semibold text-pizarra uppercase tracking-wider shrink-0">
      Categoría:
    </span>

    {/* BOTÓN TODAS */}
    <button
      onClick={() => {
        setCategoriaSeleccionada('TODAS');
        setMostrarCategorias(false);
      }}
      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all shrink-0 ${
        categoriaSeleccionada === 'TODAS'
          ? 'bg-naranja text-carbon'
          : 'bg-niebla text-carbon hover:bg-plata/40'
      }`}
    >
      TODAS
    </button>

    {/* DESPLEGABLE */}
    <div className="relative">

      <button
        onClick={() => setMostrarCategorias(!mostrarCategorias)}
        aria-expanded={mostrarCategorias}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
          categoriaSeleccionada !== 'TODAS'
            ? 'bg-naranja text-carbon'
            : 'bg-niebla text-carbon hover:bg-plata/40'
        }`}
      >
        {categoriaSeleccionada !== 'TODAS'
          ? categoriaSeleccionada
          : 'Categorías'}

        <svg
          className={`w-4 h-4 transition-transform ${
            mostrarCategorias ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="m19 9-7 7-7-7"
          />
        </svg>
      </button>

      {/* OPCIONES DEL FILTRO */}
      {mostrarCategorias && (
        <div className="absolute top-full left-0 mt-2 w-64 max-h-64 overflow-y-auto rounded-xl bg-white border border-niebla shadow-lg z-50 p-2">

          {categorias
            .filter((cat) => cat !== 'TODAS')
            .map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategoriaSeleccionada(cat);
                  setMostrarCategorias(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  categoriaSeleccionada === cat
                    ? 'bg-naranja text-carbon font-semibold'
                    : 'text-carbon hover:bg-niebla'
                }`}
              >
                {cat}
              </button>
            ))}

        </div>
      )}

    </div>
  </div>


  {/* TARJETAS DE KPIS PRINCIPALES */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

    {/* KPI 1: TOTAL REGISTROS */}
    <Card className="bg-gradient-to-br from-naranja to-naranja-600 text-white border-0">
      <CardContent className="pt-6 min-h-[145px] flex flex-col items-center justify-center text-center">

        <p className="text-detalle font-medium text-pizarra">
          Registros Cargados
        </p>

        <p className="mt-1 text-cifra tabular-nums text-carbon">
          {datosFiltrados.length.toLocaleString('es-PY')}
        </p>

        {categoriaSeleccionada !== 'TODAS' && (
          <p className="mt-1 text-detalle text-pizarra">
            Filtrado por: {categoriaSeleccionada}
          </p>
        )}

      </CardContent>
    </Card>


    {/* KPI 2: TOTAL UNIDADES */}
    <Card className="bg-gradient-to-br from-naranja to-naranja-600 text-white border-0">
      <CardContent className="pt-6 min-h-[145px] flex flex-col items-center justify-center text-center">

        <p className="text-detalle font-medium text-pizarra">
          Total Unidades Vendidas
        </p>

        <p className="mt-1 text-cifra tabular-nums text-carbon">
          {totalVentas.toLocaleString('es-PY')}
        </p>

        {categoriaSeleccionada !== 'TODAS' && (
          <p className="mt-1 text-detalle text-pizarra">
            Filtrado por: {categoriaSeleccionada}
          </p>
        )}

      </CardContent>
    </Card>


    {/* KPI 3: PRODUCTO ESTRELLA */}
    <Card className="bg-gradient-to-br from-naranja to-naranja-600 text-white border-0">
      <CardContent className="pt-6 min-h-[145px] flex items-center justify-between gap-4">

        {/* INFORMACIÓN */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">

          <p className="text-detalle font-medium text-pizarra">
            Producto Más Vendido
          </p>

          <p className="mt-1 text-cifra tabular-nums text-carbon truncate">
            {productoEstrella}
          </p>

          {categoriaSeleccionada !== 'TODAS' && (
            <p className="mt-1 text-detalle text-pizarra">
              Líder en {categoriaSeleccionada}
            </p>
          )}

        </div>

        {/* IMAGEN DEL PRODUCTO */}
        <div className="relative w-28 h-34 shrink-0">

          <Image
            src="/QuackyMoney.png"
            alt={`Producto estrella: ${productoEstrella}`}
            fill
            sizes="112px"
            className="object-cover"
          />

        </div>

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
                className="p-3 rounded-lg bg-niebla/40 border border-niebla flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-carbon text-detalle">{pico.producto}</p>
                  <p className="text-detalle text-pizarra">Fecha: {pico.fechaPico}</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-detalle font-semibold bg-niebla text-carbon tabular-nums">
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