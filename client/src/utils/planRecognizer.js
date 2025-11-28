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
  removeWallConflicts,
  findMissingWalls,
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

// Ленивый импорт OCR процессора
let ocrProcessor = null;
async function getOcrProcessor() {
  if (!ocrProcessor) {
    ocrProcessor = await import('./ocrProcessor.js');
  }
  return ocrProcessor;
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
      
      // Извлекаем текст из изображения через OCR
      try {
        console.log('Распознавание текста с помощью OCR...');
        const ocrModule = await getOcrProcessor();
        const ocrText = await ocrModule.extractTextFromImage(image);
        console.log('Извлечённый текст (первые 500 символов):', ocrText.substring(0, 500));
        
        // Парсим метаданные из OCR текста
        const ocrMetadata = ocrModule.parseMetadataFromOCRText(ocrText);
        console.log('Метаданные из OCR:', ocrMetadata);
        
        // Объединяем метаданные
        metadata = {
          ...metadata,
          ...ocrMetadata,
          // Приоритет OCR метаданным
          scale: ocrMetadata.scale || metadata.scale,
          area: ocrMetadata.area || metadata.area,
          address: ocrMetadata.address || metadata.address,
          ceilingHeight: ocrMetadata.ceilingHeight || metadata.ceilingHeight
        };
      } catch (error) {
        console.warn('Не удалось выполнить OCR:', error);
        // Продолжаем без OCR
      }
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
    let walls = groupLinesIntoWalls(lines, mergeDistance, mergeDistance * 1.5);
    console.log(`Найдено стен после группировки: ${walls.length}`);
    
    // Дополнительная дедупликация для устранения конфликтов
    walls = removeWallConflicts(walls, mergeDistance * 2);
    console.log(`Стен после устранения конфликтов: ${walls.length}`);
    
    // Вычисляем масштаб с учётом метаданных (нужен для detectRooms)
    // Если масштаб указан в метаданных (например, 1:200), используем его
    let scale = metadata.scale || estimateScale(walls, metadata.area, null, width, height);
    
    // Если масштаб из метаданных, конвертируем (1:200 = 0.005)
    if (metadata.scale && metadata.scale > 0.001 && metadata.scale < 0.1) {
      scale = metadata.scale;
      console.log(`Используется масштаб из метаданных: ${scale} (1 пиксель = ${scale} метров)`);
    } else {
      console.log(`Определённый масштаб: ${scale} (1 пиксель = ${scale} метров)`);
    }
    
    // Обнаруживаем комнаты (с учётом масштаба для фильтрации)
    console.log('Обнаружение комнат...');
    let rooms = detectRooms(walls, width, height, scale);
    console.log(`Найдено геометрических комнат: ${rooms.length}`);
    
    // Добавляем недостающие стены на основе границ найденных комнат
    if (rooms.length > 0) {
      const missingWalls = findMissingWalls(rooms, walls, scale);
      if (missingWalls.length > 0) {
        console.log(`Добавлено ${missingWalls.length} недостающих стен на основе границ комнат`);
        walls = [...walls, ...missingWalls];
        // Повторно устраняем конфликты после добавления новых стен
        walls = removeWallConflicts(walls, mergeDistance * 2);
      }
    }
    
    // Если есть комнаты из OCR, сопоставляем их с геометрическими
    if (metadata.rooms && metadata.rooms.length > 0) {
      try {
        const ocrModule = await getOcrProcessor();
        
        if (rooms.length > 0) {
          // Сопоставляем OCR комнаты с геометрическими
          const matchedRooms = ocrModule.matchRoomsWithGeometry(metadata.rooms, rooms);
          console.log('Сопоставленные комнаты:', matchedRooms);
          
          // Обновляем комнаты с номерами из OCR
          rooms = matchedRooms.map(matched => {
            if (matched.matched && matched.number) {
              // Используем номер и площадь из OCR, сохраняем isLivingRoom
              return {
                ...matched,
                name: `Комната ${matched.number}`,
                area: matched.ocrArea || matched.area,
                // Сохраняем isLivingRoom из геометрической комнаты
                isLivingRoom: matched.isLivingRoom !== false
              };
            } else {
              // Оставляем геометрическую комнату без номера, сохраняем isLivingRoom
              return {
                ...matched,
                isLivingRoom: matched.isLivingRoom !== false
              };
            }
          });
        } else {
          // Если геометрические комнаты не найдены, создаём комнаты из OCR
          console.warn('Геометрические комнаты не найдены, создаём комнаты из OCR');
          
          // Пытаемся использовать границы стен для более точного размещения
          const minX = Math.min(...walls.map(w => Math.min(w.start.x, w.end.x)));
          const maxX = Math.max(...walls.map(w => Math.max(w.start.x, w.end.x)));
          const minY = Math.min(...walls.map(w => Math.min(w.start.y, w.end.y)));
          const maxY = Math.max(...walls.map(w => Math.max(w.start.y, w.end.y)));
          
          const apartmentWidth = maxX - minX;
          const apartmentHeight = maxY - minY;
          const apartmentCenterX = (minX + maxX) / 2;
          const apartmentCenterY = (minY + maxY) / 2;
          
          // Сортируем комнаты по площади (от больших к маленьким) для лучшего размещения
          const sortedOcrRooms = [...metadata.rooms].sort((a, b) => b.area - a.area);
          
          // Располагаем комнаты в сетке
          const cols = Math.ceil(Math.sqrt(sortedOcrRooms.length));
          const rows = Math.ceil(sortedOcrRooms.length / cols);
          const cellWidth = apartmentWidth / cols;
          const cellHeight = apartmentHeight / rows;
          
          rooms = sortedOcrRooms.map((ocrRoom, index) => {
            // Вычисляем размер комнаты на основе площади
            // Сначала находим размер стороны в метрах, затем переводим в пиксели
            const sideInMeters = Math.sqrt(ocrRoom.area); // Размер стороны в метрах
            const sideInPixels = sideInMeters / scale; // Размер стороны в пикселях
            
            // Позиция в сетке
            const col = index % cols;
            const row = Math.floor(index / cols);
            
            // Центр ячейки
            const cellX = minX + (col + 0.5) * cellWidth;
            const cellY = minY + (row + 0.5) * cellHeight;
            
            // Ограничиваем размер комнаты размером ячейки
            const maxSize = Math.min(cellWidth * 0.8, cellHeight * 0.8);
            const actualSize = Math.min(sideInPixels, maxSize);
            const halfSize = actualSize / 2;
            
            return {
              name: `Комната ${ocrRoom.number}`,
              vertices: [
                { x: cellX - halfSize, y: cellY - halfSize },
                { x: cellX + halfSize, y: cellY - halfSize },
                { x: cellX + halfSize, y: cellY + halfSize },
                { x: cellX - halfSize, y: cellY + halfSize }
              ],
              area: ocrRoom.area,
              isLivingRoom: ocrRoom.area >= 5, // Комнаты >= 5 м² считаем жилыми
              number: ocrRoom.number,
              matched: false,
              width: actualSize,
              height: actualSize
            };
          });
          console.log(`Создано ${rooms.length} комнат из OCR с использованием границ стен`);
        }
      } catch (error) {
        console.warn('Не удалось сопоставить комнаты:', error);
      }
    }
    
    // Определяем тип квартиры по количеству жилых комнат
    // ПРИОРИТЕТ: используем комнаты из OCR (они точнее), затем геометрические
    let livingRoomsCount = 0;
    
    if (metadata.rooms && metadata.rooms.length > 0) {
      // Используем комнаты из OCR
      const ocrLivingRooms = metadata.rooms.filter(r => {
        // Исключаем лестницы
        if (r.number === '1-2' || (r.number && r.number.includes('-'))) return false;
        // Исключаем очень маленькие помещения (< 1.5 м²) - кладовые
        if (r.area < 1.5) return false;
        // Исключаем санузлы (< 3 м²)
        if (r.area < 3 && (r.number === '17' || r.number === '18')) return false;
        // Жилые комнаты >= 5 м²
        return r.area >= 5;
      });
      livingRoomsCount = ocrLivingRooms.length;
      console.log(`Найдено жилых комнат из OCR: ${livingRoomsCount} (всего OCR комнат: ${metadata.rooms.length})`);
      console.log('OCR жилые комнаты:', ocrLivingRooms.map(r => ({ number: r.number, area: r.area })));
    } else {
      // Если нет OCR, используем геометрические комнаты
      const livingRooms = rooms.filter(r => {
        // Исключаем очень маленькие помещения (< 1.5 м²) и лестницы
        if (r.area < 1.5) return false;
        if (r.name && r.name.includes('1-2')) return false;
        if (r.number && (r.number === '1-2' || r.number.includes('-'))) return false;
        // Жилые комнаты >= 5 м²
        return r.area >= 5;
      });
      livingRoomsCount = livingRooms.length;
      console.log(`Найдено жилых комнат из геометрии: ${livingRoomsCount} (всего комнат: ${rooms.length})`);
      console.log('Геометрические жилые комнаты:', livingRooms.map(r => ({ name: r.name, number: r.number, area: r.area })));
    }
    
    // Если всё ещё нет жилых комнат, но есть комнаты, считаем все >= 3 м² жилыми
    if (livingRoomsCount === 0 && rooms.length > 0) {
      const allRooms = metadata.rooms || rooms;
      const fallbackLivingRooms = allRooms.filter(r => {
        const roomArea = r.area || 0;
        if (roomArea < 3) return false;
        if (r.number === '1-2' || (r.number && r.number.includes('-'))) return false;
        return true;
      });
      livingRoomsCount = fallbackLivingRooms.length;
      console.warn(`Не найдено жилых комнат >= 5 м², используем комнаты >= 3 м²: ${livingRoomsCount}`);
    }
    
    const apartmentType = determineApartmentTypeByCount(livingRoomsCount);
    console.log(`Определён тип квартиры: ${apartmentType} (жилых комнат: ${livingRoomsCount})`);
    
    // Форматируем результат
    const roomsText = formatRooms(rooms, scale);
    const wallsText = formatWalls(walls, scale);
    
    // Вычисляем общую площадь квартиры
    // ПРИОРИТЕТ: используем площадь из OCR (она точнее), если доступна
    let area = null;
    
    if (metadata.rooms && metadata.rooms.length > 0) {
      // Суммируем площади комнат из OCR, исключая лестницы, санузлы и кладовые
      const totalArea = metadata.rooms
        .filter(r => {
          // Исключаем лестницы
          if (r.number === '1-2' || (r.number && r.number.includes('-'))) return false;
          // Исключаем очень маленькие помещения (< 1.5 м²) - кладовые
          if (r.area < 1.5) return false;
          // Исключаем санузлы (обычно < 3 м²)
          if (r.area < 3 && (r.number === '17' || r.number === '18')) return false;
          return true;
        })
        .reduce((sum, room) => sum + room.area, 0);
      
      area = totalArea.toFixed(1);
      console.log(`Площадь из OCR комнат: ${area} м²`);
    } else if (rooms.length > 0) {
      // Если нет OCR, вычисляем из геометрических комнат
      const totalArea = rooms
        .filter(r => {
          // Исключаем лестницы
          if (r.name && r.name.includes('1-2')) return false;
          if (r.number && (r.number === '1-2' || r.number.includes('-'))) return false;
          // Исключаем очень маленькие помещения (< 1.5 м²) - кладовые
          if (r.area < 1.5) return false;
          // Исключаем санузлы
          if (r.area < 3 && (r.number === '17' || r.number === '18')) return false;
          return true;
        })
        .reduce((sum, room) => {
          return sum + (room.area || calculateRoomArea(room.vertices, scale));
        }, 0);
      area = totalArea.toFixed(1);
      console.log(`Вычисленная площадь из геометрии: ${area} м²`);
    }
    
    // Если есть общая площадь из OCR метаданных, используем её (она может быть точнее)
    if (metadata.area && metadata.area !== '0' && metadata.area !== '0.0') {
      const ocrTotalArea = parseFloat(metadata.area);
      // Если общая площадь из OCR разумная (30-200 м²), используем её
      if (ocrTotalArea >= 30 && ocrTotalArea <= 200) {
        area = metadata.area;
        console.log(`Используется общая площадь из OCR метаданных: ${area} м²`);
      }
    }
    
    // Подсчитываем жилые комнаты для статистики
    const livingRoomsForStats = rooms.filter(r => r.isLivingRoom !== false);
    
    return {
      success: true,
      rooms: roomsText,
      walls: wallsText,
      area: area ? String(area) : null,
      ceilingHeight: metadata.ceilingHeight ? String(metadata.ceilingHeight) : null,
      address: metadata.address || null,
      apartmentType: apartmentType,
      stats: {
        roomsFound: rooms.length,
        livingRoomsFound: livingRoomsCount || livingRoomsForStats.length,
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
 * Улучшенная эвристика с учётом размера изображения и реальных данных
 */
function estimateScale(walls, knownArea = null, providedScale = null, width = null, height = null) {
  if (providedScale && providedScale > 0 && providedScale < 0.1) {
    return providedScale; // Используем предоставленный масштаб (например, 0.005 для 1:200)
  }
  
  if (walls.length === 0) return 0.005; // По умолчанию для масштаба 1:200
  
  // Вычисляем длины всех стен в пикселях
  const lengths = walls.map(wall => {
    return Math.sqrt(
      Math.pow(wall.end.x - wall.start.x, 2) + 
      Math.pow(wall.end.y - wall.start.y, 2)
    );
  }).filter(l => l > 20); // Игнорируем очень короткие стены
  
  if (lengths.length === 0) return 0.005;
  
  const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
  const maxLength = Math.max(...lengths);
  const medianLength = lengths.sort((a, b) => a - b)[Math.floor(lengths.length / 2)];
  
  // Для типовых квартир в масштабе 1:200:
  // - Средняя стена ~3-4 метра = 600-800 пикселей при 1:200
  // - Максимальная стена (внешняя) ~6-8 метров = 1200-1600 пикселей
  // - Масштаб 1:200 означает: 1 метр = 5 пикселей, или 1 пиксель = 0.2 метра при 100% масштабе
  // Но на отсканированном изображении это зависит от разрешения
  
  // Предполагаем типичные размеры для квартир
  const assumedAvgMeters = 3.5;
  const assumedMaxMeters = 7;
  
  let scaleFromAvg = assumedAvgMeters / avgLength;
  let scaleFromMax = assumedMaxMeters / maxLength;
  let scaleFromMedian = assumedAvgMeters / medianLength;
  
  // Усредняем оценки (больше доверяем медиане)
  let scale = (scaleFromAvg * 0.3 + scaleFromMax * 0.2 + scaleFromMedian * 0.5);
  
  // Корректируем по известной площади, если есть
  if (knownArea && width && height) {
    const totalPixels = width * height;
    const scaleFromArea = Math.sqrt(parseFloat(knownArea) / totalPixels);
    // Если площадь известна, больше доверяем ей
    scale = (scale * 0.2 + scaleFromArea * 0.8);
  }
  
  // Ограничиваем разумными пределами для масштаба 1:200 - 1:100
  // 1:200 = 0.005, 1:100 = 0.01
  return Math.max(0.004, Math.min(0.02, scale));
}

/**
 * Определяет тип квартиры по количеству жилых комнат
 */
function determineApartmentType(livingRooms) {
  const count = livingRooms.length;
  return determineApartmentTypeByCount(count);
}

/**
 * Определяет тип квартиры по количеству жилых комнат (число)
 */
function determineApartmentTypeByCount(count) {
  if (count === 0) {
    return 'Студия';
  } else if (count === 1) {
    return '1-комнатная';
  } else if (count === 2) {
    return '2-комнатная';
  } else if (count === 3) {
    return '3-комнатная';
  } else {
    return '3+ комнатная';
  }
}

