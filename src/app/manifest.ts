import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'Orwell Bridge Status', short_name: 'Orwell Bridge',
    description: 'Live Orwell Bridge traffic status and local weather for your crossing.',
    start_url: '/', scope: '/', display: 'standalone',
    background_color: '#f5f7fa', theme_color: '#182b46',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
  };
}
