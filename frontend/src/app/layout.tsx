import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Industrial Predictive AI',
  description: 'Industrial SCADA Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body>{children}</body>
    </html>
  )
}
