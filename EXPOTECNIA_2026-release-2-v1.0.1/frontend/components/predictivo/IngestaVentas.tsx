'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { VentaRaw } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Aviso } from '../ui/Aviso';

interface IngestaVentasProps {
  onDatosCargados: (datos: VentaRaw[]) => void;
}

export function IngestaVentas({ onDatosCargados }: IngestaVentasProps) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<{ filas: number; productos: number } | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<VentaRaw[]>([]);
  const [arrastrando, setArrastrando] = useState(false);

  const procesarArchivo = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Selecciona un archivo CSV con extensión .csv.');
      return;
    }

    setCargando(true);
    setError(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            console.warn('Advertencias de parseo:', results.errors);
          }

          const datosFormateados: VentaRaw[] = results.data
            .map((row) => {
              const fecha = row.fecha || row.Fecha || row.date || row.Date || '';
              const producto = row.producto || row.Producto || row.product || row.Product || '';
              const cantidad = Number(row.cantidad || row.Cantidad || row.quantity || row.Quantity || 0);
              const precioRaw =
                row.precio_compra ||
                row.Precio_compra ||
                row['Precio de compra'] ||
                row['precio de compra'] ||
                '';

              const precioNumero = precioRaw.trim() !== ''
                ? Number(precioRaw)
                : null;

              const precioCompra =
                precioNumero !== null && Number.isFinite(precioNumero) && precioNumero > 0
                ? precioNumero
                : null;
              
              // Mapeo flexible de la nueva columna de Categoría
              const categoria =
                row.categoria ||
                row.Categoria ||
                row.category ||
                row.Category ||
                row.rubro ||
                row.Rubro ||
                'Sin Categoría';

              return {
                fecha: fecha.trim(),
                producto: producto.trim(),
                cantidad: isNaN(cantidad) ? 0 : cantidad,
                categoria: categoria.trim(),
                precio_compra: precioCompra,
              };
            })
            .filter((d) => d.fecha !== '' && d.producto !== '' && d.cantidad > 0);

          if (datosFormateados.length === 0) {
            setError('No se encontraron registros válidos. Revisa las columnas del CSV.');
            setCargando(false);
            return;
          }

          const productosUnicos = new Set(datosFormateados.map((d) => d.producto)).size;

          setResumen({
            filas: datosFormateados.length,
            productos: productosUnicos,
          });

          setVistaPrevia(datosFormateados.slice(0, 5));
          onDatosCargados(datosFormateados);
        } catch {
          setError('Ocurrió un error al procesar el archivo CSV.');
        } finally {
          setCargando(false);
        }
      },
      error: (err) => {
        setError(`Error al leer el archivo: ${err.message}`);
        setCargando(false);
      },
    });
  };

  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (file) procesarArchivo(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!cargando) setArrastrando(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setArrastrando(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastrando(false);
    if (cargando) return;

    const file = e.dataTransfer.files[0];
    if (file) procesarArchivo(file);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Carga de Ventas Históricas</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              arrastrando ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500'
            }`}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleArchivo}
              className="hidden"
              id="csvInput"
              disabled={cargando}
            />
            <label htmlFor="csvInput" className="cursor-pointer space-y-2 block">
              <p className="text-sm font-medium text-gray-700">
                {cargando
                  ? 'Procesando archivo...'
                  : arrastrando
                  ? 'Suelta el archivo CSV para cargarlo'
                  : 'Arrastra tu archivo CSV aquí o haz clic para seleccionarlo'}
              </p>
              <p className="text-detalle text-pizarra">
                Columnas esperadas: fecha, producto, cantidad, categoria, precio_compra (opcional)
              </p>
            </label>
          </div>

          {error && (
            <Aviso className="mt-4">
              <p>{error}</p>
            </Aviso>
          )}
  
          {resumen && (
            <div className="mt-4 p-4 bg-niebla text-carbon rounded-2xl text-detalle space-y-1">
              <p className="font-semibold">¡Datos cargados con éxito!</p>
              <p>Filas procesadas: <strong>{resumen.filas}</strong> | Productos detectados: <strong>{resumen.productos}</strong></p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* VISTA PREVIA DE LOS DATOS CARGADOS */}
      {vistaPrevia.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Vista Previa de Datos (Primeras 5 filas)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-niebla text-pizarra uppercase font-semibold">
                  <tr>
                    <th className="p-2.5 rounded-l-lg">Fecha</th>
                    <th className="p-2.5">Producto</th>
                    <th className="p-2.5">Categoría</th>
                    <th className="p-2.5">Precio de compra</th>
                    <th className="p-2.5 text-right rounded-r-lg">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-niebla">
                  {vistaPrevia.map((row, idx) => (
                    <tr key={idx} className="hover:bg-niebla/40">
                      <td className="p-2.5 text-pizarra">{row.fecha}</td>
                      <td className="p-2.5 font-medium text-carbon">{row.producto}</td>
                      <td className="p-2.5 text-pizarra">
                        <span className="bg-niebla text-carbon px-2 py-0.5 rounded-full text-detalle font-medium border border-niebla">
                          {row.categoria}
                        </span>
                      </td>
                      <td className="p-2.5 text-pizarra"> {row.precio_compra !== null && row.precio_compra !== undefined ? row.precio_compra.toLocaleString('es-PY') + ' Gs.'
                      : 'Precio pendiente'} </td>
                      <td className="p-2.5 text-right font-semibold text-carbon">{row.cantidad} Uds.</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}