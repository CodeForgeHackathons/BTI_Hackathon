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
          <button :class="['chip', mode === 'select' && 'chip--active']" @click="setMode('select')">🖱️ Выбор</button>
          <button :class="['chip', mode === 'moveWall' && 'chip--active']" @click="setMode('moveWall')">↔️ Переместить</button>
          <button :class="['chip', mode === 'addWall' && 'chip--active']" @click="setMode('addWall')">➕ Стена</button>
          <button :class="['chip', mode === 'removeWall' && 'chip--active']" @click="setMode('removeWall')">➖ Стена</button>
          <button :class="['chip', mode === 'furniture' && 'chip--active']" @click="setMode('furniture')">🪑 Мебель</button>
          <span class="constructor__spacer"></span>
          <button class="chip" @click="resetView" :disabled="!attachedProject">⟲ Сброс вида</button>
          <button class="chip" @click="openAttach" v-if="!attachedProject">📎 Прикрепить проект</button>
          <button class="chip" @click="changeAttachment" v-else>📎 Сменить проект</button>
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
                <input type="radio" v-model="selectedProjectId" :value="p.id" :disabled="!isAttachable(p)" />
                <div class="attach__meta">
                  <strong>Проект #{{ p.id }}</strong>
                  <small>{{ p.plan.address }} · {{ p.plan.area }} м²</small>
                  <span class="attach__badge" :class="isAttachable(p) ? 'attach__badge--ok' : 'attach__badge--no'">
                    {{ isAttachable(p) ? 'Доступно' : 'Недоступно' }} · {{ p.status }}
                  </span>
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
          <button :class="['chip', viewMode === 'top' && 'chip--active']" @click="setViewMode('top')">⬆️ Сверху</button>
          <button :class="['chip', viewMode === 'fpv' && 'chip--active']" @click="setViewMode('fpv')">👁️ От первого лица</button>
          <span class="constructor__spacer"></span>
          <button class="chip" @click="attachUnity" :disabled="unityConnected">🎮 Подключить Unity</button>
          <button class="chip" @click="sendGeometryToUnity" :disabled="!unityConnected">🔁 Обновить сцену</button>
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
import { graphqlRequest } from '../utils/graphqlClient.js'

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
const movingWall = ref(null)

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

const onPointerDown = (e) => {
  const rect = e.currentTarget.getBoundingClientRect()
  const pt = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
  if (mode.value === 'moveWall') {
    const w = nearestWall(pt)
    if (w) {
      const nearStart = Math.hypot(pt.x - w.start.x, pt.y - w.start.y) < 0.3
      const nearEnd = Math.hypot(pt.x - w.end.x, pt.y - w.end.y) < 0.3
      if (nearStart) {
        movingWall.value = { id: w.id, endpoint: 'start' }
        return
      }
      if (nearEnd) {
        movingWall.value = { id: w.id, endpoint: 'end' }
        return
      }
      movingWall.value = { id: w.id, endpoint: 'segment', offset: { dx: pt.x - w.start.x, dy: pt.y - w.start.y } }
      return
    }
  }
  view.dragging = true; view.lastX = e.clientX; view.lastY = e.clientY
}
const onPointerMove = (e) => {
  if (movingWall.value) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pt = snap(screenToWorld(e.clientX - rect.left, e.clientY - rect.top), 0.05)
    const id = movingWall.value.id
    walls.value = walls.value.map((w) => {
      if (String(w.id) !== String(id)) return w
      if (movingWall.value.endpoint === 'start') {
        return { ...w, start: { x: pt.x, y: pt.y } }
      }
      if (movingWall.value.endpoint === 'end') {
        return { ...w, end: { x: pt.x, y: pt.y } }
      }
      const sx = pt.x - (movingWall.value.offset?.dx || 0)
      const sy = pt.y - (movingWall.value.offset?.dy || 0)
      const ex = sx + (w.end.x - w.start.x)
      const ey = sy + (w.end.y - w.start.y)
      return { ...w, start: { x: sx, y: sy }, end: { x: ex, y: ey } }
    })
    return
  }
  if (!view.dragging) return
  const dx = e.clientX - view.lastX
  const dy = e.clientY - view.lastY
  view.x += dx
  view.y += dy
  view.lastX = e.clientX
  view.lastY = e.clientY
}
const onPointerUp = () => { view.dragging = false; movingWall.value = null }

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
      // Переключаем тип стены и нормализуем
      const newLoadBearing = !w.loadBearing
      walls.value = walls.value.map(wall => {
        if (wall.id === w.id) {
          return normalizeWall({ ...wall, loadBearing: newLoadBearing })
        }
        return wall
      })
    }
  } else if (mode.value === 'addWall') {
    const s = snap(pt)
    if (!addingWall.value) { addingWall.value = { start: s } } else {
      const nw = normalizeWall({ id: `W${Date.now()}`, start: addingWall.value.start, end: s, loadBearing: false, thickness: 0.12, wallType: 'перегородка' })
      walls.value = [...walls.value, nw]
      addingWall.value = null
    }
  } else if (mode.value === 'removeWall') {
    const w = nearestWall(pt)
    if (w) walls.value = walls.value.filter((x) => x.id !== w.id)
  }
}

