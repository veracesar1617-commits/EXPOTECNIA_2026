"use client";

import { useState } from "react";
import Papa from "papaparse";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  TrendingUp, PackageCheck, AlertTriangle, RefreshCw, LayoutDashboard,
  UploadCloud, FileText, Database, ShieldCheck, Download, Building2, Store, HelpCircle, CheckCircle2
} from "lucide-react";

interface Venta {
  fecha: string;
  cantidad: number;
}

interface Prediccion {
  ds: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [dias, setDias] = useState<number>(30);
  const [loading, setLoading] = useState<boolean>(false);
  const [dataPredict, setDataPredict] = useState<Prediccion[]>([]);

  // Estado para los datos cargados desde el archivo CSV/JSON
  const [historicoVentas, setHistoricoVentas] = useState<Venta[]>([
    { fecha: "2026-08-01", cantidad: 120 },
    { fecha: "2026-08-02", cantidad: 135 },
    { fecha: "2026-08-03", cantidad: 110 },
    { fecha: "2026-08-04", cantidad: 150 },
    { fecha: "2026-08-05", cantidad: 165 },
    { fecha: "2026-08-06", cantidad: 140 },
    { fecha: "2026-08-07", cantidad: 180 },
    { fecha: "2026-08-08", cantidad: 175 },
    { fecha: "2026-08-09", cantidad: 190 },
    { fecha: "2026-08-10", cantidad: 210 }
  ]);

  const [archivoNombre, setArchivoNombre] = useState<string>("");

  // Manejador para la lectura del archivo CSV o JSON
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchivoNombre(file.name);

