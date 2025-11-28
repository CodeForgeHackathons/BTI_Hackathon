/**
 * ML-модуль распознавания планов на основе нейросетей
 * Заменяет алгоритмический подход на deep learning
 */

import { loadAllModels, getTensorFlow, getModels } from './mlModelLoader.js';
import { imageToCanvas } from './imageProcessor.js';

// Импорты для обработки файлов
let pdfProcessor = null;
let ocrProcessor = null;

async function getPdfProcessor() {
  if (!pdfProcessor) {
    pdfProcessor = await import('./pdfProcessor.js');
  }
  return pdfProcessor;
}

async function getOcrProcessor() {
  if (!ocrProcessor) {
    ocrProcessor = await import('./ocrProcessor.js');
  }
  return ocrProcessor;
}

/**
 * Преобразует изображение в тензор для ML модели
 */
async function imageToTensor(image, targetSize = [512, 512]) {
  const tf = await getTensorFlow();
  const { canvas, width, height, ctx } = imageToCanvas(image, targetSize[0], targetSize[1]);
  
  // Получаем ImageData
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Преобразуем в тензор
  const tensor = tf.browser.fromPixels(imageData)
    .resizeNearestNeighbor(targetSize)
    .toFloat()
    .div(255.0) // Нормализация [0, 1]
    .expandDims(0); // Добавляем batch dimension
  
  return { tensor, originalWidth: width, originalHeight: height };
}

/**
 * Детекция стен с помощью DeepLabV3+ модели
 */
async function detectWallsML(image) {
  const models = getModels();
  
  if (!models.wallDetection) {
    throw new Error('ML модель детекции стен недоступна');
  }
  
  try {
    const tf = await getTensorFlow();
    // DeepLab работает лучше с размером 513x513
    const { tensor, originalWidth, originalHeight } = await imageToTensor(image, [513, 513]);
    
    // Предсказание DeepLabV3+ (возвращает маску сегментации)
    const prediction = models.wallDetection.predict(tensor);
    
    // DeepLab возвращает [batch, height, width, num_classes]
    // Нужно получить argmax для каждого пикселя
    const segmentation = prediction.argMax(-1); // [batch, height, width]
    const segmentationData = await segmentation.data();
    
    prediction.dispose();
    segmentation.dispose();
    tensor.dispose();
    
    // Преобразуем маску сегментации в стены
    // DeepLab сегментирует объекты, нужно найти границы сегментов (стены)
    const walls = parseWallsFromDeepLabOutput(segmentationData, 513, 513, originalWidth, originalHeight);
    
    return walls;
  } catch (error) {
    console.error('Ошибка ML детекции стен:', error);
    throw error;
  }
}

/**
 * Парсит выход DeepLabV3+ в формат стен
 * Находит границы сегментов и преобразует в линии стен
 */
