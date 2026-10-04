'use client';

import React, { useState } from 'react';
import { VentaRaw, RecomendacionStock, RespuestaInforme } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Buttons';
import { Loader } from '../ui/Loader';
import { VistaInformePDF } from './VistaInformePDF';

interface ModuloReportesProps {
  datos: VentaRaw[];
  recomendaciones: RecomendacionStock[];
}

export function ModuloReportes({ datos, recomendaciones }: ModuloReportesProps) {
  // Estado para ajustar cantidades en la simulación de la orden de compra
  const [ordenAjustada, setOrdenAjustada] = useState<Record<string, number>>({});

  // Estados para la generación del Informe Ejecutivo en PDF
  const [cargandoInforme, setCargandoInforme] = useState(false);
  const [errorInforme, setErrorInforme] = useState<string | null>(null);
  const [informeGenerado, setInformeGenerado] = useState<RespuestaInforme | null>(null);

  const obtenerCantidadPedir = (rec: RecomendacionStock) => {
    if (ordenAjustada[rec.producto] !== undefined) {
      return ordenAjustada[rec.producto];
    }
    const sugerida = rec.demandaEstimada - rec.stockActual;
    return sugerida > 0 ? Math.ceil(sugerida) : Math.ceil(rec.demandaEstimada);
  };

  const handleCantidadChange = (producto: string, valor: number) => {
    setOrdenAjustada((prev) => ({
      ...prev,
      [producto]: Math.max(0, valor),
    }));
  };

  // Función para solicitar el informe al servidor predictivo
  const generarInformeGlobal = async () => {
    setCargandoInforme(true);
    setErrorInforme(null);

    const productosUnicos = Array.from(new Set(datos.map((d) => d.producto)));

    const inventarioArray = productosUnicos.map((p) => {
      const rec = recomendaciones.find((r) => r.producto === p);
      return {
        producto: p,
        stock_actual: rec ? rec.stockActual : 0,
        categoria: 'General',
        precio_unitario: 1000,
      };
    });

    try {
      const response = await fetch('http://127.0.0.1:8000/reports/inventory-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dias_futuros: 30,
          historico_global: datos,
          inventario: inventarioArray,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error al generar informe (Status: ${response.status})`);
      }

      const reportData: RespuestaInforme = await response.json();
      setInformeGenerado(reportData);
    } catch (err: any) {
      console.error('Error al solicitar informe:', err);
      setErrorInforme(err.message || 'Error al conectar con el servidor de informes.');
    } finally {
      setCargandoInforme(false);
    }
  };

  // Exportar Orden de Compra Simulada en CSV
  const descargarOrdenCompraCSV = () => {
    if (recomendaciones.length === 0) return;

    const encabezados = ['Producto', 'Stock Actual', 'Demanda Estimada (30d)', 'Cantidad Sugerida a Pedir'];
    const filas = recomendaciones.map((r) => [
      `"${r.producto}"`,
      r.stockActual,
      Math.round(r.demandaEstimada),
      obtenerCantidadPedir(r),
    ]);

    const contenidoCSV = [encabezados.join(','), ...filas.map((f) => f.join(','))].join('\n');
    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `orden_de_compra_simulada_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Descargar Histórico de Ventas
  const descargarCSVHistorico = () => {
    if (datos.length === 0) return;

    const encabezados = ['Fecha', 'Producto', 'Cantidad'];
    const filas = datos.map((d) => [d.fecha, `"${d.producto}"`, d.cantidad]);
    const contenidoCSV = [encabezados.join(','), ...filas.map((f) => f.join(','))].join('\n');

    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `reporte_ventas_historicas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const imprimirPDF = () => {
    window.print();
  };

  // Muestra la plantilla vista del informe PDF si ya se generó
  if (informeGenerado) {
    return (
      <VistaInformePDF
        informe={informeGenerado}
        onVolver={() => setInformeGenerado(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* SIMULADOR DE ORDEN DE COMPRA */}
      <Card className="border-blue-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-blue-900 flex items-center gap-2">
              Simulación de Orden de Compra
            </CardTitle>
            <p className="text-xs text-gray-500">
              Revisa y ajusta las unidades a pedir sugeridas por el modelo predictivo antes de exportar
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button
              onClick={descargarOrdenCompraCSV}
              disabled={recomendaciones.length === 0}
              className="text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              Exportar Orden (.CSV)
            </Button>
            <Button onClick={imprimirPDF} className="text-xs bg-slate-800 hover:bg-slate-900">
              Imprimir Orden / PDF
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {recomendaciones.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-600 border-collapse">
                <thead className="text-xs uppercase bg-slate-100 text-slate-700">
                  <tr>
                    <th className="py-3 px-4 rounded-l-lg">Producto</th>
                    <th className="py-3 px-4 text-center">Stock Referencia</th>
                    <th className="py-3 px-4 text-center">Demanda Estimada (30d)</th>
                    <th className="py-3 px-4 text-center">Estado Sugerido</th>
                    <th className="py-3 px-4 text-right rounded-r-lg">Cantidad a Pedir (Uds)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recomendaciones.map((rec) => {
                    const cantidadPedir = obtenerCantidadPedir(rec);
                    return (
                      <tr key={rec.producto} className="hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{rec.producto}</td>
                        <td className="py-3 px-4 text-center">{rec.stockActual} Uds.</td>
                        <td className="py-3 px-4 text-center font-semibold text-blue-600">
                          {Math.round(rec.demandaEstimada)} Uds.
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${
                              rec.sugerencia === 'INCREMENTAR'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rec.sugerencia === 'REDUCIR'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {rec.sugerencia}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <input
                            type="number"
                            min="0"
                            value={cantidadPedir}
                            onChange={(e) => handleCantidadChange(rec.producto, parseInt(e.target.value) || 0)}
                            className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-right text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 print:border-none print:bg-transparent"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
              Para ver la simulación de orden de compra, primero ve a <strong>Proyección</strong> y presiona <strong>"Predecir Demanda"</strong> en los productos deseados.
            </div>
          )}
        </CardContent>
      </Card>

      {/* OTROS REPORTES GENERABLES */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Otros Reportes Generables</CardTitle>
          <p className="text-xs text-gray-500">Descarga resúmenes históricos y reportes ejecutivos para auditoría de inventario</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {errorInforme && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              {errorInforme}
            </div>
          )}

          {/* Opción 1: Generar Informe Ejecutivo PDF */}
          <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/40 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-blue-950 text-sm">Informe PDF</h4>
              <p className="text-xs text-gray-500">Genera una vista formal en PDF con resumen ejecutivo, matriz de prioridades y proyección global a 30 días</p>
            </div>
            <Button
              onClick={generarInformeGlobal}
              disabled={cargandoInforme || datos.length === 0}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              {cargandoInforme ? 'Generando...' : ' Generar Informe PDF'}
            </Button>
          </div>

          {/* Opción 2: Histórico de Ventas */}
          <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-gray-800 text-sm">Histórico de Ventas Completo</h4>
              <p className="text-xs text-gray-500">Exporta las {datos.length} filas del archivo original cargado</p>
            </div>
            <Button onClick={descargarCSVHistorico} variant="outline" className="text-xs">
              Descargar CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}