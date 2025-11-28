/**
 * Утилиты для обработки изображений планов помещений
 * Распознавание стен, комнат и геометрии на клиенте
 */

/**
 * Загружает изображение из файла или base64
 */
export async function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Загружает изображение из base64 строки
 */
export async function loadImageFromBase64(base64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = base64;
  });
}

/**
 * Преобразует изображение в Canvas для обработки
 */
export function imageToCanvas(image, maxWidth = 2048, maxHeight = 2048) {
  const canvas = document.createElement('canvas');
  let { width, height } = image;
  
  // Масштабируем для оптимизации производительности
  if (width > maxWidth || height > maxHeight) {
    const scale = Math.min(maxWidth / width, maxHeight / height);
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);
  }
  
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  
  return { canvas, width, height, ctx };
}

/**
 * Преобразует изображение в grayscale
 */
export function grayscale(canvas, ctx) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;     // R
    data[i + 1] = gray; // G
    data[i + 2] = gray; // B
  }
  
  ctx.putImageData(imageData, 0, 0);
  return imageData;
}

/**
 * Применяет пороговое значение (threshold) для бинаризации
 */
export function threshold(imageData, threshold = 128) {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    const binary = gray > threshold ? 255 : 0;
    data[i] = binary;
    data[i + 1] = binary;
    data[i + 2] = binary;
  }
  
  return imageData;
}

/**
 * Упрощённое обнаружение краёв (Sobel оператор)
 */
export function detectEdges(canvas, ctx) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  const output = new ImageData(width, height);
  
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const gray = data[idx];
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          gx += gray * sobelX[kernelIdx];
          gy += gray * sobelY[kernelIdx];
        }
      }
      
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      const idx = (y * width + x) * 4;
      const value = Math.min(255, magnitude);
      output.data[idx] = value;
      output.data[idx + 1] = value;
      output.data[idx + 2] = value;
      output.data[idx + 3] = 255;
    }
  }
  
  return output;
}

/**
 * Упрощённое обнаружение линий (Hough Transform approximation)
 * Находит горизонтальные и вертикальные линии (стены)
 */
export function detectLines(imageData, width, height, minLength = 50, edgeThreshold = 110) {
  const data = imageData.data;
  const lines = [];
  const visited = new Set();
  const maxGap = Math.max(3, Math.floor(minLength * 0.05));
  
  // Снижаем порог для вертикальных линий (они часто слабее на планах)
  const verticalThreshold = Math.max(90, edgeThreshold - 20);
  
  // Ищем горизонтальные линии
  for (let y = 0; y < height; y++) {
    let lineStart = null;
    let lineLength = 0;
    let gapCount = 0;
    
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const value = data[idx];
      
      if (value > edgeThreshold) {
        if (lineStart === null) {
          lineStart = x;
          lineLength = 1;
          gapCount = 0;
        } else {
          lineLength++;
          gapCount = 0;
        }
      } else {
        if (lineStart !== null && gapCount < maxGap) {
          gapCount++;
          lineLength++;
          continue;
        }

        if (lineStart !== null && lineLength >= minLength) {
          addLine(lines, visited, {
            type: 'horizontal',
            start: { x: lineStart, y },
            end: { x: x - 1, y },
            length: lineLength
          });
        }
        lineStart = null;
        lineLength = 0;
        gapCount = 0;
      }
    }
    
    // Проверяем последнюю линию в строке
    if (lineStart !== null && lineLength >= minLength) {
      addLine(lines, visited, {
        type: 'horizontal',
        start: { x: lineStart, y },
        end: { x: width - 1, y },
        length: lineLength
      });
    }
  }
  
  // Ищем вертикальные линии (с более низким порогом)
  for (let x = 0; x < width; x++) {
    let lineStart = null;
    let lineLength = 0;
    let gapCount = 0;
    
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const value = data[idx];
      
      if (value > verticalThreshold) {
        if (lineStart === null) {
          lineStart = y;
          lineLength = 1;
          gapCount = 0;
        } else {
          lineLength++;
          gapCount = 0;
        }
      } else {
        if (lineStart !== null && gapCount < maxGap) {
          gapCount++;
          lineLength++;
          continue;
        }

        if (lineStart !== null && lineLength >= minLength) {
          addLine(lines, visited, {
            type: 'vertical',
            start: { x, y: lineStart },
            end: { x, y: y - 1 },
            length: lineLength
          });
        }
        lineStart = null;
        lineLength = 0;
        gapCount = 0;
      }
    }
    
    if (lineStart !== null && lineLength >= minLength) {
      addLine(lines, visited, {
        type: 'vertical',
        start: { x, y: lineStart },
        end: { x, y: height - 1 },
        length: lineLength
      });
    }
  }
  
  return lines;
}

