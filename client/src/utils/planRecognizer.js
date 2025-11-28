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

// Ленивый импорт PDF процессора (загружается только при необходимости)
let pdfProcessor = null;
async function getPdfProcessor() {
  if (!pdfProcessor) {
    pdfProcessor = await import('./pdfProcessor.js');
  }
  return pdfProcessor;
}

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
      
      try {
        // Ленивая загрузка PDF процессора
        const pdfModule = await getPdfProcessor();
        
        // Извлекаем изображение из PDF
        image = await pdfModule.extractImageFromPDF(file);
        
        // Пытаемся извлечь метаданные из текста
        try {
          const text = await pdfModule.extractTextFromPDF(file);
          metadata = pdfModule.parseMetadataFromText(text);
          console.log('Извлечённые метаданные:', metadata);
        } catch (error) {
          console.warn('Не удалось извлечь текст из PDF:', error);
        }
      } catch (error) {
        console.error('Ошибка при обработке PDF:', error);
        throw new Error('Не удалось обработать PDF файл. Возможно, требуется подключение к интернету для загрузки библиотеки.');
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
    let edgesImageData = detectEdges(canvas, ctx);
    
    // Восстанавливаем imageData для дальнейшей обработки
    ctx.putImageData(edgesImageData, 0, 0);
    
    // Обнаруживаем линии
    console.log('Обнаружение линий...');
    const minLineLength = Math.max(40, Math.floor(Math.max(width, height) * 0.05));
    const lines = detectLines(edgesImageData, width, height, minLineLength);
    console.log(`Найдено линий: ${lines.length}`);
    
    if (lines.length === 0) {
      throw new Error('Не удалось распознать линии на плане. Попробуйте загрузить более чёткое изображение.');
    }
    
    // Группируем линии в стены
    console.log('Группировка стен...');
    const mergeDistance = Math.max(6, Math.floor(Math.max(width, height) * 0.003));
    const walls = groupLinesIntoWalls(lines, mergeDistance, mergeDistance * 1.5);
    console.log(`Найдено стен: ${walls.length}`);
    
    // Обнаруживаем комнаты
    console.log('Обнаружение комнат...');
    const rooms = detectRooms(walls, width, height);
    console.log(`Найдено комнат: ${rooms.length}`);
    
    // Вычисляем масштаб с учётом метаданных
    const scale = estimateScale(walls, metadata.area, metadata.scale);
    console.log(`Определённый масштаб: ${scale} (1 пиксель = ${scale} метров)`);
    
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
function estimateScale(walls, knownArea = null, providedScale = null) {
  if (providedScale && providedScale > 0) return providedScale;
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

