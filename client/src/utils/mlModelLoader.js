/**
 * Модуль загрузки и управления ML-моделями для распознавания планов
 * Использует TensorFlow.js для работы с нейросетями в браузере
 */

let tf = null;
let wallDetectionModel = null;
let roomSegmentationModel = null;
let metadataExtractionModel = null;
let modelsLoaded = false;

/**
 * Ленивая инициализация TensorFlow.js
 */
async function initTensorFlow() {
  if (tf) return tf;
  
  try {
    tf = await import('@tensorflow/tfjs');
    console.log('TensorFlow.js загружен успешно');
    return tf;
  } catch (error) {
    console.error('Ошибка загрузки TensorFlow.js:', error);
    throw new Error('Не удалось загрузить TensorFlow.js. Убедитесь, что библиотека установлена.');
  }
}

/**
 * Загружает модель для детекции стен
 * Использует DeepLabV3+ для сегментации стен (можно использовать ту же модель)
 */
async function loadWallDetectionModel(modelPath = null) {
  try {
    const tfModule = await initTensorFlow();
    
    // Если путь указан, используем его
    if (modelPath) {
      try {
        wallDetectionModel = await tfModule.loadLayersModel(modelPath);
        console.log('Модель детекции стен загружена с указанного пути');
        return wallDetectionModel;
      } catch (error) {
        console.warn('Не удалось загрузить с указанного пути');
      }
    }
    
    // Пробуем загрузить с Google Storage (поддерживает CORS)
    try {
      const googleStorageUrl = 'https://storage.googleapis.com/tfjs-models/tfjs/deeplab_pascal/model.json';
      console.log('Загрузка DeepLabV3+ для стен с Google Storage...');
      wallDetectionModel = await tfModule.loadLayersModel(googleStorageUrl);
      console.log('✅ DeepLabV3+ для стен загружена успешно');
      return wallDetectionModel;
    } catch (googleError) {
      console.warn('Не удалось загрузить с Google Storage:', googleError);
      
      // Пробуем локальную модель
      try {
        const wallPath = '/models/wall-detection/model.json';
        wallDetectionModel = await tfModule.loadLayersModel(wallPath);
        console.log('✅ Модель детекции стен загружена локально');
        return wallDetectionModel;
      } catch (wallError) {
        // Если нет в wall-detection, пробуем deeplab (можно использовать одну модель для обеих задач)
        try {
          const deeplabPath = '/models/deeplab/model.json';
          wallDetectionModel = await tfModule.loadLayersModel(deeplabPath);
          console.log('✅ Модель для стен загружена из deeplab');
          return wallDetectionModel;
        } catch (localError) {
          console.warn('Локальная модель недоступна. Разместите model.json в public/models/wall-detection/ или public/models/deeplab/');
          return null;
        }
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки модели детекции стен:', error);
    return null;
  }
}

/**
 * Загружает модель для сегментации комнат
 * Использует DeepLabV3+ с TensorFlow Hub (бесплатно, без обучения)
 */
async function loadRoomSegmentationModel(modelPath = null) {
  try {
    const tfModule = await initTensorFlow();
    
    // Если путь указан, используем его
    if (modelPath) {
      try {
        roomSegmentationModel = await tfModule.loadLayersModel(modelPath);
        console.log('Модель сегментации комнат загружена с указанного пути');
        return roomSegmentationModel;
      } catch (error) {
        console.warn('Не удалось загрузить с указанного пути, пробуем TensorFlow Hub');
      }
    }
    
    // Пробуем загрузить готовую модель с Google Storage (поддерживает CORS)
    try {
      const googleStorageUrl = 'https://storage.googleapis.com/tfjs-models/tfjs/deeplab_pascal/model.json';
      console.log('Загрузка DeepLabV3+ с Google Storage...');
      roomSegmentationModel = await tfModule.loadLayersModel(googleStorageUrl);
      console.log('✅ DeepLabV3+ модель загружена успешно с Google Storage');
      return roomSegmentationModel;
    } catch (googleError) {
      console.warn('Не удалось загрузить с Google Storage:', googleError);
      
      // Fallback на локальную модель
      try {
        // Пробуем deeplab (если скопировали туда)
        const deeplabPath = '/models/deeplab/model.json';
        roomSegmentationModel = await tfModule.loadLayersModel(deeplabPath);
        console.log('✅ Модель сегментации загружена из deeplab');
        return roomSegmentationModel;
      } catch (deeplabError) {
        // Пробуем room-segmentation
        try {
          const localPath = '/models/room-segmentation/model.json';
          roomSegmentationModel = await tfModule.loadLayersModel(localPath);
          console.log('✅ Модель сегментации загружена локально');
          return roomSegmentationModel;
        } catch (localError) {
          console.warn('Локальная модель недоступна. Разместите model.json в public/models/deeplab/');
          return null;
        }
      }
    }
  } catch (error) {
    console.error('Ошибка загрузки модели сегментации:', error);
    return null;
  }
}

/**
 * Загружает модель для извлечения метаданных (площадь, адрес и т.д.)
 */
async function loadMetadataExtractionModel(modelPath = null) {
  try {
    const tfModule = await initTensorFlow();
    const defaultPath = modelPath || '/models/metadata-extraction/model.json';
    
    try {
      metadataExtractionModel = await tfModule.loadLayersModel(defaultPath);
      console.log('Модель извлечения метаданных загружена');
      return metadataExtractionModel;
    } catch (loadError) {
      console.warn('Не удалось загрузить модель метаданных, используем OCR fallback');
      return null;
    }
  } catch (error) {
    console.error('Ошибка загрузки модели метаданных:', error);
    return null;
  }
}

/**
 * Инициализирует все модели
 * @param {Object} config - Конфигурация путей к моделям
 */
export async function loadAllModels(config = {}) {
  if (modelsLoaded) {
    return {
      wallDetection: wallDetectionModel,
      roomSegmentation: roomSegmentationModel,
      metadataExtraction: metadataExtractionModel
    };
  }
  
  try {
    await initTensorFlow();
    
    const [wallModel, roomModel, metadataModel] = await Promise.all([
      loadWallDetectionModel(config.wallModelPath),
      loadRoomSegmentationModel(config.roomModelPath),
      loadMetadataExtractionModel(config.metadataModelPath)
    ]);
    
    wallDetectionModel = wallModel;
    roomSegmentationModel = roomModel;
    metadataExtractionModel = metadataModel;
    
    modelsLoaded = true;
    
    return {
      wallDetection: wallDetectionModel,
      roomSegmentation: roomSegmentationModel,
      metadataExtraction: metadataExtractionModel
    };
  } catch (error) {
    console.error('Ошибка инициализации моделей:', error);
    modelsLoaded = true; // Помечаем как загруженные, чтобы не повторять попытки
    return {
      wallDetection: null,
      roomSegmentation: null,
      metadataExtraction: null
    };
  }
}

/**
 * Проверяет, загружены ли модели
 */
export function areModelsLoaded() {
  return modelsLoaded && (wallDetectionModel !== null || roomSegmentationModel !== null);
}

/**
 * Получает экземпляр TensorFlow
 */
export async function getTensorFlow() {
  return await initTensorFlow();
}

/**
 * Получает загруженные модели
 */
export function getModels() {
  return {
    wallDetection: wallDetectionModel,
    roomSegmentation: roomSegmentationModel,
    metadataExtraction: metadataExtractionModel
  };
}