function addLine(lines, visited, line) {
  const key =
    line.type === 'horizontal'
      ? `h_${line.start.y}_${Math.round(line.start.x / 5)}_${Math.round(line.end.x / 5)}`
      : `v_${line.start.x}_${Math.round(line.start.y / 5)}_${Math.round(line.end.y / 5)}`;

  if (visited.has(key)) return;
  visited.add(key);
  lines.push(line);
}

/**
 * Конвертирует координаты пикселей в реальные метры
 * Использует пропорции и предполагаемый масштаб
 */
export function pixelsToMeters(pixels, scale = 0.01) {
  return pixels * scale;
}

/**
 * Группирует линии в стены
 * Объединяет близко расположенные линии и определяет тип стены
 */
export function groupLinesIntoWalls(lines, mergeDistance = 5, dedupeTolerance = 6) {
  const walls = [];
  const processed = new Set();
  
  for (let i = 0; i < lines.length; i++) {
    if (processed.has(i)) continue;
    
    const line = lines[i];
    const wall = {
      start: { ...line.start },
      end: { ...line.end },
      type: line.type,
      thickness: 0.12, // По умолчанию ненесущая
      loadBearing: false
    };
    
    // Ищем близко расположенные линии для объединения
    for (let j = i + 1; j < lines.length; j++) {
      if (processed.has(j)) continue;
      
      const otherLine = lines[j];
      if (otherLine.type !== line.type) continue;
      
      const distance = calculateLineDistance(line, otherLine);
      if (distance < mergeDistance) {
        // Объединяем линии
        if (line.type === 'horizontal') {
          wall.start.x = Math.min(wall.start.x, otherLine.start.x);
          wall.end.x = Math.max(wall.end.x, otherLine.end.x);
          wall.start.y = (wall.start.y + otherLine.start.y) / 2;
          wall.end.y = wall.start.y;
        } else {
          wall.start.y = Math.min(wall.start.y, otherLine.start.y);
          wall.end.y = Math.max(wall.end.y, otherLine.end.y);
          wall.start.x = (wall.start.x + otherLine.start.x) / 2;
          wall.end.x = wall.start.x;
        }
        processed.add(j);
      }
    }
    
    // Определяем тип стены по толщине (упрощённо)
    const length = Math.sqrt(
      Math.pow(wall.end.x - wall.start.x, 2) + 
      Math.pow(wall.end.y - wall.start.y, 2)
    );
    if (length > 200) { // Длинные стены чаще несущие
      wall.loadBearing = true;
      wall.thickness = 0.4;
    }
    
    walls.push(wall);
    processed.add(i);
  }
  
  return dedupeWalls(walls, dedupeTolerance);
}

function dedupeWalls(walls, tolerance = 6) {
  const result = [];

  walls.forEach((wall) => {
    // Ищем перекрывающиеся стены (не только точное совпадение)
    const match = result.find((existing) => {
      if (existing.type !== wall.type) return false;
      
      // Проверяем, перекрываются ли сегменты
      if (wall.type === 'horizontal') {
        // Горизонтальные стены: проверяем Y координату и перекрытие по X
        const yDiff = Math.abs(existing.start.y - wall.start.y);
        if (yDiff > tolerance) return false;
        
        // Проверяем перекрытие по X
        const existingLeft = Math.min(existing.start.x, existing.end.x);
        const existingRight = Math.max(existing.start.x, existing.end.x);
        const wallLeft = Math.min(wall.start.x, wall.end.x);
        const wallRight = Math.max(wall.start.x, wall.end.x);
        
        // Перекрываются если есть пересечение
        return !(wallRight < existingLeft - tolerance || wallLeft > existingRight + tolerance);
      } else {
        // Вертикальные стены: проверяем X координату и перекрытие по Y
        const xDiff = Math.abs(existing.start.x - wall.start.x);
        if (xDiff > tolerance) return false;
        
        // Проверяем перекрытие по Y
        const existingTop = Math.min(existing.start.y, existing.end.y);
        const existingBottom = Math.max(existing.start.y, existing.end.y);
        const wallTop = Math.min(wall.start.y, wall.end.y);
        const wallBottom = Math.max(wall.start.y, wall.end.y);
        
        // Перекрываются если есть пересечение
        return !(wallBottom < existingTop - tolerance || wallTop > existingBottom + tolerance);
      }
    });

    if (match) {
      // Объединяем сегменты
      if (wall.type === 'horizontal') {
        match.start.x = Math.min(match.start.x, wall.start.x, wall.end.x);
        match.end.x = Math.max(match.end.x, wall.start.x, wall.end.x);
        match.start.y = (match.start.y + wall.start.y) / 2;
        match.end.y = match.start.y;
      } else {
        match.start.y = Math.min(match.start.y, wall.start.y, wall.end.y);
        match.end.y = Math.max(match.end.y, wall.start.y, wall.end.y);
        match.start.x = (match.start.x + wall.start.x) / 2;
        match.end.x = match.start.x;
      }
      
      // РАЗРЕШАЕМ КОНФЛИКТЫ: приоритет несущей стене
      // Если одна стена несущая, а другая ненесущая - оставляем несущую
      if (wall.loadBearing && !match.loadBearing) {
        match.loadBearing = true;
        match.thickness = wall.thickness;
      } else if (!wall.loadBearing && match.loadBearing) {
        // match уже несущая - оставляем как есть
      } else {
        // Обе одного типа - используем более толстую
        if (wall.thickness > match.thickness) {
          match.thickness = wall.thickness;
          match.loadBearing = wall.loadBearing;
        }
      }
    } else {
      result.push({ ...wall });
    }
  });

  return result;
}