function parseWallsFromDeepLabOutput(segmentationData, segWidth, segHeight, originalWidth, originalHeight) {
  const walls = [];
  const scaleX = originalWidth / segWidth;
  const scaleY = originalHeight / segHeight;
  
  // Преобразуем маску в 2D массив
  const mask = [];
  for (let y = 0; y < segHeight; y++) {
    mask[y] = [];
    for (let x = 0; x < segWidth; x++) {
      const idx = y * segWidth + x;
      mask[y][x] = segmentationData[idx];
    }
  }
  
  // Находим границы между разными сегментами (это стены)
  // Проходим по маске и ищем переходы между классами
  
  // Горизонтальные стены (переходы по Y)
  for (let y = 1; y < segHeight; y++) {
    let wallStart = null;
    for (let x = 0; x < segWidth; x++) {
      const current = mask[y][x];
      const above = mask[y - 1][x];
      
      // Если класс изменился - это граница (стена)
      if (current !== above) {
        if (wallStart === null) {
          wallStart = x;
        }
      } else {
        if (wallStart !== null) {
          // Завершаем стену
          const length = x - wallStart;
          if (length > 10) { // Минимальная длина стены
            walls.push({
              start: { x: wallStart * scaleX, y: y * scaleY },
              end: { x: x * scaleX, y: y * scaleY },
              type: 'horizontal',
              loadBearing: length > 100, // Длинные стены - несущие
              thickness: length > 100 ? 0.4 : 0.12
            });
          }
          wallStart = null;
        }
      }
    }
    // Завершаем стену в конце строки
    if (wallStart !== null) {
      const length = segWidth - wallStart;
      if (length > 10) {
        walls.push({
          start: { x: wallStart * scaleX, y: y * scaleY },
          end: { x: segWidth * scaleX, y: y * scaleY },
          type: 'horizontal',
          loadBearing: length > 100,
          thickness: length > 100 ? 0.4 : 0.12
        });
      }
    }
  }
  
  // Вертикальные стены (переходы по X)
  for (let x = 1; x < segWidth; x++) {
    let wallStart = null;
    for (let y = 0; y < segHeight; y++) {
      const current = mask[y][x];
      const left = mask[y][x - 1];
      
      if (current !== left) {
        if (wallStart === null) {
          wallStart = y;
        }
      } else {
        if (wallStart !== null) {
          const length = y - wallStart;
          if (length > 10) {
            walls.push({
              start: { x: x * scaleX, y: wallStart * scaleY },
              end: { x: x * scaleX, y: y * scaleY },
              type: 'vertical',
              loadBearing: length > 100,
              thickness: length > 100 ? 0.4 : 0.12
            });
          }
          wallStart = null;
        }
      }
    }
    if (wallStart !== null) {
      const length = segHeight - wallStart;
      if (length > 10) {
        walls.push({
          start: { x: x * scaleX, y: wallStart * scaleY },
          end: { x: x * scaleX, y: segHeight * scaleY },
          type: 'vertical',
          loadBearing: length > 100,
          thickness: length > 100 ? 0.4 : 0.12
        });
      }
    }
  }
  
  return walls;
}

/**
 * Сегментация комнат с помощью DeepLabV3+ модели
 */
async function segmentRoomsML(image) {
  const models = getModels();
  
  if (!models.roomSegmentation) {
    throw new Error('ML модель сегментации комнат недоступна');
  }
  
  try {
    const tf = await getTensorFlow();
    // DeepLab работает лучше с размером 513x513
    const { tensor, originalWidth, originalHeight } = await imageToTensor(image, [513, 513]);
    
    // Предсказание DeepLabV3+
    const prediction = models.roomSegmentation.predict(tensor);
    const segmentation = prediction.argMax(-1);
    const segmentationData = await segmentation.data();
    
    prediction.dispose();
    segmentation.dispose();
    tensor.dispose();
    
    // Преобразуем маску сегментации в комнаты
    const rooms = parseRoomsFromDeepLabSegmentation(segmentationData, 513, 513, originalWidth, originalHeight);
    
    return rooms;
  } catch (error) {
    console.error('Ошибка ML сегментации комнат:', error);
    throw error;
  }
}

/**
 * Парсит маску сегментации DeepLabV3+ в формат комнат
 * Находит отдельные сегменты (комнаты) и их границы
 */
