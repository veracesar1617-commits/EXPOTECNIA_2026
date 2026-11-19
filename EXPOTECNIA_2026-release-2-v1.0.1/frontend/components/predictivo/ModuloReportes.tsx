// ModuloReportes.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { VentaRaw, RecomendacionStock, RespuestaInforme } from './types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Buttons';
import { Aviso } from '../ui/Aviso';
import { VistaInformePDF } from './VistaInformePDF';

interface ModuloReportesProps {
  datos: VentaRaw[];
  recomendaciones: RecomendacionStock[];
}

// Valores de la tabla de inventario, como texto para permitir campos vacíos
interface FilaInventario {
  stock?: string;
  precio?: string;
}

const HORIZONTES = [
  { dias: 7, etiqueta: '7 días' },
  { dias: 15, etiqueta: '15 días' },
  { dias: 30, etiqueta: '30 días' },
  { dias: 90, etiqueta: '90 días' },
];

const FILAS_VISIBLES = 6;

/* ---------- Utilidades ---------- */

const normalizarTexto = (valor: string): string =>
  valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Acepta "1250", "1.250", "1.250,5", "1,250.5" y "1250,5"
const parsearNumero = (valor: string | undefined | null): number | null => {
  if (valor === undefined || valor === null) return null;
  let t = String(valor).replace(/\s/g, '').replace(/gs\.?/i, '');
  if (t === '') return null;

  const tienePunto = t.includes('.');
  const tieneComa = t.includes(',');

  if (tienePunto && tieneComa) {
    // El último separador es el decimal
    if (t.lastIndexOf(',') > t.lastIndexOf('.')) {
      t = t.replace(/\./g, '').replace(',', '.');
    } else {
      t = t.replace(/,/g, '');
    }
  } else if (tieneComa) {
    t = /^\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  } else if (tienePunto) {
    // "12.000" = doce mil (miles con punto, como en guaraníes)
    if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  }

  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const fechaATiempo = (fecha: string): number => {
  const v = String(fecha ?? '').trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d, m, a] = v.split('/').map(Number);
    return new Date(a, m - 1, d).getTime();
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const [a, m, d] = v.slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d).getTime();
  }
  return 0;
};

const detectarSeparador = (linea: string): string => {
  const candidatos = [';', '\t', ','];
  let mejor = ',';
  let max = -1;
  for (const c of candidatos) {
    const n = linea.split(c).length - 1;
    if (n > max) {
      max = n;
      mejor = c;
    }
  }
  return mejor;
};

// Divide una línea CSV respetando comillas
const dividirLineaCSV = (linea: string, separador: string): string[] => {
  const celdas: string[] = [];
  let actual = '';
  let entreComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (c === separador && !entreComillas) {
      celdas.push(actual);
      actual = '';
    } else {
      actual += c;
    }
  }
  celdas.push(actual);
  return celdas.map((c) => c.trim());
};

interface FilaCSVInventario {
  producto: string;
  stock: number | null;
  precio: number | null;
}

const ALIAS_PRODUCTO = ['producto', 'productos', 'product', 'nombre', 'articulo', 'item'];
const ALIAS_STOCK = ['stock', 'stock actual', 'stock_actual', 'existencia', 'existencias', 'inventario', 'cantidad'];
const ALIAS_PRECIO = ['precio', 'precio unitario', 'precio_unitario', 'precio compra', 'precio_compra', 'costo'];

const parsearCSVInventario = (
  texto: string
): { filas: FilaCSVInventario[]; error?: string } => {
  const lineas = texto
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');

  if (lineas.length < 2) {
    return { filas: [], error: 'El archivo está vacío o solo tiene encabezado.' };
  }

  const separador = detectarSeparador(lineas[0]);
  const encabezado = dividirLineaCSV(lineas[0], separador).map((h) => normalizarTexto(h).replace(/_/g, ' '));

  const buscar = (alias: string[]) =>
    encabezado.findIndex((h) => alias.map((a) => normalizarTexto(a).replace(/_/g, ' ')).includes(h));

  const idxProducto = buscar(ALIAS_PRODUCTO);
  const idxStock = buscar(ALIAS_STOCK);
  const idxPrecio = buscar(ALIAS_PRECIO);

  if (idxProducto === -1 || idxStock === -1) {
    return {
      filas: [],
      error: 'El CSV debe tener una columna "producto" y una columna "stock" (opcionalmente "precio").',
    };
  }

  const filas: FilaCSVInventario[] = [];
  for (let i = 1; i < lineas.length; i++) {
    const celdas = dividirLineaCSV(lineas[i], separador);
    const producto = (celdas[idxProducto] ?? '').trim();
    if (!producto) continue;
    filas.push({
      producto,
      stock: parsearNumero(celdas[idxStock]),
      precio: idxPrecio !== -1 ? parsearNumero(celdas[idxPrecio]) : null,
    });
  }

  return { filas };
};