/**
 * Удаляет конфликты стен (перекрывающиеся стены с разными типами)
 * Приоритет: несущие стены
 */
export function removeWallConflicts(walls, tolerance = 12) {
  const result = [];
  const processed = new Set();
  
  // Сортируем стены: сначала несущие (приоритет)
  const sortedWalls = [...walls].sort((a, b) => {
    if (a.loadBearing && !b.loadBearing) return -1;
    if (!a.loadBearing && b.loadBearing) return 1;
    return 0;
  });
  
  for (let i = 0; i < sortedWalls.length; i++) {
    if (processed.has(i)) continue;
    
    const wall = sortedWalls[i];
    
    // Ищем перекрывающиеся стены
    for (let j = i + 1; j < sortedWalls.length; j++) {
      if (processed.has(j)) continue;
      
      const otherWall = sortedWalls[j];
      if (wall.type !== otherWall.type) continue;
      
      // Проверяем перекрытие
      const overlaps = wallsOverlap(wall, otherWall, tolerance);
      if (overlaps) {
        // Объединяем стены, приоритет несущей
        if (wall.type === 'horizontal') {
          wall.start.x = Math.min(wall.start.x, otherWall.start.x, otherWall.end.x);
          wall.end.x = Math.max(wall.end.x, otherWall.start.x, otherWall.end.x);
          wall.start.y = (wall.start.y + otherWall.start.y) / 2;
          wall.end.y = wall.start.y;
        } else {
          wall.start.y = Math.min(wall.start.y, otherWall.start.y, otherWall.end.y);
          wall.end.y = Math.max(wall.end.y, otherWall.start.y, otherWall.end.y);
          wall.start.x = (wall.start.x + otherWall.start.x) / 2;
          wall.end.x = wall.start.x;
        }
        
        // Приоритет несущей стене
        if (wall.loadBearing || otherWall.loadBearing) {
          wall.loadBearing = true;
          wall.thickness = Math.max(wall.thickness, otherWall.thickness, 0.4);
        } else {
          wall.thickness = Math.max(wall.thickness, otherWall.thickness);
        }
        
        processed.add(j);
      }
    }
    
    result.push(wall);
    processed.add(i);
  }
  
  return result;
}

/**
 * Находит недостающие стены на основе границ комнат
 * Создаёт вертикальные и горизонтальные стены для незамкнутых границ
 */
