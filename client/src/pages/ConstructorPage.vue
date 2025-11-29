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
          <button class="chip" @click="resetView" :disabled="!attachedProject">Сброс вида</button>
          <button class="chip" @click="openAttach" v-if="!attachedProject">Прикрепить проект</button>
          <button class="chip" @click="changeAttachment" v-else>Сменить проект</button>
        </div>
        <div v-if="attachedProject" class="constructor__canvas-wrap" @wheel.prevent="onWheel" @mousedown="onPointerDown" @mousemove="onPointerMove" @mouseup="onPointerUp" @mouseleave="onPointerUp" @click="onCanvasClick" @touchstart="onTouchStart" @touchmove.prevent="onTouchMove" @touchend="onTouchEnd" @touchcancel="onTouchEnd">
          <canvas ref="canvas2d"></canvas>
        </div>
        <div v-else class="attach__wrap">
          <div class="attach__card">
            <h3>Прикрепить проект</h3>
            <p>Выберите один из ваших проектов, чтобы открыть его в редакторе.</p>
            <div class="attach__actions">
              <button class="btn btn--primary" @click="openAttach" :disabled="isAttachLoading">{{ isAttachLoading ? 'Загрузка…' : 'Выбрать проект' }}</button>
            </div>
            <div v-if="isSelecting" class="attach__list">
              <label v-for="p in availableProjects" :key="p.id" class="attach__item">
                <input type="radio" v-model="selectedProjectId" :value="p.id" />
                <div class="attach__meta">
                  <strong>Проект #{{ p.id }}</strong>
                  <small>{{ p.plan.address }} · {{ p.plan.area }} м²</small>
                </div>
              </label>
              <div class="attach__actions">
                <button class="btn btn--ghost btn--small" @click="cancelSelecting">Отмена</button>
                <button class="btn btn--primary btn--small" @click="attachSelected" :disabled="!selectedProjectId">Прикрепить</button>
              </div>
            </div>
          </div>
        </div>
        <div v-if="attachedProject" class="constructor__legend">
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

const attachedProject = ref(null)
const availableProjects = ref([])
const isSelecting = ref(false)
const isAttachLoading = ref(false)
const selectedProjectId = ref(null)

const view = reactive({ x: 0, y: 0, scale: 70, dragging: false, lastX: 0, lastY: 0 })
const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? Math.max(1, window.devicePixelRatio) : 1

const canvasSize = computed(() => ({ w: 0, h: 0 }))

const setMode = (m) => { mode.value = m; addingWall.value = null }
const setViewMode = (m) => { viewMode.value = m }
const resetView = () => { view.x = 0; view.y = 0; view.scale = 60 }

const worldToScreen = (x, y) => ({ sx: x * view.scale + view.x, sy: y * view.scale + view.y })
const screenToWorld = (sx, sy) => ({ x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale })
const snap = (pt, step = 0.1) => ({ x: Math.round(pt.x / step) * step, y: Math.round(pt.y / step) * step })

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

const pinch = reactive({ active: false, startDist: 0, startScale: 0, cx: 0, cy: 0 })

const onTouchStart = (e) => {
  if (e.touches.length === 1) {
    const t = e.touches[0]
    view.dragging = true
    view.lastX = t.clientX
    view.lastY = t.clientY
  } else if (e.touches.length >= 2) {
    const rect = e.currentTarget.getBoundingClientRect()
    const t0 = e.touches[0]
    const t1 = e.touches[1]
    const dx = t1.clientX - t0.clientX
    const dy = t1.clientY - t0.clientY
    pinch.active = true
    pinch.startDist = Math.hypot(dx, dy)
    pinch.startScale = view.scale
    pinch.cx = ((t0.clientX + t1.clientX) / 2) - rect.left
    pinch.cy = ((t0.clientY + t1.clientY) / 2) - rect.top
  }
}