// Функция для вычисления прямоугольника стены на основе двух параллельных линий
const calculateWallRectangle = (wall) => {
  const { start, end, thickness } = wall
  
  // Вычисляем направление стены
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.sqrt(dx * dx + dy * dy)
  
  if (length === 0) return null
  
  // Нормализованный перпендикулярный вектор
  const perpX = -dy / length
  const perpY = dx / length
  
  // Смещение для толщины стены
  const offsetX = perpX * thickness / 2
  const offsetY = perpY * thickness / 2
  
  // Четыре угла прямоугольника стены
  return {
    p1: { x: start.x + offsetX, y: start.y + offsetY },
    p2: { x: start.x - offsetX, y: start.y - offsetY },
    p3: { x: end.x - offsetX, y: end.y - offsetY },
    p4: { x: end.x + offsetX, y: end.y + offsetY }
  }
}

const draw = () => {
  const c = canvas2d.value
  if (!c) {
    requestAnimationFrame(draw)
    return
  }
  
  const parent = c.parentElement
  if (!parent) {
    requestAnimationFrame(draw)
    return
  }
  
  const wCSS = parent.clientWidth
  const hCSS = parent.clientHeight
  
  if (wCSS === 0 || hCSS === 0) {
    requestAnimationFrame(draw)
    return
  }
  
  if (!attachedProject.value) {
    const needResize = c.width !== Math.floor(wCSS * dpr) || c.height !== Math.floor(hCSS * dpr)
    if (needResize) {
      c.width = Math.floor(wCSS * dpr)
      c.height = Math.floor(hCSS * dpr)
      c.style.width = wCSS + 'px'
      c.style.height = hCSS + 'px'
    }
    const ctx = c.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, wCSS, hCSS)
    ctx.fillStyle = '#0f1324'
    ctx.fillRect(0, 0, wCSS, hCSS)
    requestAnimationFrame(draw)
    return
  }
  
  const needResize = c.width !== Math.floor(wCSS * dpr) || c.height !== Math.floor(hCSS * dpr)
  if (needResize) { 
    c.width = Math.floor(wCSS * dpr)
    c.height = Math.floor(hCSS * dpr)
    c.style.width = wCSS + 'px'
    c.style.height = hCSS + 'px'
  }
  
  const ctx = c.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, wCSS, hCSS)
  ctx.fillStyle = '#0f1324'
  ctx.fillRect(0, 0, wCSS, hCSS)

  // Сетка
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

  // Рисуем комнаты
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

  // Рисуем стены как прямоугольники
  for (const wall of walls.value) {
    const rect = calculateWallRectangle(wall)
    if (!rect) continue

    const p1 = worldToScreen(rect.p1.x, rect.p1.y)
    const p2 = worldToScreen(rect.p2.x, rect.p2.y)
    const p3 = worldToScreen(rect.p3.x, rect.p3.y)
    const p4 = worldToScreen(rect.p4.x, rect.p4.y)

    ctx.beginPath()
    ctx.moveTo(p1.sx, p1.sy)
    ctx.lineTo(p2.sx, p2.sy)
    ctx.lineTo(p3.sx, p3.sy)
    ctx.lineTo(p4.sx, p4.sy)
    ctx.closePath()

    // Заливка в зависимости от типа стены
    if (wall.loadBearing) {
      ctx.fillStyle = 'rgba(255, 68, 68, 0.8)' // Красный для несущих
      ctx.strokeStyle = '#ff4444'
    } else {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.8)' // Желтый для перегородок
      ctx.strokeStyle = '#ffd700'
    }
    
    ctx.fill()
    ctx.stroke()
  }

  requestAnimationFrame(draw)
}