export function findMissingWalls(rooms, existingWalls, scale) {
  const missingWalls = [];
  const tolerance = 0.1 / scale; // 10 см в пикселях
  
  // Группируем существующие стены для быстрого поиска
  const horizontalWalls = existingWalls.filter(w => w.type === 'horizontal');
  const verticalWalls = existingWalls.filter(w => w.type === 'vertical');
  
  for (const room of rooms) {
    if (!room.vertices || room.vertices.length < 4) continue;
    
    const vertices = room.vertices;
    
    // Проверяем каждую сторону комнаты
    for (let i = 0; i < vertices.length; i++) {
      const v1 = vertices[i];
      const v2 = vertices[(i + 1) % vertices.length];
      
      // Определяем тип стороны (горизонтальная или вертикальная)
      const isHorizontal = Math.abs(v1.y - v2.y) < tolerance;
      const isVertical = Math.abs(v1.x - v2.x) < tolerance;
      
      if (!isHorizontal && !isVertical) continue; // Диагональная сторона
      
      let wallExists = false;
      
      if (isHorizontal) {
        // Проверяем, есть ли горизонтальная стена для этой стороны
        const y = (v1.y + v2.y) / 2;
        const x1 = Math.min(v1.x, v2.x);
        const x2 = Math.max(v1.x, v2.x);
        
        for (const wall of horizontalWalls) {
          const wallY = wall.start.y;
          const wallX1 = Math.min(wall.start.x, wall.end.x);
          const wallX2 = Math.max(wall.start.x, wall.end.x);
          
          // Проверяем совпадение Y и перекрытие по X
          if (Math.abs(wallY - y) < tolerance) {
            const overlap = !(x2 < wallX1 - tolerance || x1 > wallX2 + tolerance);
            if (overlap) {
              wallExists = true;
              break;
            }
          }
        }
        
        if (!wallExists) {
          // Создаём недостающую горизонтальную стену
          missingWalls.push({
            start: { x: x1, y },
            end: { x: x2, y },
            type: 'horizontal',
            loadBearing: true, // Внутренние стены обычно несущие
            thickness: 0.4
          });
        }
      } else if (isVertical) {
        // Проверяем, есть ли вертикальная стена для этой стороны
        const x = (v1.x + v2.x) / 2;
        const y1 = Math.min(v1.y, v2.y);
        const y2 = Math.max(v1.y, v2.y);
        
        for (const wall of verticalWalls) {
          const wallX = wall.start.x;
          const wallY1 = Math.min(wall.start.y, wall.end.y);
          const wallY2 = Math.max(wall.start.y, wall.end.y);
          
          // Проверяем совпадение X и перекрытие по Y
          if (Math.abs(wallX - x) < tolerance) {
            const overlap = !(y2 < wallY1 - tolerance || y1 > wallY2 + tolerance);
            if (overlap) {
              wallExists = true;
              break;
            }
          }
        }
        
        if (!wallExists) {
          // Создаём недостающую вертикальную стену
          missingWalls.push({
            start: { x, y: y1 },
            end: { x, y: y2 },
            type: 'vertical',
            loadBearing: true, // Внутренние стены обычно несущие
            thickness: 0.4
          });
        }
      }
    }
  }
  
  return missingWalls;
}

/**
 * Проверяет, перекрываются ли две стены
 */
function wallsOverlap(wall1, wall2, tolerance) {
  if (wall1.type !== wall2.type) return false;
  
  if (wall1.type === 'horizontal') {
    const yDiff = Math.abs(wall1.start.y - wall2.start.y);
    if (yDiff > tolerance) return false;
    
    const w1Left = Math.min(wall1.start.x, wall1.end.x);
    const w1Right = Math.max(wall1.start.x, wall1.end.x);
    const w2Left = Math.min(wall2.start.x, wall2.end.x);
    const w2Right = Math.max(wall2.start.x, wall2.end.x);
    
    return !(w1Right < w2Left - tolerance || w1Left > w2Right + tolerance);
  } else {
    const xDiff = Math.abs(wall1.start.x - wall2.start.x);
    if (xDiff > tolerance) return false;
    
    const w1Top = Math.min(wall1.start.y, wall1.end.y);
    const w1Bottom = Math.max(wall1.start.y, wall1.end.y);
    const w2Top = Math.min(wall2.start.y, wall2.end.y);
    const w2Bottom = Math.max(wall2.start.y, wall2.end.y);
    
    return !(w1Bottom < w2Top - tolerance || w1Top > w2Bottom + tolerance);
  }
}

/**
 * Вычисляет расстояние между двумя линиями
 */
function calculateLineDistance(line1, line2) {
  if (line1.type === 'horizontal' && line2.type === 'horizontal') {
    return Math.abs(line1.start.y - line2.start.y);
  } else if (line1.type === 'vertical' && line2.type === 'vertical') {
    return Math.abs(line1.start.x - line2.start.x);
  }
  return Infinity;
}

/**
 * Обнаруживает комнаты по замкнутым контурам
 * Упрощённый алгоритм - находит прямоугольные области
 */
/**
 * Обнаруживает комнаты по замкнутым контурам
 * Улучшенный алгоритм: правильно находит отдельные комнаты, разделённые стенами
 */
