// components/predictivo/VistaInformePDF.tsx
'use client';

import React from 'react';
import { RespuestaInforme, DetalleInformeItem } from './types';
import { Button } from '../ui/Buttons';
import { Aviso } from '../ui/Aviso';

interface VistaInformePDFProps {
  informe: RespuestaInforme;
  onVolver?: () => void;
}

const ESTADO_INSUFICIENTE = 'HISTORIAL_INSUFICIENTE';
const ESTADO_SIN_STOCK = 'SIN_STOCK';

/* ---------- Formateadores ---------- */

const esNumero = (valor?: number | null): valor is number =>
  valor !== null && valor !== undefined && !Number.isNaN(Number(valor));

// "Gs. 19.574.000"
const formatoMoneda = (valor?: number | null): string => {
  if (!esNumero(valor)) return '—';
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    maximumFractionDigits: 0,
  }).format(Number(valor));
};

// "1.642.500" (sin símbolo, para tablas)
const formatoEntero = (valor?: number | null): string => {
  if (!esNumero(valor)) return '—';
  return new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(Number(valor));
};

// "10,4"
const formatoDecimal = (valor?: number | null): string => {
  if (!esNumero(valor)) return '—';
  return new Intl.NumberFormat('es-PY', { maximumFractionDigits: 1 }).format(Number(valor));
};

