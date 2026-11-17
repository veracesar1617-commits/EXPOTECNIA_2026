import React from 'react';

interface AvisoProps {
  children: React.ReactNode;
  className?: string;
}

export function Aviso({ children, className = '' }: AvisoProps) {
  return (
    <div className={`flex items-start gap-3 rounded-2xl bg-durazno p-4 text-detalle text-carbon ${className}`}>
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-naranja text-[11px] font-semibold leading-none text-carbon"
      >
        !
      </span>
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </div>
  );
}
