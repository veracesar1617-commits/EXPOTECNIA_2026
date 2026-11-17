/*import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Inventario Villarrica - Sistema Predictivo',
  description: 'Sistema Inteligente de Gestión de Inventarios',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
*/
import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'QuackBI - Sistema Predictivo',
  description: 'Sistema Web para la analítica de negocios y el análisis predictivo de demanda',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="font-sans antialiased bg-crema text-carbon">
        {children}
      </body>
    </html>
  );
}
