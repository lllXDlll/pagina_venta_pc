import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'XD Tech',
  description: 'Venta de computadoras y componentes',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