const onTouchMove = (e) => {
  if (pinch.active && e.touches.length >= 2) {
    const rect = e.currentTarget.getBoundingClientRect()
    const t0 = e.touches[0]
    const t1 = e.touches[1]
    const dx = t1.clientX - t0.clientX
    const dy = t1.clientY - t0.clientY
    const factor = pinch.startDist ? Math.max(0.5, Math.min(2, Math.hypot(dx, dy) / pinch.startDist)) : 1
    const before = screenToWorld(pinch.cx, pinch.cy)
    view.scale = Math.min(180, Math.max(20, pinch.startScale * factor))
    const after = screenToWorld(pinch.cx, pinch.cy)
    view.x += (before.x - after.x) * view.scale
    view.y += (before.y - after.y) * view.scale
  } else if (view.dragging && e.touches.length === 1) {
    const t = e.touches[0]
    const dx = t.clientX - view.lastX
    const dy = t.clientY - view.lastY
    view.x += dx
    view.y += dy
    view.lastX = t.clientX
    view.lastY = t.clientY
  }
}

const onTouchEnd = () => {
  if (pinch.active) pinch.active = false
  view.dragging = false
}

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
    const s = snap(pt)
    if (!addingWall.value) { addingWall.value = { start: s } } else {
      const nw = { id: `W${Date.now()}`, start: addingWall.value.start, end: s, loadBearing: false, thickness: 0.12, wallType: 'перегородка' }
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
  if (!attachedProject.value) { requestAnimationFrame(draw); return }
  const parent = c.parentElement
  const wCSS = parent.clientWidth
  const hCSS = parent.clientHeight
  const needResize = c.width !== Math.floor(wCSS * dpr) || c.height !== Math.floor(hCSS * dpr)
  if (needResize) { c.width = Math.floor(wCSS * dpr); c.height = Math.floor(hCSS * dpr); c.style.width = wCSS + 'px'; c.style.height = hCSS + 'px' }
  const ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, wCSS, hCSS)
  ctx.fillStyle = '#0f1324'
  ctx.fillRect(0, 0, wCSS, hCSS)

  ctx.strokeStyle = '#1f2540'
  ctx.lineWidth = 1
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const gxStart = Math.floor((-view.x / view.scale)) - 1
  const gxEnd = Math.ceil(((wCSS - view.x) / view.scale)) + 1
  for (let gx = gxStart; gx < gxEnd; gx++) {
    const sx = gx * view.scale + view.x
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, hCSS); ctx.stroke()
  }
  const gyStart = Math.floor((-view.y / view.scale)) - 1
  const gyEnd = Math.ceil(((hCSS - view.y) / view.scale)) + 1
  for (let gy = gyStart; gy < gyEnd; gy++) {
    const sy = gy * view.scale + view.y
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(wCSS, sy); ctx.stroke()
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
    ctx.lineWidth = Math.max(3, wline.thickness * view.scale)
    ctx.strokeStyle = wline.loadBearing ? '#7dff8e' : '#e9ecf8'
    ctx.stroke()
  }

  requestAnimationFrame(draw)
}

const attachUnity = () => { unityConnected.value = true }
const sendGeometryToUnity = () => {}

const openAttach = async () => {
  isAttachLoading.value = true
  await new Promise((r) => setTimeout(r, 400))
  availableProjects.value = [
    { id: 101, plan: { address: 'Москва, ул. Примерная, д. 1', area: 50.9 }, geometry: { rooms: [{ id: 'R1', name: 'Гостиная', height: 2.7, vertices: [{ x: 0, y: 0 }, { x: 5.2, y: 0 }, { x: 5.2, y: 4.1 }, { x: 0, y: 4.1 }] }] }, walls: [{ id: 'W1', start: { x: 0, y: 0 }, end: { x: 5.2, y: 0 }, loadBearing: true, thickness: 0.2, wallType: 'несущая' }] },
    { id: 102, plan: { address: 'СПб, пр. Тестовый, д. 7', area: 68.0 }, geometry: { rooms: [{ id: 'R1', name: 'Кухня', height: 2.7, vertices: [{ x: 0, y: 0 }, { x: 3.6, y: 0 }, { x: 3.6, y: 3.0 }, { x: 0, y: 3.0 }] }] }, walls: [{ id: 'W1', start: { x: 3.6, y: 0 }, end: { x: 3.6, y: 3.0 }, loadBearing: false, thickness: 0.12, wallType: 'перегородка' }] },
    { id: 103, plan: { address: 'Казань, ул. Образцовая, д. 3', area: 42.3 }, geometry: { rooms: [{ id: 'R1', name: 'Спальня', height: 2.7, vertices: [{ x: 0, y: 0 }, { x: 4.2, y: 0 }, { x: 4.2, y: 3.2 }, { x: 0, y: 3.2 }] }] }, walls: [{ id: 'W1', start: { x: 0, y: 3.2 }, end: { x: 4.2, y: 3.2 }, loadBearing: true, thickness: 0.2, wallType: 'несущая' }] },
  ]
  isAttachLoading.value = false
  isSelecting.value = true
}

