'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { VentaRaw, PrediccionPunto, RecomendacionStock, normalizarRecomendacion } from './predictivo/types';
import { IngestaVentas } from './predictivo/IngestaVentas';
import { MetricasResumen } from './predictivo/MetricasResumen';
import { TableroPredictivo } from './predictivo/TableroPredictivo';
import { GraficoDistribucion } from './predictivo/GraficoDistribucion';
import { ModuloReportes } from './predictivo/ModuloReportes';
import { Button } from './ui/Buttons';
import { Aviso } from './ui/Aviso';

type ModuloActivo = 'dashboard' | 'ingesta' | 'predictivo' | 'reportes';

const MODULOS: { id: ModuloActivo; etiqueta: string }[] = [
  { id: 'dashboard', etiqueta: 'Dashboard' },
  { id: 'ingesta', etiqueta: 'Carga de Archivos' },
  { id: 'predictivo', etiqueta: 'Proyección' },
  { id: 'reportes', etiqueta: 'Reportes' },
];

const TITULOS: Record<ModuloActivo, string> = {
  dashboard: 'Panel General de Control',
  ingesta: 'Carga e Ingesta de Ventas',
  predictivo: 'Análisis Predictivo de Demanda',
  reportes: 'Generación de Reportes',
};

const ANCHO_PANTALLA_ESCRITORIO = 1024;


function IconoMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

interface BotonLogoProps {
  onClick: () => void;
  etiqueta: string;
  className?: string;
}

function ImagenSidebar() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <Image
      src="/QuackyFondoBlanco.png"
      alt=""
      width={56}
      height={56}
      className="h-16 w-16 -ml-1 shrink-0 rounded-xl object-contain"
      onError={() => setVisible(false)}
    />
  );
}

function BotonLogo({ onClick, etiqueta, className = '' }: BotonLogoProps) {
  const [fallo, setFallo] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className={`grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon focus-visible:ring-offset-2 print:hidden ${
        fallo ? 'border-2 border-carbon text-carbon hover:bg-carbon hover:text-crema' : ''
      } ${className}`}
    >
      {!fallo ? (
        <Image
          src="/logo-quackbi.png"
          alt="Boton desplegable del menú lateral"
          width={44}
          height={44}
          className="h-11 w-11 object-contain"
          onError={() => setFallo(true)}
        />
      ) : (
        <>
          <IconoMenu />
        </>
      )}
    </button>
  );
}

