/**
 * Утилиты для обработки PDF файлов (техпаспортов БТИ)
 * Использует pdfjs-dist от Mozilla
 */

import * as pdfjsLib from 'pdfjs-dist';

// Указываем путь к worker для pdfjs
// Для Vite и современных браузеров используем CDN или локальный worker
if (typeof window !== 'undefined') {
  try {
    // Пытаемся использовать CDN worker (более надёжно)
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  } catch (error) {
    console.warn('Не удалось загрузить worker из CDN, используем локальный');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }
}

/**
 * Извлекает изображение первой страницы PDF
 */
export async function extractImageFromPDF(file) {
  try {
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
 * Парсит метаданные из текста PDF (площадь, адрес)
 */
export function parseMetadataFromText(text) {
  const metadata = {
    area: null,
    address: null,
    ceilingHeight: null
  };
  
  // Поиск площади (разные варианты написания)
  const areaPatterns = [
    /площадь[:\s]+(\d+[.,]\d+|\d+)\s*м[²2]/gi,
    /общая\s+площадь[:\s]+(\d+[.,]\d+|\d+)/gi,
    /(\d+[.,]\d+|\d+)\s*м[²2]\s*общая/gi,
    /S\s*общ[ая]*[:\s]+(\d+[.,]\d+|\d+)/gi
  ];
  
  for (const pattern of areaPatterns) {
    const match = text.match(pattern);
    if (match) {
      const areaStr = match[0].replace(/[^\d.,]/g, '').replace(',', '.');
      metadata.area = parseFloat(areaStr);
      if (metadata.area) break;
    }
  }
  
  // Поиск адреса (упрощённо - ищем паттерны адресов)
  const addressPatterns = [
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
    /высота[:\s]+(\d+[.,]\d+|\d+)\s*м/gi,
    /потол[ки]*[:\s]+(\d+[.,]\d+|\d+)\s*м/gi,
    /H[:\s]+(\d+[.,]\d+|\d+)\s*м/gi
  ];
  
  for (const pattern of heightPatterns) {
    const match = text.match(pattern);
    if (match) {
      const heightStr = match[1].replace(',', '.');
      metadata.ceilingHeight = parseFloat(heightStr);
      if (metadata.ceilingHeight) break;
    }
  }
  
  return metadata;
}

