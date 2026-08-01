import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Camila Garcia Estética',
    short_name: 'Camila Garcia',
    description: 'Sistema de gestão — Camila Garcia Estética',
    start_url: '/agendamentos',
    display: 'standalone',
    background_color: '#F5F0EA',
    theme_color: '#7A5C4A',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
