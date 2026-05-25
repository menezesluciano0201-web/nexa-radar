'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })

interface PinData {
  id: string
  titulo: string
  lat: number
  lng: number
}

interface Props {
  pins: PinData[]
}

export function MapaExecucao({ pins }: Props) {
  const [iconReady, setIconReady] = useState(false)

  // Workaround do bug clássico do Leaflet com bundlers (ícone do marker quebra).
  useEffect(() => {
    (async () => {
      const L = (await import('leaflet')).default
      // @ts-expect-error — runtime override do default icon
      delete L.Icon.Default.prototype._getIconUrl
      // Ícones servidos localmente em vez de unpkg — evita DNS+TLS handshake
      // de terceiro no critical path do mapa.
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl: '/leaflet/marker-icon.png',
        shadowUrl: '/leaflet/marker-shadow.png',
      })
      setIconReady(true)
    })()
  }, [])

  if (pins.length === 0) return null

  const centerLat = pins.reduce((a, p) => a + p.lat, 0) / pins.length
  const centerLng = pins.reduce((a, p) => a + p.lng, 0) / pins.length

  function handlePinClick(id: string) {
    const el = document.getElementById(`card-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-nexa-500')
    setTimeout(() => el.classList.remove('ring-2', 'ring-nexa-500'), 2000)
  }

  if (!iconReady) {
    return <div className="h-72 bg-slate-100 animate-pulse rounded-md" aria-label="Carregando mapa" />
  }

  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={13}
      style={{ height: '300px', width: '100%' }}
      className="rounded-md overflow-hidden"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {pins.map(p => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          eventHandlers={{ click: () => handlePinClick(p.id) }}
        >
          <Popup>{p.titulo}</Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