export function detectRooms(walls, width, height, scale = 0.01) {
  const allSpaces = [];
  const horizontalWalls = walls.filter(w => w.type === 'horizontal');
  const verticalWalls = walls.filter(w => w.type === 'vertical');
  if (!horizontalWalls.length || !verticalWalls.length) return [];

  // Группируем стены по координатам для более точного поиска
  const groupedHorizontal = groupWallsByCoordinate(horizontalWalls, 'horizontal', 5);
  const groupedVertical = groupWallsByCoordinate(verticalWalls, 'vertical', 5);
  
  // Минимальные размеры комнаты (в пикселях)
  const minRoomWidth = Math.max(80, Math.floor(width * 0.08));
  const minRoomHeight = Math.max(80, Math.floor(height * 0.08));
  const MAX_ROOM_AREA_PX = (width * height) * 0.25; // Максимум 25% от площади изображения
  
  const roomKeys = new Set();

  // Находим все пространства между стенами
  for (let i = 0; i < groupedHorizontal.length - 1; i++) {
    const topGroup = groupedHorizontal[i];
    for (let j = i + 1; j < groupedHorizontal.length; j++) {
      const bottomGroup = groupedHorizontal[j];
      const heightPx = bottomGroup.coord - topGroup.coord;
      
      if (heightPx < minRoomHeight) continue;

      // Находим перекрытия между верхними и нижними стенами
      const overlaps = findHorizontalOverlaps(topGroup.segments, bottomGroup.segments, minRoomWidth);
      
      for (const overlap of overlaps) {
        const { left, right } = overlap;
        const widthPx = right - left;
        
        if (widthPx < minRoomWidth) continue;
        
        // Проверяем, что пространство не слишком большое (не вся квартира)
        const spaceAreaPx = widthPx * heightPx;
        if (spaceAreaPx > MAX_ROOM_AREA_PX) {
          continue; // Слишком большое - пропускаем
        }
        
        // Проверяем наличие вертикальных границ (стен) слева и справа
        // Увеличиваем tolerance для более гибкого поиска стен
        const hasLeftWall = hasVerticalBoundary(groupedVertical, left, topGroup.coord, bottomGroup.coord, 15);
        const hasRightWall = hasVerticalBoundary(groupedVertical, right, topGroup.coord, bottomGroup.coord, 15);
        
        // Комната должна иметь стены с обеих сторон, но если есть хотя бы одна - продолжаем
        // (внешние стены могут быть не найдены из-за неточности координат)
        if (!hasLeftWall && !hasRightWall) {
          continue;
        }
        
        // Вычисляем площадь в м² для проверки
        const vertices = [
          { x: left, y: topGroup.coord },
          { x: right, y: topGroup.coord },
          { x: right, y: bottomGroup.coord },
          { x: left, y: bottomGroup.coord }
        ];
        const areaM2 = calculateRoomArea(vertices, scale);
        
        // Проверяем, что это не коридор (узкое длинное пространство)
        const aspectRatio = Math.max(widthPx, heightPx) / Math.min(widthPx, heightPx);
        
        // Более строгая фильтрация коридоров и лестниц
        if (aspectRatio > 2.0) {
          // Узкое длинное пространство - вероятно коридор или лестница
          if (areaM2 < 10) {
            // Маленькое узкое пространство - коридор или лестница, пропускаем
            continue;
          }
        }
        
        // Фильтруем очень маленькие пространства (< 1.5 м²) - шум
        if (areaM2 < 1.5) {
          continue;
        }
        
        const key = `${Math.round(left / 5)}_${Math.round(topGroup.coord / 5)}_${Math.round(right / 5)}_${Math.round(bottomGroup.coord / 5)}`;
        if (roomKeys.has(key)) continue;
        roomKeys.add(key);
        
        // Площадь уже вычислена выше
        const area = areaM2;
        
        allSpaces.push({
          name: `Помещение ${allSpaces.length + 1}`,
          vertices,
          area,
          width: widthPx,
          height: heightPx
        });
      }
    }
  }

  // Группируем и фильтруем помещения
  const rooms = groupSpacesIntoRooms(allSpaces, scale);
  
  return rooms;
}

/**
 * Группирует мелкие помещения в комнаты
 * Фильтрует санузлы, коридоры и кладовые
 * Улучшенный алгоритм: лучше объединяет соседние пространства
 */