// "2026-11-12 23:52:02" -> "12/11/2026 · 23:52"
const formatoFecha = (valor?: string): string => {
  const m = String(valor ?? '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return String(valor ?? '');
  return `${m[3]}/${m[2]}/${m[1]} · ${m[4]}:${m[5]}`;
};

/* ---------- Estado ---------- */

function etiquetaEstado(estado: string) {
  if (estado === 'COMPRAR') {
    return { texto: 'Comprar', clase: 'bg-amber-500 text-white' };
  }
  if (estado === 'NO_COMPRAR') {
    return { texto: 'Suficiente', clase: 'bg-gray-200 text-gray-700' };
  }
  return { texto: estado, clase: 'bg-gray-100 text-gray-600' };
}

/* ---------- Estilos de impresión ---------- */

const ESTILOS_IMPRESION = `
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm;
  }

  html, body {
    height: auto !important;
    overflow: visible !important;
    background: #fff !important;
  }

  /* Oculta todo el layout externo (sidebar, navbar, etc.) sin conocerlo */
  body * { visibility: hidden; }
  #informe-imprimible,
  #informe-imprimible * { visibility: visible; }

  #informe-imprimible {
    position: absolute;
    left: 0;
    top: 0;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
  }

  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .informe-tabla {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed;
  }
  .informe-tabla thead { display: table-header-group; }
  .informe-tabla tfoot { display: table-row-group; }
  .informe-tabla tr { break-inside: avoid; page-break-inside: avoid; }
  .informe-tabla td, .informe-tabla th { word-wrap: break-word; }

  .informe-bloque { break-inside: avoid; page-break-inside: avoid; }
  .informe-fila { break-inside: avoid; page-break-inside: avoid; }
  .informe-nueva-pagina { break-before: page; page-break-before: always; }
}
`;

/* ---------- Barra de cobertura ---------- */

function BarraCobertura({ dias, meta }: { dias: number | null | undefined; meta: number }) {
  if (!esNumero(dias)) return <span className="text-pizarra">—</span>;

  // Escala: de 0 a 4/3 de la meta (con meta 30 días -> 0 a 40 días)
  const escala = Math.max(Math.ceil((meta * 4) / 3), 1);
  const ancho = Math.min(100, Math.max(2, (dias / escala) * 100));
  const marca = Math.min(100, (meta / escala) * 100);
  const cubre = dias >= meta;

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 flex-1 rounded-full bg-niebla">
        <div
          className={`absolute left-0 top-0 h-2 rounded-full ${cubre ? 'bg-azul' : 'bg-naranja-oscuro'}`}
          style={{ width: `${ancho}%` }}
        />
        <div
          className="absolute -top-0.5 h-3 w-px bg-carbon"
          style={{ left: `${marca}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-carbon">{formatoDecimal(dias)} d</span>
    </div>
  );
}

export function VistaInformePDF({ informe, onVolver }: VistaInformePDFProps) {
  const resumen = informe?.resumen || {
    fecha_generacion: new Date().toISOString().slice(0, 19).replace('T', ' '),
    horizonte_dias: 30,
    total_productos_analizados: 0,
    productos_requieren_compra: 0,
    total_unidades_sugeridas: 0,
    costo_estimado_inversion: null,
    precision_promedio_modelo: 0,
  };

  const detalles: DetalleInformeItem[] = informe?.detalles || [];
  const observaciones = informe?.observaciones || [];
  const horizonte = resumen.horizonte_dias || 30;
  const meta = resumen.meta_cobertura_dias || horizonte;
  const esIndividual = informe?.tipo === 'individual';

  // Separación por estado
  const evaluados = detalles.filter((d) => d.estado === 'COMPRAR' || d.estado === 'NO_COMPRAR');
  const sinStock = detalles.filter((d) => d.estado === ESTADO_SIN_STOCK);
  const insuficientes = detalles.filter((d) => d.estado === ESTADO_INSUFICIENTE);

  // Totales (el backend manda los oficiales; si faltan, se calculan)
  const totalUnidades =
    resumen.total_unidades_sugeridas ?? evaluados.reduce((acc, d) => acc + (d.sugerencia_compra || 0), 0);
  const totalInversion: number | null =
    resumen.costo_estimado_inversion !== undefined
      ? resumen.costo_estimado_inversion
      : evaluados.reduce((acc, d) => acc + (d.costo_estimado || 0), 0);
  const enRiesgo = resumen.productos_requieren_compra ?? evaluados.filter((d) => d.estado === 'COMPRAR').length;
  const totalEvaluados = resumen.total_productos_analizados ?? evaluados.length;

  const resumenEjecutivo =
    resumen.resumen_ejecutivo ||
    `${enRiesgo} de ${totalEvaluados} productos no cubren la demanda proyectada para los próximos ${horizonte} días.`;

  const hayFaltantes = sinStock.length > 0 || (resumen.productos_sin_precio?.length ?? 0) > 0;

  // Escala común del gráfico stock vs. demanda
  const maxGrafico = Math.max(
    1,
    ...evaluados.map((d) => Math.max(d.stock_actual ?? 0, d.demanda_proyectada ?? 0))
  );

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <style>{ESTILOS_IMPRESION}</style>

      {/* BARRA DE HERRAMIENTAS SUPERIOR (Se oculta al imprimir) */}
      <div className="print:hidden flex items-center justify-between bg-white p-4 rounded-2xl border border-niebla shadow-sm">
        <div>
          <h2 className="font-display text-titulo-3 font-bold text-carbon">Informe Generado Exitosamente</h2>
          <p className="text-detalle text-pizarra">
            Puedes exportar este informe a PDF o imprimirlo directamente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onVolver && (
            <Button onClick={onVolver} variant="outline">
              ← Volver al Tablero
            </Button>
          )}
          <Button onClick={handleImprimir}>
            Imprimir / Guardar en PDF
          </Button>
        </div>
      </div>

      {/* AVISO DE DATOS FALTANTES (solo en pantalla) */}
      {hayFaltantes && (
        <Aviso className="print:hidden">
          <p>
            <strong>Faltan datos en algunos productos.</strong>{' '}
            {sinStock.length > 0 &&
              `${sinStock.length} sin stock real: no se calculó su cobertura ni su pedido. `}
            {(resumen.productos_sin_precio?.length ?? 0) > 0 &&
              `${resumen.productos_sin_precio?.length} sin precio: no entran en la inversión. `}
            Vuelve al tablero, completa los datos de inventario y genera el informe de nuevo.
          </p>
        </Aviso>
      )}

      {/* DOCUMENTO IMPRIMIBLE */}
      <div
        id="informe-imprimible"
        className="bg-white p-8 rounded-xl border border-niebla shadow-md max-w-5xl mx-auto text-carbon"
      >
        {/* 1. ENCABEZADO */}
        <div className="informe-bloque border-b-2 border-carbon pb-4 mb-6">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h1 className="font-display text-titulo-2 font-bold text-carbon tracking-tight">
                Informe predictivo de reposición
              </h1>
              <p className="text-detalle text-pizarra mt-1">
                QuackBI · {esIndividual && informe?.producto_seleccionado
                  ? `${informe.producto_seleccionado} · `
                  : ''}Planificación de demanda a {horizonte} días
              </p>
            </div>
            <span className="font-display text-lg font-extrabold text-carbon shrink-0">
              Quack<span className="text-naranja-oscuro">BI</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-detalle text-pizarra mt-4">
            <p><strong className="text-carbon">Generado:</strong> {formatoFecha(resumen.fecha_generacion)}</p>
            <p><strong className="text-carbon">Horizonte:</strong> {horizonte} días</p>
            <p><strong className="text-carbon">Modelo:</strong> Prophet (series de tiempo)</p>
            <p><strong className="text-carbon">Moneda:</strong> Guaraníes (Gs.)</p>
          </div>
        </div>

        {/* 2. TARJETAS DE RESUMEN */}
        <div className="informe-bloque grid grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-3 mb-6">
          <div className="bg-niebla/40 p-3.5 rounded-xl border border-niebla">
            <span className="text-detalle text-pizarra block">Inversión estimada</span>
            <span className="text-titulo-3 font-semibold tabular-nums text-carbon block mt-1">
              {formatoMoneda(totalInversion)}
            </span>
            <span className="text-detalle text-pizarra block mt-1">
              {totalInversion === null || totalInversion === undefined
                ? 'No calculable: falta precio'
                : 'Solo productos a reponer'}
            </span>
          </div>

          <div className="bg-durazno p-3.5 rounded-xl border border-naranja/40">
            <span className="text-detalle text-carbon block">Stock en riesgo</span>
            <span className="text-titulo-3 font-semibold tabular-nums text-carbon block mt-1">
              {enRiesgo} <span className="text-detalle font-medium">de {totalEvaluados} productos</span>
            </span>
            <span className="text-detalle text-carbon block mt-1">
              No cubren la demanda de {horizonte} días
            </span>
          </div>

          <div className="bg-niebla/40 p-3.5 rounded-xl border border-niebla">
            <span className="text-detalle text-pizarra block">Unidades a pedir</span>
            <span className="text-titulo-3 font-semibold tabular-nums text-carbon block mt-1">
              {formatoEntero(totalUnidades)}
            </span>
            <span className="text-detalle text-pizarra block mt-1">unidades</span>
          </div>

          <div className="bg-niebla/40 p-3.5 rounded-xl border border-niebla">
            <span className="text-detalle text-pizarra block">Precisión del modelo</span>
            <span className="text-titulo-3 font-semibold tabular-nums text-carbon block mt-1">
              {formatoDecimal(resumen.precision_promedio_modelo)} %
            </span>
            <span className="text-detalle text-pizarra block mt-1">promedio</span>
          </div>
        </div>

        {/* 3. RESUMEN EJECUTIVO */}
        <div className="informe-bloque mb-6">
          <h3 className="font-display text-titulo-3 font-bold text-carbon mb-2">Resumen ejecutivo</h3>
          <p className="text-cuerpo text-carbon">{resumenEjecutivo}</p>
        </div>

        {/* 4. PRIORIDADES DE COMPRA */}
        <div className="mb-6">
          <h3 className="font-display text-titulo-3 font-bold text-carbon mb-2">Prioridades de compra</h3>

          {evaluados.length === 0 ? (
            <p className="text-detalle text-pizarra bg-niebla/40 border border-niebla rounded-lg p-4">
              Ningún producto pudo evaluarse: faltan datos de stock real o historial suficiente.
            </p>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <table className="informe-tabla w-full min-w-[760px] print:min-w-0 text-left text-detalle border-collapse">
                <colgroup>
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-carbon text-detalle uppercase text-pizarra">
                    <th className="p-2 font-semibold">Producto</th>
                    <th className="p-2 font-semibold text-center">Stock</th>
                    <th className="p-2 font-semibold text-right">Demanda</th>
                    <th className="p-2 font-semibold">Cobertura</th>
                    <th className="p-2 font-semibold text-right">Pedido</th>
                    <th className="p-2 font-semibold text-right">Costo (Gs.)</th>
                    <th className="p-2 font-semibold text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-niebla">
                  {evaluados.map((item, idx) => {
                    const etiqueta = etiquetaEstado(item.estado);
                    return (
                      <tr key={`${item.producto}-${idx}`}>
                        <td className="p-2">
                          <span className="font-semibold text-carbon block">{item.producto}</span>
                          <span className="text-detalle text-pizarra block">{item.categoria || 'General'}</span>
                        </td>
                        <td className="p-2 text-center">{formatoEntero(item.stock_actual)}</td>
                        <td className="p-2 text-right">{formatoEntero(item.demanda_proyectada)}</td>
                        <td className="p-2"><BarraCobertura dias={item.cobertura_dias} meta={meta} /></td>
                        <td className="p-2 text-right font-semibold text-carbon">{formatoEntero(item.sugerencia_compra)}</td>
                        <td className="p-2 text-right">
                          {item.costo_estimado === null || item.costo_estimado === undefined
                            ? <span className="text-pizarra" title="Falta el precio">—</span>
                            : formatoEntero(item.costo_estimado)}
                        </td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-detalle font-semibold ${etiqueta.clase}`}>
                            {etiqueta.texto}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-carbon font-semibold text-carbon">
                    <td className="p-2" colSpan={4}>Total · {evaluados.length} producto{evaluados.length === 1 ? '' : 's'}</td>
                    <td className="p-2 text-right">{formatoEntero(totalUnidades)}</td>
                    <td className="p-2 text-right">{totalInversion === null || totalInversion === undefined ? '—' : formatoEntero(totalInversion)}</td>
                    <td className="p-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {evaluados.length > 0 && (
            <p className="text-detalle text-pizarra mt-3">
              Cobertura = stock actual ÷ demanda diaria proyectada. La marca vertical indica la meta de {meta} días.
              Naranja: no alcanza la meta. Azul: la cubre.
            </p>
          )}
        </div>

        {/* 5. PRODUCTOS SIN STOCK REAL */}
        {sinStock.length > 0 && (
          <div className="mb-6">
            <h3 className="font-display text-titulo-3 font-bold text-carbon mb-1 border-l-4 border-plata pl-2">
              Productos sin proyección ({insuficientes.length})
            </h3>
            <p className="text-detalle text-pizarra mb-2">
              No tienen suficientes días con ventas para que el modelo genere una proyección confiable, por eso no
              se incluyen en el pedido sugerido. Se evaluarán cuando acumulen más historial.
            </p>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="informe-tabla w-full min-w-[560px] print:min-w-0 text-left text-detalle border-collapse">
                <colgroup>
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '70%' }} />
                </colgroup>
                <thead>
                  <tr className="bg-niebla border-b border-plata text-carbon uppercase text-detalle">
                    <th className="p-2 font-semibold">Producto</th>
                    <th className="p-2 font-semibold">Observación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-niebla">
                  {insuficientes.map((item, idx) => (
                    <tr key={`${item.producto}-${idx}`}>
                      <td className="p-2">
                        <span className="font-semibold text-carbon block">{item.producto}</span>
                        <span className="text-detalle text-pizarra block">{item.categoria || 'General'}</span>
                      </td>
                      <td className="p-2 text-pizarra">{item.mensaje}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. PRODUCTOS CON HISTORIAL INSUFICIENTE */}
        {insuficientes.length > 0 && (
          <div className="mb-6">
            <h3 className="font-display text-titulo-3 font-bold text-carbon mb-1 border-l-4 border-plata pl-2">
              Productos sin proyección ({insuficientes.length})
            </h3>
            <p className="text-detalle text-pizarra mb-2">
              No tienen suficientes días con ventas para que el modelo genere una proyección confiable, por eso no
              se incluyen en el pedido sugerido. Se evaluarán cuando acumulen más historial.
            </p>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="informe-tabla w-full min-w-[560px] print:min-w-0 text-left text-detalle border-collapse">
                <colgroup>
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '70%' }} />
                </colgroup>
                <thead>
                  <tr className="bg-niebla border-b border-plata text-carbon uppercase text-detalle">
                    <th className="p-2 font-semibold">Producto</th>
                    <th className="p-2 font-semibold">Observación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-niebla">
                  {insuficientes.map((item, idx) => (
                    <tr key={`${item.producto}-${idx}`}>
                      <td className="p-2">
                        <span className="font-semibold text-carbon block">{item.producto}</span>
                        <span className="text-detalle text-pizarra block">{item.categoria || 'General'}</span>
                      </td>
                      <td className="p-2 text-pizarra">{item.mensaje}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}


        {/* 7. STOCK ACTUAL VS. DEMANDA PROYECTADA */}
        {evaluados.length > 0 && (
          <div className="mb-6">
            <h3 className="font-display text-titulo-3 font-bold text-carbon mb-1">Stock actual vs. demanda proyectada</h3>
            <div className="flex items-center gap-4 text-detalle text-pizarra mb-2 border-b border-niebla pb-2">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-4 rounded-sm bg-azul" /> Stock actual (real)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-4 rounded-sm bg-naranja-oscuro" /> Demanda proyectada a {horizonte} días
              </span>
            </div>

            <div>
              {evaluados.map((item, idx) => {
                const stock = item.stock_actual ?? 0;
                const demanda = item.demanda_proyectada ?? 0;
                return (
                  <div
                    key={`${item.producto}-g-${idx}`}
                    className="informe-fila grid grid-cols-[28%_1fr] items-center gap-3 border-b border-niebla py-1.5"
                  >
                    <span className="text-detalle font-semibold text-carbon">{item.producto}</span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="h-2 rounded-sm bg-azul" style={{ width: `${(stock / maxGrafico) * 88}%`, minWidth: stock > 0 ? 2 : 0 }} />
                        <span className="text-detalle text-carbon">{formatoEntero(stock)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-2 rounded-sm bg-naranja-oscuro" style={{ width: `${(demanda / maxGrafico) * 88}%`, minWidth: demanda > 0 ? 2 : 0 }} />
                        <span className="text-detalle text-carbon">{formatoEntero(demanda)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-detalle text-pizarra mt-2">
              Cantidades en unidades. Cuando la barra naranja supera a la azul, el stock no cubre la demanda del período.
            </p>
          </div>
        )}

        {/* 8. NOTAS Y OBSERVACIONES */}
         <div className="informe-bloque bg-niebla/40 p-4 rounded-lg border border-niebla">
          <h4 className="text-cuerpo font-semibold text-carbon mb-2">Notas y observaciones</h4>
          <ul className="list-disc list-inside text-detalle text-pizarra space-y-1">
            {observaciones.map((obs, idx) => (
              <li key={idx}>{obs}</li>
            ))}
          </ul>
        </div>

        <div className="informe-bloque mt-8 pt-4 border-t border-niebla flex justify-between text-detalle text-pizarra">
          <p>QuackBI · Informe generado automáticamente</p>
          <p>{formatoFecha(resumen.fecha_generacion).split(' · ')[0]}</p>
        </div>
      </div>
    </div>
  );
}