// Функция для преобразования данных в формат для Unity
const prepareUnityData = () => {
  if (!attachedProject.value) return null

  // Собираем все уникальные точки из стен
  const allPoints = []
  const pointMap = new Map()

  walls.value.forEach(wall => {
    const startKey = `${wall.start.x},${wall.start.y}`
    const endKey = `${wall.end.x},${wall.end.y}`

    if (!pointMap.has(startKey)) {
      pointMap.set(startKey, allPoints.length)
      allPoints.push({ x: wall.start.x, y: wall.start.y })
    }

    if (!pointMap.has(endKey)) {
      pointMap.set(endKey, allPoints.length)
      allPoints.push({ x: wall.end.x, y: wall.end.y })
    }
  })

  // Создаем connections (индексы точек)
  const connections = []
  walls.value.forEach(wall => {
    const startKey = `${wall.start.x},${wall.start.y}`
    const endKey = `${wall.end.x},${wall.end.y}`

    const startIndex = pointMap.get(startKey)
    const endIndex = pointMap.get(endKey)

    connections.push(startIndex, endIndex)
  })

  // Высота стен (по умолчанию 2.5м)
  const wallHeights = walls.value.map(() => 2.5)

  // Толщина стен из данных
  const wallThicknesses = walls.value.map(wall => wall.thickness || 0.2)

  // Окна и двери (пока пустые массивы, можно расширить функционал)
  const windows = []
  const doors = []

  const unityData = {
    points: allPoints,
    connections: connections,
    wallHeights: wallHeights,
    wallThicknesses: wallThicknesses,
    windows: windows,
    doors: doors
  }

  console.log('[Unity] Prepared data for Unity:', unityData)
  return unityData
}

// Функция отправки данных в Unity
const sendDataToUnity = () => {
  if (typeof window === 'undefined' || !window.SendMessage) {
    console.warn('[Unity] SendMessage not available - Unity not loaded or not in WebGL build')
    return false
  }

  const unityData = prepareUnityData()
  if (!unityData) {
    console.warn('[Unity] No data to send to Unity')
    return false
  }

  try {
    // Отправляем данные в Unity
    window.SendMessage('SceneController', 'LoadLayoutData', JSON.stringify(unityData))
    console.log('[Unity] Data sent to Unity successfully')
    return true
  } catch (error) {
    console.error('[Unity] Error sending data to Unity:', error)
    return false
  }
}

const attachUnity = () => {
  unityConnected.value = true
  // Автоматически отправляем данные при подключении Unity
  setTimeout(() => {
    sendDataToUnity()
  }, 1000)
}

const sendGeometryToUnity = () => {
  if (!unityConnected.value) {
    console.warn('[Unity] Unity not connected')
    return
  }

  const success = sendDataToUnity()
  if (success) {
    console.log('[Unity] Geometry updated in Unity scene')
  }
}

const GET_USER_PROJECTS_QUERY = `
  query GetUserProjects($user_id: ID!) {
    getUserProjects(user_id: $user_id) {
      id
      status
      createdAt
      clientTimestamp
      plan { address area source layoutType familyProfile goal prompt ceilingHeight floorDelta recognitionStatus }
      geometry { rooms { id name height vertices { x y } } }
      walls { id start { x y } end { x y } loadBearing thickness wallType }
      constraints { forbiddenMoves regionRules }
    }
  }
`