function groupSpacesIntoRooms(spaces, scale) {
  if (spaces.length === 0) return [];
  
  // Определяем пороги
  const MIN_LIVING_ROOM_AREA = 8; // м² - минимальная площадь жилой комнаты
  const MAX_BATHROOM_AREA = 6; // м² - максимальная площадь санузла
  const MAX_CORRIDOR_AREA = 5; // м² - максимальная площадь коридора
  const MIN_SPACE_AREA = 1.5; // м² - минимальная площадь для учёта (меньше = шум)
  const MAX_ROOM_AREA = 50; // м² - максимальная площадь одной комнаты
  
  // Фильтруем очень маленькие пространства (шум)
  const validSpaces = spaces.filter(s => s.area >= MIN_SPACE_AREA);
  
  // Дедупликация: убираем перекрывающиеся пространства (оставляем большее)
  const deduplicatedSpaces = removeOverlappingSpaces(validSpaces);
  
  // Сортируем по площади (от больших к маленьким)
  const sorted = [...deduplicatedSpaces].sort((a, b) => b.area - a.area);
  
  const rooms = [];
  const processed = new Set();
  
  // Шаг 1: Обрабатываем большие пространства (>= 8 м²) - это точно комнаты
  // НО: ограничиваем максимальный размер комнаты
  
  for (const space of sorted) {
    if (processed.has(space.name)) continue;
    
    if (space.area >= MIN_LIVING_ROOM_AREA) {
      // Если пространство слишком большое - это не комната, а вся квартира или ошибка
      if (space.area > MAX_ROOM_AREA) {
        // Пропускаем слишком большие пространства - это не отдельная комната
        continue;
      }
      
      // Большая комната - добавляем как есть
      rooms.push({
        ...space,
        name: space.name,
        isLivingRoom: true
      });
      processed.add(space.name);
    }
  }
  
  // Шаг 2: Объединяем ТОЛЬКО очень маленькие пространства (< 3 м²) с соседними комнатами
  // НЕ объединяем пространства >= 3 м² - это отдельные комнаты, разделённые стенами
  for (const space of sorted) {
    if (processed.has(space.name)) continue;
    
    // Очень маленькие пространства (< 3 м²) - могут быть частью комнаты
    if (space.area < 3) {
      // Ищем соседнюю большую комнату для объединения
      let merged = false;
      for (let i = 0; i < rooms.length; i++) {
        if (!rooms[i].isLivingRoom) continue;
        
        // Проверяем, не станет ли комната слишком большой после объединения
        const potentialArea = rooms[i].area + space.area;
        if (potentialArea > MAX_ROOM_AREA) {
          continue;
        }
        
        if (areSpacesAdjacent(space, rooms[i])) {
          // Объединяем только очень маленькие пространства
          const mergedSpace = mergeSpaces(space, rooms[i]);
          rooms[i] = {
            ...mergedSpace,
            name: rooms[i].name,
            isLivingRoom: true
          };
          processed.add(space.name);
          merged = true;
          break;
        }
      }
      
      if (merged) continue;
      // Если не нашли соседа, пропускаем очень маленькое пространство
      continue;
    }
    
    // Шаг 3: Обрабатываем маленькие пространства отдельно
    if (space.area <= MAX_BATHROOM_AREA) {
      // Проверяем пропорции - узкие длинные = коридор или лестница
      const aspectRatio = Math.max(space.width, space.height) / Math.min(space.width, space.height);
      
      // Более агрессивная фильтрация коридоров
      if (aspectRatio > 1.8) {
        // Коридор или лестница - пропускаем (не часть квартиры)
        continue;
      }
      
      // Очень маленькие пространства (< 2.5 м²) - вероятно шум или часть коридора
      if (space.area < 2.5) {
        continue;
      }
      
      // Проверяем, не является ли это частью коридора по расположению
      // Коридоры обычно вытянуты и имеют маленькую площадь
      if (space.area < 4 && aspectRatio > 1.5) {
        continue;
      }
      
      // Санузел - добавляем как отдельное помещение, но не считаем комнатой
      rooms.push({
        ...space,
        name: space.name,
        isLivingRoom: false
      });
      processed.add(space.name);
      continue;
    }
    
    // Шаг 4: Средние пространства (6-8 м²) - могут быть маленькой комнатой (например, кухня 6.5 м²)
    // НЕ объединяем их - это отдельные комнаты, разделённые стенами
    if (space.area < MIN_LIVING_ROOM_AREA && space.area > MAX_BATHROOM_AREA) {
      // Средние пространства считаем отдельными комнатами (кухня, маленькая комната)
      rooms.push({
        ...space,
        name: space.name,
        isLivingRoom: true
      });
      processed.add(space.name);
    }
  }
  
  // Переименовываем жилые комнаты
  let roomNumber = 1;
  rooms.forEach(room => {
    if (room.isLivingRoom) {
      room.name = `Комната ${roomNumber}`;
      roomNumber++;
    } else {
      // Нежилые помещения оставляем как "Помещение"
      const spaceIndex = spaces.findIndex(s => 
        Math.abs(s.area - room.area) < 0.1 &&
        Math.abs(s.vertices[0].x - room.vertices[0].x) < 0.1
      );
      if (spaceIndex >= 0) {
        room.name = `Помещение ${spaceIndex + 1}`;
      }
    }
  });
  
  return rooms;
}

/**
 * Проверяет, являются ли два пространства соседними
 * Улучшенная версия: более точная проверка соседства
 */
