'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { VentaRaw } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Buttons';

interface IngestaVentasProps {
  onDatosCargados: (datos: VentaRaw[]) => void;
}

export function IngestaVentas({ onDatosCargados }: IngestaVentasProps) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumen, setResumen] = useState<{ filas: number; productos: number } | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<VentaRaw[]>([]);

  const handleArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        } catch (err: any) {
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Carga de Ventas Históricas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-500 transition-colors">
            <input
              type="file"
              accept=".csv"
              onChange={handleArchivo}
              className="hidden"
              id="csvInput"
              disabled={cargando}
            />
            <label htmlFor="csvInput" className="cursor-pointer space-y-2 block">
              <div> className="text-3xl"</div>
              <p className="text-sm font-medium text-gray-700">
                {cargando ? 'Procesando archivo...' : 'Haz clic para seleccionar un archivo CSV'}
              </p>
              <p className="text-xs text-gray-400">Columnas esperadas: fecha, producto, cantidad, categoria</p>
            </label>
          </div>

          {error && <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg">{error}</div>}

          {resumen && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs space-y-1">
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
                <thead className="bg-gray-100 text-gray-600 uppercase font-semibold">
                  <tr>
                    <th className="p-2.5 rounded-l-lg">Fecha</th>
                    <th className="p-2.5">Producto</th>
                    <th className="p-2.5">Categoría</th>
                    <th className="p-2.5 text-right rounded-r-lg">Cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vistaPrevia.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="p-2.5 text-gray-600">{row.fecha}</td>
                      <td className="p-2.5 font-medium text-gray-900">{row.producto}</td>
                      <td className="p-2.5 text-gray-600">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-[10px] font-medium border border-gray-200">
                          {row.categoria}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-semibold text-blue-600">{row.cantidad} Uds.</td>
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