function parseRoomsFromDeepLabSegmentation(segmentationData, segWidth, segHeight, originalWidth, originalHeight) {
  const rooms = [];
  const scaleX = originalWidth / segWidth;
  const scaleY = originalHeight / segHeight;
  
  // Преобразуем маску в 2D массив
  const mask = [];
  for (let y = 0; y < segHeight; y++) {
    mask[y] = [];
    for (let x = 0; x < segWidth; x++) {
      const idx = y * segWidth + x;
      mask[y][x] = segmentationData[idx];
    }
  }
  
  // Находим уникальные сегменты (комнаты)
  const segments = new Map(); // segmentId -> { pixels: [], bounds: {} }
  
  for (let y = 0; y < segHeight; y++) {
    for (let x = 0; x < segWidth; x++) {
      const segmentId = mask[y][x];
      
      if (!segments.has(segmentId)) {
        segments.set(segmentId, {
          pixels: [],
          minX: x,
          maxX: x,
          minY: y,
          maxY: y
        });
      }
      
      const segment = segments.get(segmentId);
      segment.pixels.push({ x, y });
      segment.minX = Math.min(segment.minX, x);
      segment.maxX = Math.max(segment.maxX, x);
      segment.minY = Math.min(segment.minY, y);
      segment.maxY = Math.max(segment.maxY, y);
    }
  }
  
  // Преобразуем сегменты в комнаты
  let roomIndex = 1;
  for (const [segmentId, segment] of segments.entries()) {
    // Пропускаем фоновые сегменты (обычно класс 0)
    if (segmentId === 0) continue;
    
    const width = (segment.maxX - segment.minX) * scaleX;
    const height = (segment.maxY - segment.minY) * scaleY;
    const area = width * height; // Приблизительная площадь в пикселях
    
    // Фильтруем слишком маленькие сегменты (шум)
    if (area < 1000) continue; // Минимум ~1000 пикселей
    
    // Создаем прямоугольную комнату из границ сегмента
    // (можно улучшить, найдя точный контур)
    const vertices = [
      { x: segment.minX * scaleX, y: segment.minY * scaleY },
      { x: segment.maxX * scaleX, y: segment.minY * scaleY },
      { x: segment.maxX * scaleX, y: segment.maxY * scaleY },
      { x: segment.minX * scaleX, y: segment.maxY * scaleY }
    ];
    
    // Оцениваем площадь в м² (нужен масштаб, пока используем приближение)
    const areaM2 = area / 10000; // Примерное преобразование (зависит от масштаба)
    
    rooms.push({
      name: `Комната ${roomIndex}`,
      vertices,
      area: areaM2,
      isLivingRoom: areaM2 >= 8, // Комнаты >= 8 м² считаем жилыми
      width: width,
      height: height
    });
    
    roomIndex++;
  }
  
  return rooms;
}

/**
 * Извлечение метаданных с помощью ML
 */
async function extractMetadataML(image) {
  const models = getModels();
  
  if (!models.metadataExtraction) {
    console.warn('ML модель метаданных недоступна, используем OCR fallback');
    return null;
  }
  
  try {
    const tf = await getTensorFlow();
    const { tensor } = await imageToTensor(image, [512, 512]);
    
    // Предсказание модели
    const prediction = models.metadataExtraction.predict(tensor);
    const metadataData = await prediction.data();
    prediction.dispose();
    tensor.dispose();
    
    // Преобразуем выход модели в метаданные
    const metadata = parseMetadataFromMLOutput(metadataData);
    
    return metadata;
  } catch (error) {
    console.error('Ошибка ML извлечения метаданных:', error);
    return null;
  }
}

/**
 * Парсит выход ML модели в метаданные
 */
function parseMetadataFromMLOutput(modelOutput) {
  // Зависит от формата вывода модели
  // Может быть классификация, регрессия или sequence-to-sequence
  
  return {
    area: null,
    address: null,
    ceilingHeight: null,
    scale: null,
    rooms: []
  };
}

/**
 * Главная функция распознавания плана с использованием ML
 */