function areSpacesAdjacent(space1, space2) {
  // Вычисляем размеры для определения tolerance
  const avgSize = (Math.max(space1.width, space1.height) + Math.max(space2.width, space2.height)) / 2;
  const tolerance = Math.max(avgSize * 0.15, 20); // Минимум 20 пикселей
  
  // Получаем границы пространств
  const s1MinX = Math.min(...space1.vertices.map(v => v.x));
  const s1MaxX = Math.max(...space1.vertices.map(v => v.x));
  const s1MinY = Math.min(...space1.vertices.map(v => v.y));
  const s1MaxY = Math.max(...space1.vertices.map(v => v.y));
  
  const s2MinX = Math.min(...space2.vertices.map(v => v.x));
  const s2MaxX = Math.max(...space2.vertices.map(v => v.x));
  const s2MinY = Math.min(...space2.vertices.map(v => v.y));
  const s2MaxY = Math.max(...space2.vertices.map(v => v.y));
  
  // Проверяем перекрытие по X
  const xOverlap = !(s1MaxX < s2MinX - tolerance || s2MaxX < s1MinX - tolerance);
  
  // Проверяем перекрытие по Y
  const yOverlap = !(s1MaxY < s2MinY - tolerance || s2MaxY < s1MinY - tolerance);
  
  // Соседние, если перекрываются по одной оси и близки по другой
  const xAdjacent = xOverlap && 
    (Math.abs(s1MinY - s2MaxY) < tolerance ||
     Math.abs(s2MinY - s1MaxY) < tolerance);
  
  const yAdjacent = yOverlap && 
    (Math.abs(s1MaxX - s2MinX) < tolerance ||
     Math.abs(s2MaxX - s1MinX) < tolerance);
  
  return xAdjacent || yAdjacent;
}

/**
 * Удаляет перекрывающиеся пространства (оставляет большее)
 */
function removeOverlappingSpaces(spaces) {
  const result = [];
  const processed = new Set();
  
  // Сортируем по площади (от больших к маленьким)
  const sorted = [...spaces].sort((a, b) => b.area - a.area);
  
  for (const space of sorted) {
    if (processed.has(space.name)) continue;
    
    // Проверяем, не перекрывается ли это пространство с уже обработанными
    let isOverlapping = false;
    for (const existing of result) {
      const overlapRatio = calculateOverlapRatio(space, existing);
      // Если перекрытие > 70%, считаем дубликатом
      if (overlapRatio > 0.7) {
        isOverlapping = true;
        break;
      }
    }
    
    if (!isOverlapping) {
      result.push(space);
    }
    processed.add(space.name);
  }
  
  return result;
}

/**
 * Вычисляет коэффициент перекрытия двух пространств (0-1)
 */
function calculateOverlapRatio(space1, space2) {
  const s1MinX = Math.min(...space1.vertices.map(v => v.x));
  const s1MaxX = Math.max(...space1.vertices.map(v => v.x));
  const s1MinY = Math.min(...space1.vertices.map(v => v.y));
  const s1MaxY = Math.max(...space1.vertices.map(v => v.y));
  
  const s2MinX = Math.min(...space2.vertices.map(v => v.x));
  const s2MaxX = Math.max(...space2.vertices.map(v => v.x));
  const s2MinY = Math.min(...space2.vertices.map(v => v.y));
  const s2MaxY = Math.max(...space2.vertices.map(v => v.y));
  
  // Вычисляем площадь перекрытия
  const overlapX = Math.max(0, Math.min(s1MaxX, s2MaxX) - Math.max(s1MinX, s2MinX));
  const overlapY = Math.max(0, Math.min(s1MaxY, s2MaxY) - Math.max(s1MinY, s2MinY));
  const overlapArea = overlapX * overlapY;
  
  // Вычисляем площадь меньшего пространства
  const smallerArea = Math.min(
    (s1MaxX - s1MinX) * (s1MaxY - s1MinY),
    (s2MaxX - s2MinX) * (s2MaxY - s2MinY)
  );
  
  if (smallerArea === 0) return 0;
  
  return overlapArea / smallerArea;
}

/**
 * Объединяет два пространства в одно
 */
function mergeSpaces(space1, space2) {
  const allX = [...space1.vertices.map(v => v.x), ...space2.vertices.map(v => v.x)];
  const allY = [...space1.vertices.map(v => v.y), ...space2.vertices.map(v => v.y)];
  
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  
  return {
    vertices: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY }
    ],
    area: space1.area + space2.area,
    width: maxX - minX,
    height: maxY - minY
  };
}

