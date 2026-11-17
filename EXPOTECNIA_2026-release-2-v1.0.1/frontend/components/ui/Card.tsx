import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-niebla p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: CardProps) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: CardProps) {
  return <h3 className={`font-display text-titulo-3 font-bold text-carbon ${className}`}>{children}</h3>;
}

export function CardContent({ children, className = '' }: CardProps) {
  return <div className={className}>{children}</div>;
}