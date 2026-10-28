<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { WaterPoint } from '@/types'

const props = defineProps<{ points: WaterPoint[] }>()
const el = ref<HTMLElement | null>(null)
const failed = ref(false)
/* Leaflet is loaded on demand, so its types are kept loose here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let L: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let map: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let layer: any = null

const COLORS: Record<string, string> = { operational: '#16794c', limited: '#c98a00', closed: '#b3261e' }

function draw(): void {
  if (!map || !L) return
  layer?.remove()
  layer = L.layerGroup().addTo(map)
  const withPos = props.points.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
  for (const p of withPos) {
    const c = COLORS[p.status] ?? '#0b66c3'
    const m = L.circleMarker([p.lat, p.lng], { radius: 10, color: c, fillColor: c, fillOpacity: 0.8, weight: 3 })
    const box = document.createElement('div')
    const title = document.createElement('strong')
    title.textContent = p.name // textContent: names are staff-entered, never inject as HTML
    box.append(title, document.createElement('br'), document.createTextNode(p.addressDescription || ''))
    m.bindPopup(box)
    m.addTo(layer)
  }
  if (withPos.length > 1) map.fitBounds(L.latLngBounds(withPos.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 15 })
  else if (withPos.length === 1) map.setView([withPos[0].lat, withPos[0].lng], 15)
}

onMounted(async () => {
  try {
    const mod = await import('leaflet')
    await import('leaflet/dist/leaflet.css')
    L = (mod as { default?: unknown }).default ?? mod
    if (!el.value) return
    map = L.map(el.value, { scrollWheelZoom: false }).setView([9.72, 123.34], 12) // Alegria, Cebu
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)
    draw()
  } catch {
    failed.value = true
  }
})
watch(() => props.points, draw)
onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <p v-if="failed" class="muted">The map could not be loaded. The list view has the same information.</p>
  <div v-else ref="el" role="region" aria-label="Map of water points" style="height: 340px; border-radius: 14px; border: 1px solid var(--line); z-index: 0" />
</template>
