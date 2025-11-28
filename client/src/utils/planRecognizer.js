/**
 * Главный модуль распознавания планов помещений
 * Объединяет обработку PDF и изображений
 */

import { 
  loadImageFromFile, 
  imageToCanvas, 
  grayscale, 
  detectEdges, 
  detectLines, 
  groupLinesIntoWalls, 
  detectRooms,
  formatWalls,
  formatRooms,
  calculateRoomArea
} from './imageProcessor.js';

import { 
  extractImageFromPDF, 
  extractTextFromPDF, 
  parseMetadataFromText 
} from './pdfProcessor.js';

/**
 * Распознаёт план из загруженного файла
 */
export async function recognizePlan(file) {
  try {
    let image = null;
    let metadata = {};
    const fileType = file.type || file.name.split('.').pop().toLowerCase();
    
    // Обработка PDF
    if (fileType === 'pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      console.log('Обработка PDF файла...');
      
      // Извлекаем изображение из PDF
      image = await extractImageFromPDF(file);
      
      // Пытаемся извлечь метаданные из текста
      try {
        const text = await extractTextFromPDF(file);
        metadata = parseMetadataFromText(text);
        console.log('Извлечённые метаданные:', metadata);
      } catch (error) {
        console.warn('Не удалось извлечь текст из PDF:', error);
      }
    }
    // Обработка изображений (JPG, PNG)
    else if (fileType.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(fileType)) {
      console.log('Обработка изображения...');
      image = await loadImageFromFile(file);
    }
    else {
      throw new Error('Неподдерживаемый формат файла');
    }
    
    if (!image) {
      throw new Error('Не удалось загрузить изображение');
    }
    
    // Обрабатываем изображение
    console.log('Анализ изображения...');
    const { canvas, width, height, ctx } = imageToCanvas(image, 2048, 2048);
    
    // Применяем фильтры
    console.log('Применение фильтров...');
    grayscale(canvas, ctx);
    const edgesImageData = detectEdges(canvas, ctx);
    
    // Восстанавливаем imageData для дальнейшей обработки
    ctx.putImageData(edgesImageData, 0, 0);
    
    // Обнаруживаем линии
    console.log('Обнаружение линий...');
    const lines = detectLines(edgesImageData, width, height, 30);
    console.log(`Найдено линий: ${lines.length}`);
    
    if (lines.length === 0) {
      throw new Error('Не удалось распознать линии на плане. Попробуйте загрузить более чёткое изображение.');
    }
    
    // Группируем линии в стены
    console.log('Группировка стен...');
    const walls = groupLinesIntoWalls(lines, 10);
    console.log(`Найдено стен: ${walls.length}`);
    
    // Обнаруживаем комнаты
    console.log('Обнаружение комнат...');
    const rooms = detectRooms(walls, width, height);
    console.log(`Найдено комнат: ${rooms.length}`);
    
    // Вычисляем масштаб (предполагаем стандартный масштаб)
    // Можно улучшить, если есть информация о реальных размерах
    const scale = estimateScale(walls, metadata.area);
    
    // Форматируем результат
    const roomsText = formatRooms(rooms, scale);
    const wallsText = formatWalls(walls, scale);
    
    // Вычисляем общую площадь, если не указана
    let area = metadata.area;
    if (!area && rooms.length > 0) {
      area = rooms.reduce((sum, room) => {
        return sum + calculateRoomArea(room.vertices, scale);
      }, 0).toFixed(1);
    }
    
    return {
      success: true,
      rooms: roomsText,
      walls: wallsText,
      area: area ? String(area) : null,
      ceilingHeight: metadata.ceilingHeight ? String(metadata.ceilingHeight) : null,
      address: metadata.address || null,
      stats: {
        roomsFound: rooms.length,
        wallsFound: walls.length,
        linesFound: lines.length
      }
    };
    
  } catch (error) {
    console.error('Ошибка распознавания:', error);
    return {
      success: false,
      error: error.message || 'Неизвестная ошибка при распознавании плана'
    };
  }
}

/**
 * Оценивает масштаб изображения (пиксели → метры)
 * Упрощённая эвристика: предполагаем, что средняя длина стены ~3-5 метров
 */
function estimateScale(walls, knownArea = null) {
  if (walls.length === 0) return 0.01; // По умолчанию
  
  // Вычисляем среднюю длину стены в пикселях
  const avgLength = walls.reduce((sum, wall) => {
    const length = Math.sqrt(
      Math.pow(wall.end.x - wall.start.x, 2) + 
      Math.pow(wall.end.y - wall.start.y, 2)
    );
    return sum + length;
  }, 0) / walls.length;
  
  // Предполагаем, что средняя стена ~4 метра
  const assumedMeters = 4;
  let scale = assumedMeters / avgLength;
  
  // Корректируем по известной площади, если есть
  if (knownArea && walls.length > 0) {
    // Упрощённая коррекция
    scale = scale * 0.8; // Немного уменьшаем масштаб
  }
  
  return Math.max(0.005, Math.min(0.05, scale)); // Ограничиваем разумными пределами
}

