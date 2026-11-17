import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'tertiary' | 'danger';
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'px-4 py-2.5 rounded-sm font-semibold transition-colors duration-200 text-detalle focus:outline-none focus-visible:ring-2 focus-visible:ring-carbon focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-niebla disabled:text-plata disabled:border-transparent';

  const variants = {
    primary: 'bg-naranja text-carbon hover:bg-naranja/80 active:bg-naranja-oscuro',
    secondary: 'bg-carbon text-crema hover:bg-pizarra active:bg-carbon',
    outline: 'border border-carbon bg-white text-carbon hover:bg-niebla/60 active:bg-niebla',
    tertiary: 'bg-niebla text-carbon hover:bg-plata/40 active:bg-plata/60',
    danger: 'bg-naranja-oscuro text-carbon hover:bg-naranja active:bg-naranja-oscuro',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}