const descargarArchivo = (contenido: string, nombre: string) => {
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', nombre);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/* ---------- Componente ---------- */

export function ModuloReportes({ datos, recomendaciones }: ModuloReportesProps) {
  const [ordenAjustada, setOrdenAjustada] = useState<Record<string, number>>({});
  const [productoSeleccionadoIndividual, setProductoSeleccionadoIndividual] = useState<string>('');

  // Datos de inventario ingresados por el usuario (stock real y precio confirmado)
  const [inventario, setInventario] = useState<Record<string, FilaInventario>>({});

  useEffect(() => {
    fetch('http://127.0.0.1:8000/inventario').then((r) => r.json()).then(setInventario).catch(() => {});
  }, []);

  useEffect(() => {
    if (Object.keys(inventario).length === 0) return;
    fetch('http://127.0.0.1:8000/inventario', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inventario),
    }).catch(() => {});
  }, [inventario]);

  const [horizonte, setHorizonte] = useState<number>(30);
  const [verTodos, setVerTodos] = useState(false);
  const [mensajeCarga, setMensajeCarga] = useState<{ tipo: 'ok' | 'aviso' | 'error'; texto: string } | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const [cargandoInforme, setCargandoInforme] = useState(false);
  const [errorInforme, setErrorInforme] = useState<string | null>(null);
  const [informeGenerado, setInformeGenerado] = useState<RespuestaInforme | null>(null);

  // Productos únicos (nombres sin espacios sobrantes, igual que el backend)
  const productosUnicos = useMemo(
    () => Array.from(new Set(datos.map((d) => String(d.producto ?? '').trim()).filter(Boolean))),
    [datos]
  );

  // Categoría y último precio válido de cada producto según el CSV de ventas
  const infoCSV = useMemo(() => {
    const mapa: Record<string, { categoria: string; precio: number | null }> = {};

    productosUnicos.forEach((p) => {
      const ventas = datos
        .filter((d) => String(d.producto ?? '').trim() === p)
        .sort((a, b) => fechaATiempo(a.fecha) - fechaATiempo(b.fecha));

      const categoria = ventas.find((v) => v.categoria && String(v.categoria).trim() !== '')?.categoria ?? 'General';
      const conPrecio = ventas.filter((v) => typeof v.precio_compra === 'number' && v.precio_compra > 0);
      const precio = conPrecio.length > 0 ? (conPrecio[conPrecio.length - 1].precio_compra as number) : null;

      mapa[p] = { categoria: String(categoria), precio };
    });

    return mapa;
  }, [datos, productosUnicos]);

  const valorStock = (p: string): number | null => parsearNumero(inventario[p]?.stock);

  const textoPrecio = (p: string): string => {
    const editado = inventario[p]?.precio;
    if (editado !== undefined) return editado;
    const csv = infoCSV[p]?.precio;
    return csv !== null && csv !== undefined ? String(csv) : '';
  };

  const valorPrecio = (p: string): number | null => {
    const n = parsearNumero(textoPrecio(p));
    return n !== null && n > 0 ? n : null;
  };

  const estadoFila = (p: string) => {
    const faltaStock = valorStock(p) === null;
    const faltaPrecio = valorPrecio(p) === null;
    if (faltaStock && faltaPrecio) return { texto: 'Falta stock y precio', incompleto: true };
    if (faltaStock) return { texto: 'Falta stock', incompleto: true };
    if (faltaPrecio) return { texto: 'Falta precio', incompleto: true };
    return { texto: 'Completo', incompleto: false };
  };

  const productosIncompletos = productosUnicos.filter((p) => estadoFila(p).incompleto);
  const filasMostradas = verTodos ? productosUnicos : productosUnicos.slice(0, FILAS_VISIBLES);

  const actualizarFila = (producto: string, campo: 'stock' | 'precio', valor: string) => {
    setInventario((prev) => ({ ...prev, [producto]: { ...prev[producto], [campo]: valor } }));
  };

  /* ----- Carga de stock desde CSV ----- */

  const manejarArchivoStock = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = ''; // permite volver a cargar el mismo archivo
    if (!archivo) return;

    try {
      const texto = await archivo.text();
      const { filas, error } = parsearCSVInventario(texto);

      if (error) {
        setMensajeCarga({ tipo: 'error', texto: error });
        return;
      }

      const indice: Record<string, string> = {};
      productosUnicos.forEach((p) => {
        indice[normalizarTexto(p)] = p;
      });

      const nuevos: Record<string, FilaInventario> = {};
      const noCoinciden: string[] = [];
      let conStock = 0;

      filas.forEach((f) => {
        const destino = indice[normalizarTexto(f.producto)];
        if (!destino) {
          noCoinciden.push(f.producto);
          return;
        }
        const fila: FilaInventario = {};
        if (f.stock !== null) {
          fila.stock = String(f.stock);
          conStock++;
        }
        if (f.precio !== null && f.precio > 0) fila.precio = String(f.precio);
        nuevos[destino] = fila;
      });

      setInventario((prev) => {
        const siguiente = { ...prev };
        Object.entries(nuevos).forEach(([p, fila]) => {
          siguiente[p] = { ...siguiente[p], ...fila };
        });
        return siguiente;
      });

      const partes = [`Se cargó el stock de ${conStock} de ${productosUnicos.length} productos.`];
      if (noCoinciden.length > 0) {
        partes.push(
          `${noCoinciden.length} fila(s) del archivo no coinciden con ningún producto del histórico: ${noCoinciden
            .slice(0, 5)
            .join(', ')}${noCoinciden.length > 5 ? '…' : ''}.`
        );
      }
      setMensajeCarga({ tipo: noCoinciden.length > 0 || conStock < productosUnicos.length ? 'aviso' : 'ok', texto: partes.join(' ') });
    } catch {
      setMensajeCarga({ tipo: 'error', texto: 'No se pudo leer el archivo. Verifica que sea un CSV válido.' });
    }
  };

  const descargarPlantillaStock = () => {
    const filas = productosUnicos.map((p) => {
      const precio = infoCSV[p]?.precio;
      return [`"${p.replace(/"/g, '""')}"`, '', precio ?? ''].join(',');
    });
    descargarArchivo(['producto,stock,precio', ...filas].join('\n'), 'plantilla_stock_precios.csv');
  };

  /* ----- Orden de compra simulada (lógica existente) ----- */

  const obtenerCantidadPedir = (rec?: RecomendacionStock | null) => {
    if (!rec) {
      return 0;
    }

    if (ordenAjustada[rec.producto] !== undefined) {
      return ordenAjustada[rec.producto];
    }

    const demandaEstimada = rec.demandaEstimada ?? 0;
    const stockActual = rec.stockActual ?? 0;
    const sugerida = demandaEstimada - stockActual;

    return sugerida > 0 ? Math.ceil(sugerida) : Math.ceil(demandaEstimada);
  };

  const handleCantidadChange = (producto: string, valor: number) => {
    setOrdenAjustada((prev) => ({
      ...prev,
      [producto]: Math.max(0, valor),
    }));
  };

  /* ----- Generación de informes ----- */

  const generarInforme = async (esIndividual: boolean = false) => {
    setCargandoInforme(true);
    setErrorInforme(null);

    if (esIndividual && !productoSeleccionadoIndividual) {
      setErrorInforme('Por favor selecciona un producto para generar el informe individual.');
      setCargandoInforme(false);
      return;
    }

    // Inventario con los datos reales ingresados. Los vacíos se envían como null
    // (el backend nunca asume stock 0: marca el producto como "Sin stock").
    const inventarioArray = productosUnicos.map((p) => ({
      producto: p,
      stock_actual: valorStock(p),
      categoria: infoCSV[p]?.categoria ?? 'General',
      precio_unitario: valorPrecio(p),
    }));

    try {
      const response = await fetch(
        'http://127.0.0.1:8000/reports/inventory-forecast',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dias_futuros: horizonte,
            historico_global: datos,
            inventario: inventarioArray,
            producto_individual: esIndividual ? productoSeleccionadoIndividual : null,
          }),
        }
      );

      if (!response.ok) {
        let detalle = '';
        try {
          const cuerpo = await response.json();
          if (typeof cuerpo?.detail === 'string') detalle = cuerpo.detail;
        } catch {
          /* respuesta sin JSON */
        }
        throw new Error(`Error al generar informe (Status: ${response.status})${detalle ? `: ${detalle}` : ''}`);
      }

      const reportData: RespuestaInforme = await response.json();

      if (!Array.isArray(reportData.detalles) || reportData.detalles.length === 0) {
        throw new Error('No se pudo generar el informe porque no hay productos disponibles para incluir en el análisis.');
      }

      setInformeGenerado(reportData);
    } catch (err: unknown) {
      console.error('Error al solicitar informe:', err);
      const mensaje = err instanceof Error ? err.message : 'Error al conectar con el servidor de informes.';
      setErrorInforme(mensaje);
    } finally {
      setCargandoInforme(false);
    }
  };

  const descargarOrdenCompraCSV = () => {
    if (recomendaciones.length === 0) return;

    const encabezados = ['Producto', 'Stock Actual', 'Demanda Estimada (30d)', 'Cantidad Sugerida a Pedir'];
    const filas = recomendaciones.map((r) => {
      const demandaEstimada = r.demandaEstimada ?? 0;
      const cantidadSugerida = obtenerCantidadPedir(r);

      return [
        `"${r.producto}"`,
        r.stockActual ?? 0,
        Math.round(demandaEstimada),
        cantidadSugerida,
      ];
    });

    const contenidoCSV = [encabezados.join(','), ...filas.map((f) => f.join(','))].join('\n');
    descargarArchivo(contenidoCSV, `orden_de_compra_simulada_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const descargarCSVHistorico = () => {
    if (datos.length === 0) return;

    const encabezados = ['Fecha', 'Producto', 'Cantidad', 'Precio Compra'];
    const filas = datos.map((d) => [d.fecha, `"${d.producto}"`, d.cantidad, d.precio_compra ?? '']);
    const contenidoCSV = [encabezados.join(','), ...filas.map((f) => f.join(','))].join('\n');
    descargarArchivo(contenidoCSV, `reporte_ventas_historicas_${new Date().toISOString().slice(0, 10)}.csv`);
  };

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
      {/* HORIZONTE */}
      <div className="print:hidden flex items-center justify-between">
        <p className="text-detalle text-pizarra">
          Completa los datos reales de tu inventario y exporta informes de reposición confiables.
        </p>
        <label className="flex items-center gap-2 text-detalle text-pizarra bg-white border border-niebla rounded-xl px-3 py-1.5">
          Horizonte
          <select
            value={horizonte}
            onChange={(e) => setHorizonte(Number(e.target.value))}
            className="font-semibold text-carbon bg-transparent outline-none"
          >
            {HORIZONTES.map((h) => (
              <option key={h.dias} value={h.dias}>{h.etiqueta}</option>
            ))}
          </select>
        </label>
      </div>

      {/* PASO 1: DATOS DE INVENTARIO */}
      <Card className="print:hidden border-amber-200">
        <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <span className="text-detalle font-semibold tracking-widest text-naranja-oscuro">PASO 1</span>
            <CardTitle className="text-gray-900">Datos de inventario</CardTitle>
            <p className="text-detalle text-pizarra text-sm">
              La categoría viene de tu CSV. Ingresa el stock real y el precio de cada producto, o cárgalos desde un archivo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputArchivoRef}
              type="file"
              accept=".csv,text/csv"
              onChange={manejarArchivoStock}
              className="hidden"
            />
            <Button
              onClick={() => inputArchivoRef.current?.click()}
              disabled={productosUnicos.length === 0}
              variant="outline"
              className="text-xs"
            >
              Cargar stock desde CSV
            </Button>
            <Button
              onClick={descargarPlantillaStock}
              disabled={productosUnicos.length === 0}
              variant="outline"
              className="text-xs"
            >
              Descargar plantilla
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {mensajeCarga && (
            mensajeCarga.tipo === 'ok' ? (
              <div className="rounded-2xl bg-niebla p-4 text-detalle text-carbon">{mensajeCarga.texto}</div>
            ) : (
              <Aviso>
                <p>{mensajeCarga.texto}</p>
              </Aviso>
            )
          )}


          {productosIncompletos.length > 0 && (
            <Aviso>
              <p>
                <strong>
                  Faltan datos en {productosIncompletos.length} de {productosUnicos.length} productos.
                </strong>{' '}
                Sin stock real el informe no puede calcular la cobertura ni la cantidad a comprar, y sin precio no calcula la inversión.
              </p>
            </Aviso>
          )}

          {productosUnicos.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-pizarra border-collapse">
                  <thead className="text-detalle uppercase text-pizarra border-b border-niebla">
                    <tr>
                      <th className="py-2 px-3">Producto</th>
                      <th className="py-2 px-3">Categoría</th>
                      <th className="py-2 px-3 text-center">Stock actual (uds.)</th>
                      <th className="py-2 px-3 text-center">Precio unitario (Gs.)</th>
                      <th className="py-2 px-3 text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-niebla">
                    {filasMostradas.map((p) => {
                      const estado = estadoFila(p);
                      const faltaStock = valorStock(p) === null;
                      const faltaPrecio = valorPrecio(p) === null;
                      return (
                        <tr key={p}>
                          <td className="py-2 px-3 font-medium text-carbon">{p}</td>
                          <td className="py-2 px-3 text-pizarra">{infoCSV[p]?.categoria ?? 'General'}</td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Requerido"
                              value={inventario[p]?.stock ?? ''}
                              onChange={(e) => actualizarFila(p, 'stock', e.target.value)}
                              className={`w-28 border rounded-xl px-2 py-1 text-right text-detalle font-semibold text-carbon focus:ring-2 focus:ring-carbon ${
                                faltaStock ? 'border-naranja' : 'border-plata'
                              }`}
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Requerido"
                              value={textoPrecio(p)}
                              onChange={(e) => actualizarFila(p, 'precio', e.target.value)}
                              className={`w-32 border rounded-xl px-2 py-1 text-right text-detalle font-semibold text-carbon focus:ring-2 focus:ring-carbon ${
                                faltaPrecio ? 'border-naranja' : 'border-plata'
                              }`}
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                estado.incompleto ? 'bg-naranja text-white' : 'bg-niebla text-carbon'
                              }`}
                            >
                              {estado.texto}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                <p className="text-xs text-pizarra">
                  Mostrando {filasMostradas.length} de {productosUnicos.length} productos
                  {productosUnicos.length > FILAS_VISIBLES && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        onClick={() => setVerTodos((v) => !v)}
                        className="font-semibold text-carbon underline"
                      >
                        {verTodos ? 'Ver menos' : 'Ver todos'}
                      </button>
                    </>
                  )}
                </p>
                <Button
                  onClick={() => generarInforme(false)}
                  disabled={cargandoInforme || datos.length === 0}
                  className="text-xs bg-naranja hover:bg-amber-600 text-white"
                >
                  {cargandoInforme ? 'Generando...' : 'Generar informe PDF →'}
                </Button>
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-pizarra text-detalle bg-niebla/40 rounded-lg border border-dashed border-niebla">
              Carga un histórico de ventas para ver los productos.
            </div>
          )}

          {errorInforme && (
            <Aviso>
            <div>
              <p>{errorInforme}</p>
            </div>
            </Aviso>
          )}
        </CardContent>
      </Card>

      {/* PASO 2: REPORTES DISPONIBLES */}
      <div className="print:hidden space-y-3">
        <div>
          <span className="text-detalle font-semibold tracking-widest text-naranja-oscuro">PASO 2</span>
          <h3 className="font-display text-titulo-3 font-bold text-carbon">Reportes disponibles</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Informe ejecutivo (global) */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between gap-4">
            <div>
              <h4 className="text-cuerpo font-semibold text-carbon">Informe ejecutivo</h4>
              <p className="text-detalle text-pizarra mt-1">
                Resumen, prioridades de compra, inversión estimada y proyección a {horizonte} días lista para imprimir.
              </p>
            </div>
            <Button
              onClick={() => generarInforme(false)}
              disabled={cargandoInforme || datos.length === 0}
              className="text-xs bg-naranja hover:bg-amber-600 text-white"
            >
              {cargandoInforme ? 'Generando...' : 'Generar informe PDF'}
            </Button>
          </div>

          {/* Informe individual */}
          <div className="bg-white border border-niebla rounded-xl p-4 flex flex-col justify-between gap-4">
            <div>
              <h4 className="text-cuerpo font-semibold text-carbon">Informe individual</h4>
              <p className="text-detalle text-pizarra mt-1">
                Proyección detallada de un solo producto con sus datos de inventario.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={productoSeleccionadoIndividual}
                onChange={(e) => setProductoSeleccionadoIndividual(e.target.value)}
                className="flex-1 min-w-0 border border-plata rounded-xl px-2 py-1.5 text-detalle text-carbon bg-crema focus:ring-2 focus:ring-carbon"
              >
                <option value="">-- Seleccionar producto --</option>
                {productosUnicos.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <Button
                onClick={() => generarInforme(true)}
                disabled={cargandoInforme || datos.length === 0 || !productoSeleccionadoIndividual}
                variant="secondary"
              >
                Generar
              </Button>
            </div>
          </div>

          {/* Histórico de ventas */}
          <div className="bg-white border border-niebla rounded-2xl p-4 flex flex-col justify-between gap-4">
            <div>
              <h4 className="text-cuerpo font-semibold text-carbon">Histórico de ventas</h4>
              <p className="text-detalle text-pizarra mt-1">
                Exporta las {datos.length} filas del archivo original cargado.
              </p>
            </div>
            <Button onClick={descargarCSVHistorico} variant="outline" className="text-xs">
              Descargar CSV
            </Button>
          </div>
        </div>
      </div>

      {/* SIMULADOR DE ORDEN DE COMPRA */}
      <Card className="border-blue-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-carbon flex items-center gap-2">
              Simulación de Orden de Compra
            </CardTitle>
            <p className="text-detalle text-pizarra">
              Revisa y ajusta las unidades a pedir sugeridas por el modelo predictivo antes de exportar
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button
              onClick={descargarOrdenCompraCSV}
              disabled={recomendaciones.length === 0}
            >
              Exportar Orden (.CSV)
            </Button>
            <Button onClick={() => window.print()} variant="secondary" >
              Imprimir Orden
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {recomendaciones.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-detalle text-left text-pizarra border-collapse">
                <thead className="text-detalle uppercase bg-niebla text-carbon">
                  <tr>
                    <th className="py-3 px-4 rounded-l-lg">Producto</th>
                    <th className="py-3 px-4 text-center">Stock Referencia</th>
                    <th className="py-3 px-4 text-center">Demanda Estimada (30d)</th>
                    <th className="py-3 px-4 text-center">Estado Sugerido</th>
                    <th className="py-3 px-4 text-right rounded-r-lg">Cantidad a Pedir (Uds)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-niebla">
                  {recomendaciones.map((rec) => {
                    const cantidadPedir = obtenerCantidadPedir(rec);
                    const demandaEstimada = rec?.demandaEstimada ?? 0;
                    const estadoSugerido = rec?.sugerencia ?? 'MANTENER';

                    return (
                      <tr key={rec.producto} className="hover:bg-niebla/40">
                        <td className="py-3 px-4 font-medium text-carbon">{rec.producto}</td>
                        <td className="py-3 px-4 text-center">{rec.stockActual ?? 0} Uds.</td>
                        <td className="py-3 px-4 text-center font-semibold tabular-nums text-naranja-oscuro">
                          {Math.round(demandaEstimada)} Uds.
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-detalle font-semibold ${
                            estadoSugerido === 'INCREMENTAR' ? 'bg-naranja text-carbon' :
                            estadoSugerido === 'REDUCIR' ? 'bg-durazno text-carbon' : 'bg-niebla text-pizarra'
                          }`}>
                            {estadoSugerido}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <input
                            type="number"
                            min="0"
                            value={cantidadPedir}
                            onChange={(e) => handleCantidadChange(rec.producto, parseInt(e.target.value) || 0)}
                            className="w-24 border border-plata rounded-xl px-2 py-1 text-right text-detalle font-semibold text-carbon focus:ring-2 focus:ring-carbon"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-pizarra text-detalle bg-niebla/40 rounded-lg border border-dashed border-niebla">
              Para ver la simulación de orden de compra, primero ve a <strong>Proyección</strong> y presiona <strong>Predecir Demanda</strong>.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}