const getStoredUserId = () => {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('homeplanner3d:userId') : null } catch { return null }
}

const openAttach = async () => {
  isAttachLoading.value = true
  availableProjects.value = []
  selectedProjectId.value = null

  const userId = getStoredUserId()
  if (!userId) {
    isAttachLoading.value = false
    isSelecting.value = true
    return
  }

  try {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('homeplanner3d:projectsFilter', 'legal')
      }
    } catch {}
    const data = await graphqlRequest(GET_USER_PROJECTS_QUERY, { user_id: String(userId) })
    const projects = Array.isArray(data?.getUserProjects) ? data.getUserProjects : []
    console.log('[Attach] userId=', userId, 'filter=legal', 'projects count=', projects.length)
    console.log('[Attach] Projects data:', projects.map(p => ({
      id: p.id,
      status: p.status,
      wallsCount: p.walls?.length || 0,
      roomsCount: p.geometry?.rooms?.length || 0,
      hasWalls: !!p.walls,
      hasGeometry: !!p.geometry
    })))
    availableProjects.value = projects
  } catch (e) {
    console.warn('Не удалось загрузить проекты пользователя:', e)
    availableProjects.value = []
  } finally {
    isAttachLoading.value = false
    isSelecting.value = true
  }
}

const isAttachableStatus = (st) => {
  if (!st) return false
  const s = String(st).toLowerCase()
  const allow = ['allowed','ready','approved','active','ok','success','done','доступно','разрешено','готово','можно','можно при услов']
  const deny = ['forbid','forbidden','denied','blocked','ban','pending','processing','error','failed','archiv','delete','draft','нельзя','запрещ','ожид','обработ','не может быть одобрен']
  if (deny.some((k) => s.includes(k))) return false
  if (allow.some((k) => s.includes(k))) return true
  return false
}

const isAttachable = (p) => isAttachableStatus(p?.status)

// Функция для объединения близких точек
const mergeCloseVertices = (vertices, threshold = 0.01) => {
  const result = []
  for (const v of vertices) {
    const existing = result.find(r =>
      Math.abs(r.x - v.x) < threshold && Math.abs(r.y - v.y) < threshold
    )
    if (!existing) {
      result.push(v)
    }
  }
  return result
}

// Нормализует тип стены и синхронизирует с loadBearing
const normalizeWall = (wall) => {
  if (!wall) return null

  let normalizedType = String(wall.wallType || '').toLowerCase().trim()

  // Более точное определение типа стены из существующих данных
  const isLoadBearingFromType = normalizedType.includes('несущ') ||
                               normalizedType.includes('bearing') ||
                               normalizedType === 'loadbearing' ||
                               normalizedType === 'несущая'

  // Определяем толщину на основе типа
  const thickness = wall.thickness || (isLoadBearingFromType ? 0.2 : 0.12)

  // Приоритет: явное значение > значение из типа > по умолчанию перегородка
  const loadBearing = wall.loadBearing !== undefined
    ? Boolean(wall.loadBearing)
    : isLoadBearingFromType

  // Нормализуем wallType на основе loadBearing
  if (loadBearing) {
    normalizedType = 'несущая'
  } else {
    normalizedType = 'перегородка'
  }

  return {
    ...wall,
    loadBearing,
    thickness,
    wallType: normalizedType
  }
}