export default function AnalisisPredictivo() {
  const [datosHistoricos, setDatosHistoricos] = useState<VentaRaw[]>([]);
  const [recomendaciones, setRecomendaciones] = useState<RecomendacionStock[]>([]);
  const [moduloActivo, setModuloActivo] = useState<ModuloActivo>('dashboard');
  const [sidebarAbierto, setSidebarAbierto] = useState(true);

  useEffect(() => {
    if (window.innerWidth < ANCHO_PANTALLA_ESCRITORIO) {
      setSidebarAbierto(false);
    }
  }, []);

  const seleccionarModulo = (modulo: ModuloActivo) => {
    setModuloActivo(modulo);
    if (window.innerWidth < ANCHO_PANTALLA_ESCRITORIO) {
      setSidebarAbierto(false);
    }
  };

  const handleDatosCargados = (datos: VentaRaw[]) => {
    setDatosHistoricos(datos);
    setRecomendaciones([]);
  };

  const handlePrediccionCalculada = (prediccionesMap: Record<string, PrediccionPunto[]>) => {
    const nuevasRecomendaciones: RecomendacionStock[] = [];

    Object.entries(prediccionesMap).forEach(([producto, puntos]) => {
      if (puntos.length === 0) return;

      const demandaEstimada = puntos.reduce((acc, p) => acc + Math.max(0, p.yhat), 0);
      const ventasProd = datosHistoricos.filter((d) => d.producto === producto);
      const totalHistorico = ventasProd.reduce((acc, d) => acc + d.cantidad, 0);
      const stockReferencia = Math.round(totalHistorico / (ventasProd.length || 1)) * 30;

      const diferencia = demandaEstimada - stockReferencia;
      const porcentajeAjuste = stockReferencia > 0 ? Math.round((diferencia / stockReferencia) * 100) : 100;

      let sugerencia: 'INCREMENTAR' | 'REDUCIR' | 'MANTENER' = 'MANTENER';
      if (porcentajeAjuste > 5) sugerencia = 'INCREMENTAR';
      if (porcentajeAjuste < -5) sugerencia = 'REDUCIR';

      const recomendacionNormalizada = normalizarRecomendacion({
        producto,
        stockActual: stockReferencia,
        demandaEstimada: demandaEstimada,
        sugerencia: sugerencia,
        accion: sugerencia === 'INCREMENTAR' ? 'AUMENTAR' : sugerencia === 'REDUCIR' ? 'REDUCIR' : 'MANTENER',
      });

      if (recomendacionNormalizada) {
        nuevasRecomendaciones.push(recomendacionNormalizada);
      }
    });

    setRecomendaciones(nuevasRecomendaciones);
  };

  const hayDatos = datosHistoricos.length > 0;


  return (
    <div className="min-h-screen bg-crema text-carbon">
      {sidebarAbierto && (
        <div
          className="fixed inset-0 z-40 bg-carbon/40 lg:hidden print:hidden"
          onClick={() => setSidebarAbierto(false)}
          aria-hidden="true"
        />
      )}

      <aside
        aria-hidden={!sidebarAbierto}
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col justify-between bg-naranja p-4 text-carbon shadow-xl transition-[transform,visibility] duration-300 ease-in-out print:hidden ${
          sidebarAbierto ? 'translate-x-0 visible' : '-translate-x-full invisible'
        }`}
      >
        <div>
          <div className="mb-5 flex items-center gap-3 border-b-2 border-carbon px-1 pb-4 pt-1">
            <BotonLogo
              onClick={() => setSidebarAbierto(false)}
              etiqueta="Ocultar menú"
              className="focus-visible:ring-offset-naranja"
            />
            <span className="font-display text-2xl font-extrabold tracking-tight text-carbon">
              Quack<span className="text-crema">BI</span>
            </span>
            <ImagenSidebar />
          </div>

          <nav className="space-y-2" aria-label="Módulos">
            {MODULOS.map((modulo) => (
              <button
                key={modulo.id}
                type="button"
                onClick={() => seleccionarModulo(modulo.id)}
                aria-current={moduloActivo === modulo.id ? 'page' : undefined}
                className={`flex w-full items-center rounded-sm border-2 px-3 py-2.5 text-left text-detalle font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon focus-visible:ring-offset-2 focus-visible:ring-offset-naranja ${
                  moduloActivo === modulo.id
                    ? 'border-carbon bg-carbon text-crema'
                    : 'border-transparent text-carbon hover:border-carbon hover:bg-durazno/40'
                }`}
              >
                {modulo.etiqueta}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-end justify-between gap-3 border-t-2 border-carbon pt-4">
          <div className="min-w-0 text-detalle">
            <p className="font-semibold">Estado del sistema</p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`h-3 w-3 shrink-0 rounded-full ring-2 ring-crema ${
                  hayDatos ? 'bg-emerald-500' : 'bg-naranja-oscuro'
                }`}
              />
              <span className="font-medium">
                {hayDatos ? `${datosHistoricos.length.toLocaleString('es-PY')} filas activas` : 'Sin datos cargados'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main
        className={`min-h-screen space-y-6 p-4 transition-[padding] duration-300 ease-in-out sm:p-6 print:pl-0 ${
          sidebarAbierto ? 'lg:pl-70' : ''
        }`}
      >
        <header className="flex items-center justify-between gap-4 rounded-2xl border border-niebla bg-white p-4 shadow-sm">
          <div className="flex min-w-0 items-center gap-4">
            {!sidebarAbierto && (
              <BotonLogo onClick={() => setSidebarAbierto(true)} etiqueta="Mostrar menú" />
            )}
            <div className="min-w-0">
              <h1 className="truncate font-display text-titulo-2 font-bold text-carbon">{TITULOS[moduloActivo]}</h1>
              <p className="mt-0.5 text-detalle text-pizarra">Sistema Inteligente de Gestión de Inventarios</p>
            </div>
          </div>

          {hayDatos && (
            <span className="hidden shrink-0 rounded-full border border-plata bg-niebla px-3 py-1.5 text-detalle font-semibold text-carbon sm:inline-block">
              Datos activos: {datosHistoricos.length.toLocaleString('es-PY')} filas
            </span>
          )}
        </header>

        {moduloActivo === 'ingesta' && <IngestaVentas onDatosCargados={handleDatosCargados} />}

        {!hayDatos && moduloActivo !== 'ingesta' && (
          <Aviso>
            <p className="font-semibold">No hay datos de ventas cargados en el sistema.</p>
            <Button onClick={() => seleccionarModulo('ingesta')}>Ir a Carga de Ventas</Button>
          </Aviso>
        )}

        {hayDatos && (
          <div className="space-y-6">
            {moduloActivo === 'dashboard' && (
              <>
                <MetricasResumen datos={datosHistoricos} />
                <GraficoDistribucion datos={datosHistoricos} />
              </>
            )}

            {moduloActivo === 'predictivo' && (
              <TableroPredictivo datos={datosHistoricos} onPrediccionCalculada={handlePrediccionCalculada} />
            )}

            {moduloActivo === 'reportes' && (
              <ModuloReportes datos={datosHistoricos} recomendaciones={recomendaciones} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