function groupWallsByCoordinate(walls, orientation, tolerance = 8) {
  const groups = [];

  walls
    .slice()
    .sort((a, b) =>
      orientation === 'horizontal' ? a.start.y - b.start.y : a.start.x - b.start.x
    )
    .forEach((wall) => {
      const coord = orientation === 'horizontal' ? wall.start.y : wall.start.x;
      let group = groups.find((g) => Math.abs(g.coord - coord) <= tolerance);
      if (!group) {
        group = { coord, segments: [] };
        groups.push(group);
      } else {
        group.coord = (group.coord * group.segments.length + coord) / (group.segments.length + 1);
      }
      group.segments.push({
        start: orientation === 'horizontal' ? wall.start.x : wall.start.y,
        end: orientation === 'horizontal' ? wall.end.x : wall.end.y,
      });
    });

  return groups;
}

function findHorizontalOverlaps(topSegments, bottomSegments, minWidth) {
  const overlaps = [];
  topSegments.forEach(top => {
    bottomSegments.forEach(bottom => {
      const left = Math.max(top.start, bottom.start);
      const right = Math.min(top.end, bottom.end);
      if (right - left >= minWidth) {
        overlaps.push({ left, right });
      }
    });
  });
  return overlaps;
}

function hasVerticalBoundary(groupedVertical, x, topY, bottomY, tolerance = 15) {
  // Ищем в сгруппированных вертикальных стенах
  for (const group of groupedVertical) {
    // Проверяем, что X координата группы близка к искомой
    if (Math.abs(group.coord - x) > tolerance) continue;
    
    // Проверяем, есть ли сегмент, который покрывает нужный диапазон
    for (const segment of group.segments) {
      const startY = Math.min(segment.start, segment.end);
      const endY = Math.max(segment.start, segment.end);
      
      // Проверяем перекрытие по Y с большим tolerance
      if (startY <= bottomY + tolerance && endY >= topY - tolerance) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Находит пересечения стен
 */
function findIntersections(walls) {
  const intersections = [];
  
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const wall1 = walls[i];
      const wall2 = walls[j];
      
      if (wall1.type === wall2.type) continue;
      
      const intersection = findIntersection(wall1, wall2);
      if (intersection) {
        intersections.push(intersection);
      }
    }
  }
  
  return intersections;
}

/**
 * Находит точку пересечения двух стен
 */
function findIntersection(wall1, wall2) {
  if (wall1.type === 'horizontal' && wall2.type === 'vertical') {
    const x = wall2.start.x;
    const y = wall1.start.y;
    
    if (x >= wall1.start.x && x <= wall1.end.x && 
        y >= wall2.start.y && y <= wall2.end.y) {
      return { x, y };
    }
  } else if (wall1.type === 'vertical' && wall2.type === 'horizontal') {
    const x = wall1.start.x;
    const y = wall2.start.y;
    
    if (x >= wall2.start.x && x <= wall2.end.x && 
        y >= wall1.start.y && y <= wall1.end.y) {
      return { x, y };
    }
  }
  
  return null;
}

/**
 * Форматирует стены для вывода в текстовый формат
 */
export function formatWalls(walls, scale = 0.01) {
  return walls.map(wall => {
    const startX = pixelsToMeters(wall.start.x, scale).toFixed(2);
    const startY = pixelsToMeters(wall.start.y, scale).toFixed(2);
    const endX = pixelsToMeters(wall.end.x, scale).toFixed(2);
    const endY = pixelsToMeters(wall.end.y, scale).toFixed(2);
    const type = wall.loadBearing ? 'несущая' : 'ненесущая';
    const thickness = wall.thickness.toFixed(2);
    
    return `${startX},${startY} -> ${endX},${endY}; ${type}; ${thickness}`;
  }).join('\n');
}

/**
 * Форматирует комнаты для вывода в текстовый формат
 */
export function formatRooms(rooms, scale = 0.01) {
  if (!rooms || rooms.length === 0) {
    return '';
  }
  
  return rooms
    .filter(room => room && room.vertices && room.vertices.length > 0)
    .map(room => {
      const coords = room.vertices.map(v => {
        const x = pixelsToMeters(v.x, scale).toFixed(2);
        const y = pixelsToMeters(v.y, scale).toFixed(2);
        return `${x},${y}`;
      }).join(';');
      
      // Используем оригинальное имя комнаты
      const roomName = room.name || `Помещение ${rooms.indexOf(room) + 1}`;
      return `${roomName}:${coords}`;
    })
    .join('\n');
}

/**
 * Вычисляет площадь комнаты в квадратных метрах
 */
export function calculateRoomArea(vertices, scale = 0.01) {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  const areaInPixels = Math.abs(area) / 2;
  return areaInPixels * scale * scale;
}


