<template>
  <section class="constructor">
    <div class="constructor__header">
      <div>
        <p class="constructor__eyebrow">Игровой конструктор</p>
        <h1>Редактор планировки</h1>
        <p>Слева 2D‑план с действиями, справа 3D‑вид для навигации.</p>
      </div>
      <div class="constructor__header-actions">
        <button type="button" class="btn btn--ghost btn--small" @click="$emit('back')">← На главную</button>
      </div>
    </div>

    <div class="constructor__grid">
      <div class="constructor__panel constructor__panel--2d">
        <div class="constructor__toolbar">
          <button :class="['chip', mode === 'select' && 'chip--active']" @click="setMode('select')">Выбор</button>
          <button :class="['chip', mode === 'addWall' && 'chip--active']" @click="setMode('addWall')">Добавить стену</button>
          <button :class="['chip', mode === 'removeWall' && 'chip--active']" @click="setMode('removeWall')">Удалить стену</button>
          <button :class="['chip', mode === 'moveWall' && 'chip--active']" @click="setMode('moveWall')">Переместить стену</button>
          <button :class="['chip', mode === 'furniture' && 'chip--active']" @click="setMode('furniture')">Мебель</button>
          <span class="constructor__spacer"></span>
          <button class="chip" @click="resetView">Сброс вида</button>
        </div>
        <div class="constructor__canvas-wrap" @wheel.prevent="onWheel" @mousedown="onPointerDown" @mousemove="onPointerMove" @mouseup="onPointerUp" @mouseleave="onPointerUp" @click="onCanvasClick">
          <canvas ref="canvas2d"></canvas>
        </div>
        <div class="constructor__legend">
          <span class="legend legend--load">Несущая</span>
          <span class="legend legend--part">Перегородка</span>
        </div>
      </div>

      <div class="constructor__panel constructor__panel--3d">
        <div class="constructor__toolbar">
          <button :class="['chip', viewMode === 'top' && 'chip--active']" @click="setViewMode('top')">Сверху</button>
          <button :class="['chip', viewMode === 'fpv' && 'chip--active']" @click="setViewMode('fpv')">От первого лица</button>
          <span class="constructor__spacer"></span>
          <button class="chip" @click="attachUnity" :disabled="unityConnected">Подключить Unity</button>
          <button class="chip" @click="sendGeometryToUnity" :disabled="!unityConnected">Обновить сцену</button>
        </div>
        <div class="unity__host" ref="unityHost">
          <div v-if="!unityConnected" class="unity__placeholder">
            <p>Готово к подключению Unity.</p>
            <small>После подключения будет доступна навигация FPV и вид сверху.</small>
          </div>
          <div v-else class="unity__connected">
            <p>Unity подключен.</p>
            <small>Сцена принимает обновления геометрии и стен.</small>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'

const props = defineProps({
  initialGeometry: { type: Object, default: null },
  initialWalls: { type: Array, default: () => [] },
})

const canvas2d = ref(null)
const unityHost = ref(null)
const unityConnected = ref(false)
const viewMode = ref('top')
const mode = ref('select')
const addingWall = ref(null)

const geometry = ref(props.initialGeometry || { rooms: [] })
const walls = ref(
  (props.initialWalls && props.initialWalls.length ? props.initialWalls : [
    { id: 'W1', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, loadBearing: true, thickness: 0.2, wallType: 'несущая' },
    { id: 'W2', start: { x: 5, y: 0 }, end: { x: 5, y: 4 }, loadBearing: false, thickness: 0.12, wallType: 'перегородка' },
  ])
)

const view = reactive({ x: 0, y: 0, scale: 60, dragging: false, lastX: 0, lastY: 0 })

const canvasSize = computed(() => ({ w: 0, h: 0 }))

const setMode = (m) => { mode.value = m; addingWall.value = null }
const setViewMode = (m) => { viewMode.value = m }
const resetView = () => { view.x = 0; view.y = 0; view.scale = 60 }

const worldToScreen = (x, y) => ({ sx: x * view.scale + view.x, sy: y * view.scale + view.y })
const screenToWorld = (sx, sy) => ({ x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale })

const onWheel = (e) => {
  const delta = Math.sign(e.deltaY)
  const factor = delta > 0 ? 0.9 : 1.1
  const rect = e.currentTarget.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  const before = screenToWorld(cx, cy)
  view.scale = Math.min(180, Math.max(20, view.scale * factor))
  const after = screenToWorld(cx, cy)
  view.x += (before.x - after.x) * view.scale
  view.y += (before.y - after.y) * view.scale
}

const onPointerDown = (e) => { view.dragging = true; view.lastX = e.clientX; view.lastY = e.clientY }
const onPointerMove = (e) => {
  if (!view.dragging) return
  const dx = e.clientX - view.lastX
  const dy = e.clientY - view.lastY
  view.x += dx
  view.y += dy
  view.lastX = e.clientX
  view.lastY = e.clientY
}
const onPointerUp = () => { view.dragging = false }