// Улучшенная функция построения стен из геометрии - убирает дублирование
const buildWallsFromGeometry = (geom) => {
  const out = []
  if (!geom || !Array.isArray(geom.rooms)) return out

  // Собираем все сегменты стен из всех комнат
  const allSegments = []

  for (const room of geom.rooms) {
    const verts = Array.isArray(room.vertices) ? room.vertices : []
    const mergedVerts = mergeCloseVertices(verts)

    for (let i = 0; i < mergedVerts.length; i++) {
      const a = mergedVerts[i]
      const b = mergedVerts[(i + 1) % mergedVerts.length]

      // Создаем сегмент с нормализованными координатами (всегда от меньшей к большей)
      const segment = {
        start: { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
        end: { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
        roomId: room.id
      }

      allSegments.push(segment)
    }
  }

  // Группируем сегменты по координатам для нахождения общих стен
  const segmentMap = new Map()

  for (const segment of allSegments) {
    const key = `${segment.start.x},${segment.start.y}-${segment.end.x},${segment.end.y}`

    if (!segmentMap.has(key)) {
      segmentMap.set(key, {
        segment,
        count: 1,
        rooms: new Set([segment.roomId])
      })
    } else {
      const existing = segmentMap.get(key)
      existing.count++
      existing.rooms.add(segment.roomId)
    }
  }

  // Создаем стены на основе сегментов
  let wallId = 1
  for (const [key, data] of segmentMap.entries()) {
    const { segment, count, rooms } = data

    // Если сегмент встречается только в одной комнате - это внешняя стена (несущая)
    // Если в двух и более комнатах - это внутренняя стена (перегородка)
    const isExternal = count === 1
    const isLoadBearing = isExternal

    out.push({
      id: `GW${wallId++}`,
      start: segment.start,
      end: segment.end,
      loadBearing: isLoadBearing,
      thickness: isLoadBearing ? 0.2 : 0.12,
      wallType: isLoadBearing ? 'несущая' : 'перегородка',
      rooms: Array.from(rooms)
    })
  }

  console.log(`[Geometry] Built ${out.length} walls from ${allSegments.length} segments (${out.filter(w => w.loadBearing).length} load-bearing)`)
  return out
}

const attachSelected = () => {
  const p = availableProjects.value.find((x) => String(x.id) === String(selectedProjectId.value))
  if (!p || !isAttachable(p)) {
    console.warn('[Constructor] Project not attachable:', p?.id, p?.status)
    return
  }

  console.log('[Constructor] Attaching project:', p.id, 'walls:', p.walls?.length, 'rooms:', p.geometry?.rooms?.length)

  attachedProject.value = p
  geometry.value = p.geometry || { rooms: [] }
  const initialWalls = Array.isArray(p.walls) ? p.walls : []

  if (initialWalls.length) {
    // Нормализуем существующие стены
    walls.value = initialWalls.map(normalizeWall).filter(w => w !== null)
    console.log('[Constructor] Normalized walls:', walls.value.length,
                'loadBearing:', walls.value.filter(w => w.loadBearing).length,
                'partitions:', walls.value.filter(w => !w.loadBearing).length)
  } else {
    // Строим стены из геометрии с улучшенной логикой
    walls.value = buildWallsFromGeometry(p.geometry)
    console.log('[Constructor] Built walls from geometry:', walls.value.length,
                'loadBearing:', walls.value.filter(w => w.loadBearing).length,
                'partitions:', walls.value.filter(w => !w.loadBearing).length)
  }

  isSelecting.value = false
  selectedProjectId.value = null

  // Убеждаемся, что канвас перерисуется
  setTimeout(() => {
    fitViewToProject()
    // Принудительно запускаем перерисовку
    if (canvas2d.value) {
      draw()
    }

    // Автоматически отправляем данные в Unity если подключен
    if (unityConnected.value) {
      setTimeout(() => {
        sendDataToUnity()
      }, 500)
    }
  }, 100)
}

const cancelSelecting = () => { isSelecting.value = false; selectedProjectId.value = null }
const changeAttachment = () => { attachedProject.value = null; isSelecting.value = false; selectedProjectId.value = null }

watch([geometry, walls], () => {
  if (unityConnected.value) {
    // Автоматически обновляем Unity при изменении геометрии
    setTimeout(() => {
      sendDataToUnity()
    }, 300)
  }
})

// Отслеживаем изменения attachedProject для перерисовки
watch(attachedProject, (newVal) => {
  console.log('[Constructor] attachedProject changed:', newVal ? `Project ${newVal.id}` : 'null')
  if (newVal && canvas2d.value) {
    setTimeout(() => {
      fitViewToProject()
      draw()
    }, 50)
  }
})

onMounted(() => {
  console.log('[Constructor] Component mounted, starting draw loop')
  draw()
})

const fitViewToProject = () => {
  const c = canvas2d.value
  if (!c) return
  const parent = c.parentElement
  const wCSS = parent.clientWidth
  const hCSS = parent.clientHeight
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const w of walls.value) {
    minX = Math.min(minX, w.start.x, w.end.x)
    minY = Math.min(minY, w.start.y, w.end.y)
    maxX = Math.max(maxX, w.start.x, w.end.x)
    maxY = Math.max(maxY, w.start.y, w.end.y)
  }
  for (const room of geometry.value.rooms || []) {
    for (const v of room.vertices || []) {
      minX = Math.min(minX, v.x); minY = Math.min(minY, v.y)
      maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y)
    }
  }
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return
  const contentW = Math.max(1, maxX - minX)
  const contentH = Math.max(1, maxY - minY)
  const margin = 20
  const scaleX = (wCSS - margin * 2) / contentW
  const scaleY = (hCSS - margin * 2) / contentH
  view.scale = Math.min(180, Math.max(20, Math.min(scaleX, scaleY)))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  view.x = wCSS / 2 - cx * view.scale
  view.y = hCSS / 2 - cy * view.scale
}

