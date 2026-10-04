import React from 'react';

interface LoaderProps {
  mensaje?: string;
}

export function Loader({ mensaje = 'Cargando...' }: LoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-3">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-600 font-medium">{mensaje}</p>
    </div>
  );
}