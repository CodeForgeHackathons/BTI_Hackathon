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
export function detectLines(imageData, width, height, minLength = 50) {
  const data = imageData.data;
  const lines = [];
  const visited = new Set();
  
  // Порог для определения пикселя как части линии
  const edgeThreshold = 100;
  
  // Ищем горизонтальные линии
  for (let y = 0; y < height; y++) {
    let lineStart = null;
    let lineLength = 0;
    
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const value = data[idx];
      
      if (value > edgeThreshold) {
        if (lineStart === null) {
          lineStart = x;
          lineLength = 1;
        } else {
          lineLength++;
        }
      } else {
        if (lineStart !== null && lineLength >= minLength) {
          const key = `h_${y}_${lineStart}_${x}`;
          if (!visited.has(key)) {
            lines.push({
              type: 'horizontal',
              start: { x: lineStart, y },
              end: { x: x - 1, y },
              length: lineLength
            });
            visited.add(key);
          }
        }
        lineStart = null;
        lineLength = 0;
      }
    }
    
    // Проверяем последнюю линию в строке
    if (lineStart !== null && lineLength >= minLength) {
      const key = `h_${y}_${lineStart}_${width}`;
      if (!visited.has(key)) {
        lines.push({
          type: 'horizontal',
          start: { x: lineStart, y },
          end: { x: width - 1, y },
          length: lineLength
        });
      }
    }
  }
  
  // Ищем вертикальные линии
  for (let x = 0; x < width; x++) {
    let lineStart = null;
    let lineLength = 0;
    
    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 4;
      const value = data[idx];
      
      if (value > edgeThreshold) {
        if (lineStart === null) {
          lineStart = y;
          lineLength = 1;
        } else {
          lineLength++;
        }
      } else {
        if (lineStart !== null && lineLength >= minLength) {
          const key = `v_${x}_${lineStart}_${y}`;
          if (!visited.has(key)) {
            lines.push({
              type: 'vertical',
              start: { x, y: lineStart },
              end: { x, y: y - 1 },
              length: lineLength
            });
            visited.add(key);
          }
        }
        lineStart = null;
        lineLength = 0;
      }
    }
    
    if (lineStart !== null && lineLength >= minLength) {
      const key = `v_${x}_${lineStart}_${height}`;
      if (!visited.has(key)) {
        lines.push({
          type: 'vertical',
          start: { x, y: lineStart },
          end: { x, y: height - 1 },
          length: lineLength
        });
      }
    }
  }
  
  return lines;
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
export function groupLinesIntoWalls(lines, mergeDistance = 5) {
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
  
  return walls;
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
export function detectRooms(walls, width, height) {
  const rooms = [];
  
  // Находим пересечения стен
  const intersections = findIntersections(walls);
  
  // Группируем стены в замкнутые контуры (упрощённо)
  // Ищем прямоугольные области
  const horizontalWalls = walls.filter(w => w.type === 'horizontal').sort((a, b) => a.start.y - b.start.y);
  const verticalWalls = walls.filter(w => w.type === 'vertical').sort((a, b) => a.start.x - b.start.x);
  
  // Группируем по горизонтальным уровням
  const yLevels = [...new Set(horizontalWalls.map(w => w.start.y))].sort((a, b) => a - b);
  
  for (let i = 0; i < yLevels.length - 1; i++) {
    const topY = yLevels[i];
    const bottomY = yLevels[i + 1];
    
    const topWalls = horizontalWalls.filter(w => Math.abs(w.start.y - topY) < 5);
    const bottomWalls = horizontalWalls.filter(w => Math.abs(w.start.y - bottomY) < 5);
    
    // Ищем пары стен для создания прямоугольников
    for (const topWall of topWalls) {
      for (const bottomWall of bottomWalls) {
        const leftX = Math.max(topWall.start.x, bottomWall.start.x);
        const rightX = Math.min(topWall.end.x, bottomWall.end.x);
        
        if (rightX > leftX && (bottomY - topY) > 20) {
          rooms.push({
            name: `Помещение ${rooms.length + 1}`,
            vertices: [
              { x: leftX, y: topY },
              { x: rightX, y: topY },
              { x: rightX, y: bottomY },
              { x: leftX, y: bottomY }
            ]
          });
        }
      }
    }
  }
  
  return rooms;
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
  return rooms.map(room => {
    const coords = room.vertices.map(v => {
      const x = pixelsToMeters(v.x, scale).toFixed(2);
      const y = pixelsToMeters(v.y, scale).toFixed(2);
      return `${x},${y}`;
    }).join(';');
    
    return `${room.name}:${coords}`;
  }).join('\n');
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
  area = Math.abs(area) / 2;
  return pixelsToMeters(area * scale, scale);
}