watch(selectedProjectId, (val) => {
  console.log('[Constructor] selectedProjectId changed:', val)
  if (val) {
    console.log('[Constructor] Auto-attaching project:', val)
    attachSelected()
  }
})
</script>

<style scoped>
.constructor { width: 100%; box-sizing: border-box; margin: 36px auto 96px; max-width: 1100px; padding: 0 16px; display: flex; flex-direction: column; gap: 20px; overflow-x: hidden; }
.constructor__header { padding: 24px; border-radius: 24px; background: linear-gradient(135deg, rgba(47,93,255,0.18), rgba(32,201,151,0.12)); border: 1px solid rgba(255,255,255,0.12); display: flex; justify-content: space-between; align-items: flex-start; }
.constructor__eyebrow { text-transform: uppercase; letter-spacing: 0.12em; font-size: 12px; margin-bottom: 6px; color: #d3d8ff; }
.constructor__header-actions { display: flex; gap: 12px; }
.constructor__grid { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 12px; max-width: 100%; }
.constructor__panel { border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; background: #141829; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.constructor__toolbar { position: sticky; top: 0; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; gap: 8px; align-items: center; flex-wrap: nowrap; background: rgba(20,24,41,0.85); backdrop-filter: blur(6px); z-index: 2; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.constructor__spacer { flex: 1; }
.constructor__canvas-wrap { position: relative; height: clamp(340px, 55vh, 520px); padding: 8px; }
.constructor__canvas-wrap canvas { width: 100%; height: 100%; display: block; }
.constructor__legend { padding: 8px 12px; display: flex; gap: 12px; border-top: 1px solid rgba(255,255,255,0.06); }
.legend { font-size: 12px; color: #c7d3ff; }
.legend--load { color: #ff4444; }
.legend--part { color: #ffd700; }
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
@media (max-width: 768px) { .constructor { margin: 24px auto 64px; max-width: 780px; } .constructor__header { border-radius: 20px; padding: 20px; flex-direction: column; gap: 12px; } .constructor__panel { border-radius: 16px; } .constructor__canvas-wrap, .unity__host { height: clamp(280px, 45vh, 420px); } .constructor__toolbar { flex-direction: column; align-items: stretch; overflow-x: hidden; } .constructor__spacer { display: none; } }
@media (max-width: 480px) { .constructor__toolbar { gap: 6px; } .constructor__canvas-wrap, .unity__host { height: clamp(240px, 45vh, 360px); } }

:deep(.chip) { padding: 8px 14px; font-size: 13px; }
:deep(.btn) { font-size: 14px; }
@media (max-width: 480px) { :deep(.chip) { padding: 6px 10px; font-size: 12px; } }
@media (max-width: 768px) { :deep(.chip) { width: 100%; justify-content: flex-start; } }
</style>