    if (file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            const formateados = parsed.map((item: any) => ({
              fecha: item.fecha,
              cantidad: Number(item.cantidad)
            }));
            setHistoricoVentas(formateados);
          }
        } catch (err) {
          alert("Error al procesar el archivo JSON.");
        }
      };
      reader.readAsText(file);
    } else if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const formateados = results.data
            .map((row: any) => ({
              fecha: row.fecha?.trim(),
              cantidad: Number(row.cantidad)
            }))
            .filter((item: Venta) => item.fecha && !isNaN(item.cantidad));

          if (formateados.length > 0) {
            setHistoricoVentas(formateados);
          } else {
            alert("El CSV debe incluir las columnas 'fecha' y 'cantidad'.");
          }
        }
      });
    }
  };

  const ejecutarPrediccion = async () => {
    if (historicoVentas.length < 5) {
      alert("Se requieren al menos 5 registros históricos para calcular la predicción.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dias_proyeccion: dias,
          historico: historicoVentas
        })
      });

      const resData = await res.json();
      if (resData.status === "success") {
        setDataPredict(resData.predicciones);
      } else {
        alert(resData.detail || "Error al calcular el pronóstico.");
      }
    } catch (error) {
      alert("Error de conexión con el motor predictivo en Python.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-800 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 p-6 flex flex-col justify-between text-white">
        <div>
          <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-5">
            <div className="bg-blue-800 p-2.5 rounded-lg shadow-sm">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-snug tracking-tight text-slate-100">SaaS Analítica</h2>
              <p className="text-xs text-blue-400 font-medium">Villarrica — Guairá</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md font-medium text-sm transition-colors ${
                activeTab === "dashboard"
                  ? "bg-blue-700 text-white font-semibold"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Tablero Principal
            </button>

            <button
              onClick={() => setActiveTab("ingesta")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md font-medium text-sm transition-colors ${
                activeTab === "ingesta"
                  ? "bg-blue-700 text-white font-semibold"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              Ingesta de Ventas
            </button>

            <button
              onClick={() => setActiveTab("predictivo")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md font-medium text-sm transition-colors ${
                activeTab === "predictivo"
                  ? "bg-blue-700 text-white font-semibold"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Análisis Predictivo
            </button>

            <button
              onClick={() => setActiveTab("reportes")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md font-medium text-sm transition-colors ${
                activeTab === "reportes"
                  ? "bg-blue-700 text-white font-semibold"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              Reportes Ejecutivos
            </button>

            <button
              onClick={() => setActiveTab("backups")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-md font-medium text-sm transition-colors ${
                activeTab === "backups"
                  ? "bg-blue-700 text-white font-semibold"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              <Database className="w-4 h-4" />
              Resguardo de Datos
            </button>
          </nav>
        </div>

        <div className="bg-slate-800/80 p-3.5 rounded-md border border-slate-700/60 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-medium mb-1 text-slate-200">
            <Store className="w-4 h-4 text-blue-400" />
            <span>Comercio Adherido</span>
          </div>
          <p className="text-slate-400">ID Empresa: Mipyme Villarrica</p>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO */}
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Sistema de Analítica de Negocios y Predicción de Demanda
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Solución SaaS modular para el comercio minorista en Villarrica
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded text-xs text-slate-600 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Entorno Seguro Multi-tenant
          </div>
        </header>

        {/* 1. TABLERO PRINCIPAL */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registros Cargados</span>
                  <PackageCheck className="w-5 h-5 text-blue-800" />
                </div>
                <div className="text-2xl font-bold text-slate-900">{historicoVentas.length} ítems</div>
                <p className="text-xs text-slate-500 mt-1">Disponibles para análisis</p>
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Promedio Diario</span>
                  <TrendingUp className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {(historicoVentas.reduce((acc, curr) => acc + curr.cantidad, 0) / (historicoVentas.length || 1)).toFixed(1)} u.
                </div>
                <p className="text-xs text-slate-500 mt-1">Calculado dinámicamente</p>
              </div>

              <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Origen de Datos</span>
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-sm font-bold text-slate-900 truncate">
                  {archivoNombre || "Datos base por defecto"}
                </div>
                <p className="text-xs text-amber-700 font-medium mt-1">
                  {archivoNombre ? "Archivo procesado" : "Suba un CSV en 'Ingesta de Ventas'"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2. INGESTA DE VENTAS */}
        {activeTab === "ingesta" && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="bg-white p-8 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-center mb-6">
                <UploadCloud className="w-12 h-12 text-blue-800 mx-auto mb-2" />
                <h2 className="text-base font-bold text-slate-900">Carga e Importación de Ventas e Inventario</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Suba planillas CSV o JSON con encabezados <code>fecha</code> (YYYY-MM-DD) y <code>cantidad</code>.
                </p>
              </div>

              <label className="border-2 border-dashed border-slate-300 hover:border-blue-700 rounded-lg p-8 text-center cursor-pointer transition-colors bg-slate-50/50 block">
                <input
                  type="file"
                  accept=".csv, .json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <p className="text-xs font-semibold text-slate-700">Haz clic aquí para seleccionar tu archivo (.CSV o .JSON)</p>
                <span className="text-[11px] text-slate-500 mt-1 block">Ejemplo: ventas_villarrica.csv</span>
              </label>

              {archivoNombre && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded flex items-center gap-2 text-xs text-emerald-800 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Archivo cargado exitosamente: <strong>{archivoNombre}</strong> ({historicoVentas.length} registros)</span>
                </div>
              )}
            </div>

            {/* Tabla de vista previa */}
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Vista Previa de Datos Históricos
              </h3>
              <div className="max-h-60 overflow-y-auto border border-slate-100 rounded">
                <table className="w-full text-xs text-left text-slate-600">
                  <thead className="bg-slate-100 text-slate-700 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Fecha (YYYY-MM-DD)</th>
                      <th className="px-4 py-2 font-semibold">Cantidad Vendida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historicoVentas.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2">{item.fecha}</td>
                        <td className="px-4 py-2 font-medium text-slate-900">{item.cantidad} u.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. ANÁLISIS PREDICTIVO */}
        {activeTab === "predictivo" && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Proyección de Demanda (Series Temporales)</h2>
                <p className="text-xs text-slate-500">
                  Calculando sobre <strong>{historicoVentas.length} registros históricos</strong> actuales
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={dias}
                  onChange={(e) => setDias(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-800"
                >
                  <option value={30}>Proyectar a 30 días</option>
                  <option value={60}>Proyectar a 60 días</option>
                </select>

                <button
                  onClick={ejecutarPrediccion}
                  disabled={loading}
                  className="bg-blue-800 hover:bg-blue-900 text-white text-xs font-semibold px-4 py-2 rounded flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {loading && <RefreshCw className="animate-spin w-3.5 h-3.5" />}
                  {loading ? "Procesando..." : "Calcular Pronóstico"}
                </button>
              </div>
            </div>

            {dataPredict.length > 0 ? (
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">
                  Curva Estimada de Ventas Futuras ({dias} Días)
                </h3>
                <div className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dataPredict}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="ds" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#cbd5e1", borderRadius: "4px", fontSize: "12px" }} />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Line type="monotone" dataKey="yhat" name="Demanda Estimada" stroke="#1e40af" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="yhat_upper" name="Límite Superior" stroke="#15803d" strokeDasharray="4 4" dot={false} />
                      <Line type="monotone" dataKey="yhat_lower" name="Límite Inferior" stroke="#b91c1c" strokeDasharray="4 4" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-white p-10 rounded-lg border border-slate-200 text-center shadow-sm">
                <HelpCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-600">
                  Presione el botón <strong>"Calcular Pronóstico"</strong> para enviar los registros procesados al microservicio en Python.
                </p>
              </div>
            )}
          </div>
        )}

        {/* 4. REPORTES */}
        {activeTab === "reportes" && (
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Generación de Informes y Exportación</h2>
              <p className="text-xs text-slate-500">Descargue resúmenes ejecutivos en formatos estándar para análisis en hoja de cálculo o presentación.</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 rounded text-xs font-semibold text-slate-700 transition-colors">
                <Download className="w-4 h-4 text-slate-600" /> Generar Informe PDF
              </button>
              <button className="flex items-center gap-2 border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 rounded text-xs font-semibold text-slate-700 transition-colors">
                <Download className="w-4 h-4 text-slate-600" /> Exportar Datos CSV
              </button>
            </div>
          </div>
        )}

        {/* 5. BACKUPS */}
        {activeTab === "backups" && (
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Gestión de Copias de Seguridad (Backups)</h2>
              <p className="text-xs text-slate-500">Resguardo local/nube de los repositorios analíticos de la empresa.</p>
            </div>
            <button className="flex items-center gap-2 bg-blue-800 hover:bg-blue-900 text-white px-4 py-2 rounded text-xs font-semibold transition-colors shadow-sm">
              <Database className="w-4 h-4" /> Generar Resguardo Manual (.JSON / .SQL)
            </button>
          </div>
        )}
      </main>
    </div>
  );
}