export async function recognizePlanML(file) {
  try {
    // Инициализируем модели (ленивая загрузка)
    const models = await loadAllModels();
    
    let image = null;
    let metadata = {};
    const fileType = file.type || file.name.split('.').pop().toLowerCase();
    
    // Обработка PDF
    if (fileType === 'pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      console.log('Обработка PDF файла...');
      const pdfModule = await getPdfProcessor();
      image = await pdfModule.extractImageFromPDF(file);
      
      // Пытаемся извлечь метаданные из текста PDF
      try {
        const text = await pdfModule.extractTextFromPDF(file);
        metadata = pdfModule.parseMetadataFromText(text);
      } catch (error) {
        console.warn('Не удалось извлечь текст из PDF:', error);
      }
    }
    // Обработка изображений
    else if (fileType.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(fileType)) {
      console.log('Обработка изображения...');
      const { loadImageFromFile } = await import('./imageProcessor.js');
      image = await loadImageFromFile(file);
      
      // OCR для метаданных (fallback, если ML недоступен)
      try {
        const ocrModule = await getOcrProcessor();
        const ocrText = await ocrModule.extractTextFromImage(image);
        const ocrMetadata = ocrModule.parseMetadataFromOCRText(ocrText);
        metadata = { ...metadata, ...ocrMetadata };
      } catch (error) {
        console.warn('Не удалось выполнить OCR:', error);
      }
    } else {
      throw new Error('Неподдерживаемый формат файла');
    }
    
    if (!image) {
      throw new Error('Не удалось загрузить изображение');
    }
    
    // Проверяем, что модели загружены
    if (!areMLModelsLoaded()) {
      return {
        success: false,
        error: 'ML модели не загружены. TensorFlow Hub недоступен из-за CORS. Разместите модели локально в public/models/ или используйте прокси-сервер.'
      };
    }
    
    console.log('Используем нейросети (ML) для распознавания плана...');
    
    // Параллельная обработка с помощью ML моделей
    const [wallsResult, roomsResult, metadataResult] = await Promise.allSettled([
      detectWallsML(image),
      segmentRoomsML(image),
      extractMetadataML(image)
    ]);
    
    const walls = wallsResult.status === 'fulfilled' ? wallsResult.value : null;
    const rooms = roomsResult.status === 'fulfilled' ? roomsResult.value : null;
    const mlMetadata = metadataResult.status === 'fulfilled' ? metadataResult.value : null;
    
    // Проверяем, что ML модели дали результат
    if (!walls || walls.length === 0) {
      throw new Error('Нейросеть не смогла обнаружить стены на плане. Проверьте качество изображения.');
    }
    
    if (!rooms || rooms.length === 0) {
      throw new Error('Нейросеть не смогла обнаружить комнаты на плане. Проверьте качество изображения.');
    }
    
    // Форматируем результат ML
    const { formatWalls, formatRooms } = await import('./imageProcessor.js');
    const scale = mlMetadata?.scale || metadata.scale || estimateScale(walls, metadata.area);
    
    const roomsText = formatRooms(rooms, scale);
    const wallsText = formatWalls(walls, scale);
    
    // Определяем тип квартиры
    const livingRoomsCount = rooms.filter(r => r.isLivingRoom !== false && r.area >= 8).length;
    const apartmentType = determineApartmentType(livingRoomsCount);
    
    return {
      success: true,
      rooms: roomsText,
      walls: wallsText,
      area: mlMetadata?.area || metadata.area || calculateTotalArea(rooms),
      ceilingHeight: mlMetadata?.ceilingHeight || metadata.ceilingHeight,
      address: mlMetadata?.address || metadata.address,
      apartmentType: apartmentType,
      stats: {
        roomsFound: rooms.length,
        livingRoomsFound: livingRoomsCount,
        wallsFound: walls.length,
        method: 'ml-neural-network'
      }
    };
    
  } catch (error) {
    console.error('Ошибка ML распознавания:', error);
    return {
      success: false,
      error: error.message || 'Неизвестная ошибка при распознавании плана'
    };
  }
}

/**
 * Проверяет, загружены ли ML модели
 */
export function areMLModelsLoaded() {
  const models = getModels();
  return models.wallDetection !== null || models.roomSegmentation !== null;
}

/**
 * Вспомогательные функции
 */
function estimateScale(walls, knownArea) {
  if (!walls || walls.length === 0) return 0.005;
  // Упрощенная оценка масштаба
  return 0.005; // По умолчанию 1:200
}

function calculateTotalArea(rooms) {
  if (!rooms || rooms.length === 0) return null;
  return rooms
    .filter(r => r.area >= 1.5)
    .reduce((sum, r) => sum + (r.area || 0), 0)
    .toFixed(1);
}

function determineApartmentType(livingRoomsCount) {
  if (livingRoomsCount === 0) return 'Студия';
  if (livingRoomsCount === 1) return '1-комнатная';
  if (livingRoomsCount === 2) return '2-комнатная';
  if (livingRoomsCount === 3) return '3-комнатная';
  return '3+ комнатная';
}