const nearestWall = (pt) => {
  let best = null
  let bestDist = Infinity
  for (const w of walls.value) {
    const ax = w.start.x, ay = w.start.y
    const bx = w.end.x, by = w.end.y
    const vx = bx - ax, vy = by - ay
    const wx = pt.x - ax, wy = pt.y - ay
    const c1 = vx * wx + vy * wy
    const c2 = vx * vx + vy * vy
    let t = c2 ? c1 / c2 : 0
    t = Math.max(0, Math.min(1, t))
    const px = ax + t * vx
    const py = ay + t * vy
    const d = Math.hypot(pt.x - px, pt.y - py)
    if (d < bestDist) { bestDist = d; best = w }
  }
  return bestDist < 0.25 ? best : null
}

const onCanvasClick = (e) => {
  const rect = e.currentTarget.getBoundingClientRect()
  const pt = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
  if (mode.value === 'select') {
    const w = nearestWall(pt)
    if (w) {
      if (w.loadBearing) { w.loadBearing = false; w.wallType = 'перегородка' } else { w.loadBearing = true; w.wallType = 'несущая' }
    }
  } else if (mode.value === 'addWall') {
    if (!addingWall.value) { addingWall.value = { start: pt } } else {
      const nw = { id: `W${Date.now()}`, start: addingWall.value.start, end: pt, loadBearing: false, thickness: 0.12, wallType: 'перегородка' }
      walls.value = [...walls.value, nw]
      addingWall.value = null
    }
  } else if (mode.value === 'removeWall') {
    const w = nearestWall(pt)
    if (w) walls.value = walls.value.filter((x) => x.id !== w.id)
  }
}

const draw = () => {
  const c = canvas2d.value
  if (!c) return
  const parent = c.parentElement
  const w = parent.clientWidth
  const h = parent.clientHeight
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h }
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#0f1324'
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = '#1f2540'
  ctx.lineWidth = 1
  for (let gx = ((-view.x / view.scale) | 0) - 1; gx < ((w - view.x) / view.scale) + 1; gx++) {
    const sx = gx * view.scale + view.x
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke()
  }
  for (let gy = ((-view.y / view.scale) | 0) - 1; gy < ((h - view.y) / view.scale) + 1; gy++) {
    const sy = gy * view.scale + view.y
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke()
  }

  for (const room of geometry.value.rooms || []) {
    const verts = room.vertices || []
    if (!verts.length) continue
    ctx.beginPath()
    const p0 = worldToScreen(verts[0].x, verts[0].y)
    ctx.moveTo(p0.sx, p0.sy)
    for (let i = 1; i < verts.length; i++) {
      const p = worldToScreen(verts[i].x, verts[i].y)
      ctx.lineTo(p.sx, p.sy)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(125,139,255,0.08)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(125,139,255,0.35)'
    ctx.stroke()
  }

  for (const wline of walls.value) {
    const a = worldToScreen(wline.start.x, wline.start.y)
    const b = worldToScreen(wline.end.x, wline.end.y)
    ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy)
    ctx.lineWidth = Math.max(2, wline.thickness * view.scale)
    ctx.strokeStyle = wline.loadBearing ? '#7dff8e' : '#e9ecf8'
    ctx.stroke()
  }

  requestAnimationFrame(draw)
}

const attachUnity = () => { unityConnected.value = true }
const sendGeometryToUnity = () => {}

watch([geometry, walls], () => { if (unityConnected.value) sendGeometryToUnity() })

onMounted(() => { draw() })
</script>

<style scoped>
.constructor { margin: 36px auto 96px; max-width: 1400px; padding: 0 16px; display: flex; flex-direction: column; gap: 20px; }
.constructor__header { padding: 24px; border-radius: 24px; background: linear-gradient(135deg, rgba(47,93,255,0.18), rgba(32,201,151,0.12)); border: 1px solid rgba(255,255,255,0.12); display: flex; justify-content: space-between; align-items: flex-start; }
.constructor__eyebrow { text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; margin-bottom: 6px; color: #d3d8ff; }
.constructor__header-actions { display: flex; gap: 12px; }
.constructor__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.constructor__panel { border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; background: #141829; display: flex; flex-direction: column; }
.constructor__toolbar { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; gap: 8px; align-items: center; }
.constructor__spacer { flex: 1; }
.constructor__canvas-wrap { position: relative; height: 520px; }
.constructor__canvas-wrap canvas { width: 100%; height: 100%; display: block; }
.constructor__legend { padding: 8px 12px; display: flex; gap: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
.legend { font-size: 12px; color: #c7d3ff; }
.legend--load { color: #7dff8e; }
.legend--part { color: #e9ecf8; }
.unity__host { position: relative; height: 520px; display: grid; place-items: center; }
.unity__placeholder { text-align: center; color: #c7cbe0; }
.unity__connected { text-align: center; color: #8ef59b; }
@media (max-width: 1024px) { .constructor__grid { grid-template-columns: 1fr; } .constructor__canvas-wrap, .unity__host { height: 440px; } }
@media (max-width: 480px) { .constructor__header { border-radius: 20px; padding: 20px; } .constructor__panel { border-radius: 16px; } }
</style>