const attachSelected = () => {
  const p = availableProjects.value.find((x) => String(x.id) === String(selectedProjectId.value))
  if (!p) return
  attachedProject.value = p
  geometry.value = p.geometry || { rooms: [] }
  walls.value = p.walls || []
  isSelecting.value = false
  selectedProjectId.value = null
}

const cancelSelecting = () => { isSelecting.value = false; selectedProjectId.value = null }
const changeAttachment = () => { attachedProject.value = null; isSelecting.value = false; selectedProjectId.value = null }

watch([geometry, walls], () => { if (unityConnected.value) sendGeometryToUnity() })

onMounted(() => { draw() })
</script>

<style scoped>
.constructor { width: 100%; box-sizing: border-box; margin: 36px auto 96px; max-width: 1100px; padding: 0 16px; display: flex; flex-direction: column; gap: 20px; overflow-x: hidden; }
.constructor__header { padding: 24px; border-radius: 24px; background: linear-gradient(135deg, rgba(47,93,255,0.18), rgba(32,201,151,0.12)); border: 1px solid rgba(255,255,255,0.12); display: flex; justify-content: space-between; align-items: flex-start; }
.constructor__eyebrow { text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; margin-bottom: 6px; color: #d3d8ff; }
.constructor__header-actions { display: flex; gap: 12px; }
.constructor__grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 12px; max-width: 100%; }
.constructor__panel { border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; background: #141829; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.constructor__toolbar { position: sticky; top: 0; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; background: rgba(20,24,41,0.85); backdrop-filter: blur(6px); z-index: 2; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.constructor__spacer { flex: 1; }
.constructor__canvas-wrap { position: relative; height: clamp(340px, 55vh, 520px); padding: 8px; }
.constructor__canvas-wrap canvas { width: 100%; height: 100%; display: block; }
.constructor__legend { padding: 8px 12px; display: flex; gap: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
.legend { font-size: 12px; color: #c7d3ff; }
.legend--load { color: #7dff8e; }
.legend--part { color: #e9ecf8; }
.unity__host { position: relative; height: clamp(340px, 55vh, 520px); display: grid; place-items: center; padding: 8px; }
.unity__placeholder { text-align: center; color: #c7cbe0; }
.unity__connected { text-align: center; color: #8ef59b; }
.attach__wrap { position: relative; height: clamp(340px, 55vh, 520px); display: grid; place-items: center; padding: 8px; }
.attach__card { width: 100%; max-width: 520px; padding: 20px; border-radius: 16px; background: #151826; border: 1px solid rgba(255,255,255,0.08); display: grid; gap: 12px; margin: 0 auto; box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
.attach__actions { display: flex; gap: 8px; justify-content: flex-end; }
.attach__list { display: grid; gap: 10px; margin-top: 8px; }
.attach__item { display: flex; gap: 10px; align-items: center; padding: 10px; border-radius: 12px; background: rgba(255,255,255,0.04); }
.attach__meta { display: grid; }
@media (max-width: 1024px) { .constructor__grid { grid-template-columns: 1fr; } }
@media (max-width: 768px) { .constructor { margin: 24px auto 64px; max-width: 780px; } .constructor__header { border-radius: 20px; padding: 20px; flex-direction: column; gap: 12px; } .constructor__panel { border-radius: 16px; } .constructor__canvas-wrap, .unity__host { height: clamp(280px, 45vh, 420px); } }
@media (max-width: 480px) { .constructor__toolbar { gap: 6px; } .constructor__canvas-wrap, .unity__host { height: clamp(240px, 45vh, 360px); } }

:deep(.chip) { padding: 8px 14px; font-size: 13px; }
:deep(.btn) { font-size: 14px; }
@media (max-width: 480px) { :deep(.chip) { padding: 6px 10px; font-size: 12px; } }
</style>
