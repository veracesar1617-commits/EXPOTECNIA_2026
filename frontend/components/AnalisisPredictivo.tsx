"use client";

import { useState, ChangeEvent } from "react";

interface ResultadoAnalisis {
  sku: string;
  producto: string;
  demanda_proyectada_30d: number;
  stock_actual: number;
  accion: "AUMENTAR_STOCK" | "DISMINUIR_PEDIDOS" | "STOCK_OPTIMO";
  cantidad_a_ajustar: number;
  dias_restantes_stock: number;
  momento_compra: string;
}

export default function AnalisisPredictivo() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [resultados, setResultados] = useState<ResultadoAnalisis[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const ejecutarAnalisis = async () => {
    if (!file) {
      setError("Por favor, selecciona un archivo CSV primero.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:8000/predict-file", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const detalle = typeof errorData.detail === "string" 
          ? errorData.detail 
          : JSON.stringify(errorData.detail);
        throw new Error(detalle || "Error al procesar el archivo");
      }

      const data = await response.json();
      setResultados(data.analisis);
    } catch (err: any) {
      setError(err.message || "No se pudo conectar con el motor predictivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-md border border-gray-100">
      <h2 className="text-xl font-bold mb-2">Proyección de Demanda y Reabastecimiento</h2>
      <p className="text-gray-500 text-sm mb-4">
        Sube el historial de ventas en formato CSV para calcular la demanda estimada y sugerencias de compra.
      </p>

      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="border p-2 rounded w-full md:w-auto text-sm"
        />
        <button
          onClick={ejecutarAnalisis}
          disabled={loading || !file}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded transition disabled:bg-gray-300"
        >
          {loading ? "Analizando y Calculando..." : "Calcular Pronóstico"}
        </button>
      </div>

      {error && (
        <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}

      {resultados.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 border-b">
              <tr>
                <th className="p-3">SKU</th>
                <th className="p-3">Producto</th>
                <th className="p-3">Demanda 30d</th>
                <th className="p-3">Stock Actual</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Ajuste Sugerido</th>
                <th className="p-3">Urgencia</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {resultados.map((item) => (
                <tr key={item.sku}>
                  <td className="p-3 font-mono">{item.sku}</td>
                  <td className="p-3 font-medium">{item.producto}</td>
                  <td className="p-3">{item.demanda_proyectada_30d} un.</td>
                  <td className="p-3">{item.stock_actual} un.</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        item.accion === "AUMENTAR_STOCK"
                          ? "bg-amber-100 text-amber-800"
                          : item.accion === "DISMINUIR_PEDIDOS"
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {item.accion}
                    </span>
                  </td>
                  <td className="p-3 font-bold">
                    {item.cantidad_a_ajustar > 0 ? `+${item.cantidad_a_ajustar}` : "0"}
                  </td>
                  <td className="p-3 text-xs text-gray-600">{item.momento_compra}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}