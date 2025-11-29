/**
 * Утилиты для обработки PDF файлов (техпаспортов БТИ)
 * Использует pdfjs-dist от Mozilla
 */

// Ленивая инициализация pdfjs (загружается только при необходимости)
let pdfjsLib = null;
let pdfjsInitialized = false;

async function initPdfJs() {
  if (pdfjsInitialized) return;
  
  try {
    pdfjsLib = await import('pdfjs-dist');
    
    // Указываем путь к worker для pdfjs
    if (typeof window !== 'undefined') {
      try {
        // Используем локальный worker из node_modules
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();
      } catch (error) {
        // Fallback на CDN только если локальный не работает
        console.warn('Не удалось загрузить локальный worker, используем CDN');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      }
    }
    
    pdfjsInitialized = true;
  } catch (error) {
    console.error('Ошибка инициализации PDF.js:', error);
    throw new Error('Не удалось загрузить библиотеку PDF.js');
  }
}

/**
 * Извлекает изображение первой страницы PDF
 */
export async function extractImageFromPDF(file) {
  try {
    // Инициализируем PDF.js при первом использовании
    await initPdfJs();
    
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    // Берём первую страницу (обычно там план)
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });
    
    // Создаём canvas для рендеринга страницы
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // Рендерим страницу в canvas
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Конвертируем canvas в Image
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = canvas.toDataURL('image/png');
    });
  } catch (error) {
    console.error('Ошибка при обработке PDF:', error);
    throw new Error('Не удалось обработать PDF файл');
  }
}

/**
 * Извлекает текст из PDF (для поиска метаданных: площадь, адрес)
 */
export async function extractTextFromPDF(file) {
  try {
    // Инициализируем PDF.js при первом использовании
    await initPdfJs();
    
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Обрабатываем все страницы или первые 3 (обычно достаточно)
    const numPages = Math.min(pdf.numPages, 3);
    
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('Ошибка при извлечении текста из PDF:', error);
    return '';
  }
}

/**
 * Парсит метаданные из текста PDF или изображения (площадь, адрес, масштаб)
 */
export function parseMetadataFromText(text) {
  const metadata = {
    area: null,
    address: null,
    ceilingHeight: null,
    scale: null // масштаб (например, 1:200)
  };
  
  // Поиск масштаба (например, "Масштаб 1:200" или "1:200")
  const scalePatterns = [
    /масштаб[:\s]*(\d+)[:\s]*(\d+)/gi,
    /(\d+)[:\s]*:[\s]*(\d+)\s*масштаб/gi,
    /(\d+)[:\s]*:[\s]*(\d+)/gi // общий паттерн для 1:200
  ];
  
  for (const pattern of scalePatterns) {
    const match = text.match(pattern);
    if (match) {
      const parts = match[0].replace(/[^\d:]/g, '').split(':');
      if (parts.length === 2) {
        const num = parseFloat(parts[0]);
        const den = parseFloat(parts[1]);
        if (den > 0) {
          metadata.scale = num / den; // Например, 1:200 = 0.005
          break;
        }
      }
    }
  }
  
  // Поиск площади (разные варианты написания)
  const areaPatterns = [
    /площадь[:\s]+(\d+[.,]\d+|\d+)\s*м[²2]/gi,
    /общая\s+площадь[:\s]+(\d+[.,]\d+|\d+)/gi,
    /(\d+[.,]\d+|\d+)\s*м[²2]\s*общая/gi,
    /S\s*общ[ая]*[:\s]+(\d+[.,]\d+|\d+)/gi,
    // Поиск площади в виде "22 / 10.9" (номер комнаты / площадь)
    /(\d+)[\s\/]+(\d+[.,]\d+)/gi
  ];
  
  // Сначала ищем общую площадь, потом площади комнат
  for (let i = 0; i < areaPatterns.length - 1; i++) {
    const pattern = areaPatterns[i];
    const match = text.match(pattern);
    if (match) {
      const areaStr = match[0].replace(/[^\d.,]/g, '').replace(',', '.');
      const area = parseFloat(areaStr);
      if (area && area > 10 && area < 500) { // Разумные пределы для квартиры
        metadata.area = area;
        break;
      }
    }
  }
  
  // Если не нашли общую площадь, суммируем площади комнат
  if (!metadata.area) {
    const roomAreaPattern = /(\d+)[\s\/]+(\d+[.,]\d+)/g;
    let totalArea = 0;
    let roomCount = 0;
    let match;
    while ((match = roomAreaPattern.exec(text)) !== null) {
      const area = parseFloat(match[2].replace(',', '.'));
      if (area > 0.5 && area < 100) { // Разумные пределы для комнаты
        totalArea += area;
        roomCount++;
      }
    }
    if (roomCount > 0 && totalArea > 10) {
      metadata.area = totalArea.toFixed(1);
    }
  }
  
  // Поиск адреса (упрощённо - ищем паттерны адресов)
  const addressPatterns = [
    /ул\.?\s*[А-ЯЁ][А-Яа-яЁё]+[,\s]+№?\s*\d+/gi, // ул. Старокубанская, № 119
    /г\.?\s*[А-ЯЁ][а-яё]+[,\s]+(ул\.?|улица|пр\.?|проспект)[\sА-ЯЁа-яё\d.,]+/gi,
    /Москва[,\s]+[А-ЯЁа-яё\d.,]+/gi,
    /Санкт-Петербург[,\s]+[А-ЯЁа-яё\d.,]+/gi
  ];
  
  for (const pattern of addressPatterns) {
    const match = text.match(pattern);
    if (match && match[0].length > 10) {
      metadata.address = match[0].trim();
      break;
    }
  }
  
  // Поиск высоты потолков
  const heightPatterns = [
    /[hH]\s*[=:]\s*(\d+[.,]\d+|\d+)/gi, // h=2.53 или H=2.83
    /высота[:\s]+(\d+[.,]\d+|\d+)\s*м/gi,
    /потол[ки]*[:\s]+(\d+[.,]\d+|\d+)\s*м/gi,
    /H[:\s]+(\d+[.,]\d+|\d+)\s*м/gi
  ];
  
  for (const pattern of heightPatterns) {
    const match = text.match(pattern);
    if (match) {
      const heightStr = (match[1] || match[0].replace(/[^\d.,]/g, '')).replace(',', '.');
      const height = parseFloat(heightStr);
      if (height > 2 && height < 5) { // Разумные пределы
        metadata.ceilingHeight = height.toFixed(2);
        break;
      }
    }
  }
  
  return metadata;
}

