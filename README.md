# HomePlanner3D — цифровой помощник перепланировки

Проект состоит из двух частей:

- Unity-проект для интерактивной 2.5D/3D визуализации квартиры и игрового конструктора: `3D/Hackaton`
- Веб‑клиент на Vue 3 + Vite с распознаванием планов, формированием данных проекта и отправкой на GraphQL API: `client`

Подходит для: загрузки техпаспортов/эскизов, автоматического распознавания планов, редактирования и проверки норм, визуализации «сверху» и от первого лица, генерации AI‑сценариев и подготовки данных для БТИ.

## Содержание

- Обзор архитектуры
- Unity: сцена, скрипты, управление
- Веб‑клиент: стек, команды, модули
- Распознавание планов (ML + алгоритмы)
- GraphQL API и переменные окружения
- Быстрый старт (Unity и веб‑клиент)
- Структура данных проекта

## Обзор архитектуры

- Визуализация и интерактив (Unity 2022.3.62f3): построение стен/пола/потолка, окна/двери, телепорт через двери, расстановка базовых объектов.
- Клиент (Vue 3 + Vite): форма ввода, загрузка PDF/изображений/DWG/DXF/IFC, распознавание геометрии, сбор payload JSON, отправка в API для консультаций/проверок.
- Распознавание: сначала пытается ML (TensorFlow.js, DeepLabV3+), при недоступности — алгоритмический пайплайн (Sobel → линии → стены → комнаты) + OCR (Tesseract.js) и PDF‑парсинг (pdfjs‑dist).

## Unity (3D/Hackaton)

- Версия Unity: смотрите `3D/Hackaton/ProjectSettings/ProjectVersion.txt` (2022.3.62f3).
- Базовая сцена: `3D/Hackaton/Assets/Scenes/SampleScene.unity`.
- Материалы/префабы: `Assets/Materials`, `Assets/Models`, `Assets/VNB - Gaming Set`.

### Ключевые скрипты

- Генерация карты и объектов: `3D/Hackaton/Assets/Scripts/CreateMap.cs`
  - Класс `SimpleMapGenerator` строит стены/окна/двери, пол/потолок, управляет слоями и телепортом
    - Точка входа: `GenerateMap()` в `3D/Hackaton/Assets/Scripts/CreateMap.cs:70`
    - Построение стен: `CreateWalls()` в `3D/Hackaton/Assets/Scripts/CreateMap.cs:91`, `CreateWallBetweenPoints(...)` в `3D/Hackaton/Assets/Scripts/CreateMap.cs:141`
    - Окна: `CreateWindows()` в `3D/Hackaton/Assets/Scripts/CreateMap.cs:181`, `CreateWindowBetweenPoints(...)` в `3D/Hackaton/Assets/Scripts/CreateMap.cs:225`
    - Двери: `CreateDoors()` в `3D/Hackaton/Assets/Scripts/CreateMap.cs:266`, `CreateDoorBetweenPoints(...)` в `3D/Hackaton/Assets/Scripts/CreateMap.cs:307`
    - Телепорт: `GetExactTeleportPosition(...)` в `3D/Hackaton/Assets/Scripts/CreateMap.cs:391`
    - Пол/потолок: `CreateFloor()` в `3D/Hackaton/Assets/Scripts/CreateMap.cs:466`, `CreateCeiling()` в `3D/Hackaton/Assets/Scripts/CreateMap.cs:505`
  - Публичные методы для конфигурации: `SetPoints(...)`, `SetConnections(...)`, `SetWallDimensions(...)`, `SetWindows(...)`, `SetDoors(...)` (см. диапазон `3D/Hackaton/Assets/Scripts/CreateMap.cs:632–697`)

- Телепорт через двери: `3D/Hackaton/Assets/Scripts/DoorTeleportSyst.cs`
  - Класс `DoorTeleportSystem` ищет объект двери по центру экрана и переносит игрока на противоположную сторону
    - Поле/инициализация: `DoorTeleportSystem` в `3D/Hackaton/Assets/Scripts/DoorTeleportSyst.cs:4`
    - Захват и телепорт: `TryTeleportThroughDoor()` в `3D/Hackaton/Assets/Scripts/DoorTeleportSyst.cs:49`, `TeleportPlayer(...)` в `3D/Hackaton/Assets/Scripts/DoorTeleportSyst.cs:65`
    - Клавиша действия: `Update()` с `KeyCode.F` в `3D/Hackaton/Assets/Scripts/DoorTeleportSyst.cs:41`

- Расстановка/удаление объектов: `3D/Hackaton/Assets/Scripts/PanelScript.cs`
  - Клавиши выбора пресета: `Update()` (цифры 1–7) в `3D/Hackaton/Assets/Scripts/PanelScript.cs:86`
  - Установка: `PlaceObject()` в `3D/Hackaton/Assets/Scripts/PanelScript.cs:25` (привязка к тегам `Floor`/`Ceiling`)
  - Удаление: `DeleteObject()` в `3D/Hackaton/Assets/Scripts/PanelScript.cs:127`

- Пример конфигурации комнаты: `3D/Hackaton/Assets/Scripts/WaiterInfo.cs`
  - Класс `TestMap` программно задаёт точки, стены, окна и двери и вызывает `GenerateMap()`
    - Сбор данных: `TestRoomWithDoors()` в `3D/Hackaton/Assets/Scripts/WaiterInfo.cs:22`
    - Назначение слоя дверей: `AssignDoorLayers()` в `3D/Hackaton/Assets/Scripts/WaiterInfo.cs:109`

### Управление в Unity

- Перемещение от первого лица — в составе сцены (контроллер из пакета `Mini First Person Controller`).
- Телепорт через дверь: `F`.
- Выбор пресета объекта: `1`–`7`.
- Установить объект: `E` (прицел — центр экрана, на `Floor`/`Ceiling`).
- Удалить объект: `Q`.

## Веб‑клиент (client)

- Стек: Vue 3, Vite (`rolldown-vite`), TensorFlow.js, Tesseract.js, pdfjs‑dist.
- Команды:
  - `npm install`
  - `npm run dev` — запуск в режиме разработки
  - `npm run build` — сборка продакшн
  - `npm run preview` — предпросмотр собранного билда
- Основной экран/логика: `client/src/App.vue`
  - Загрузка файлов, распознавание, сбор JSON, авторизация/регистрация, отправка в API.
  - Обработчик загрузки и распознавания: `handleFileChange` в `client/src/App.vue:1085`
  - Отправка данных на API: `sendToApi(...)` в `client/src/App.vue:1021`

### Модули распознавания

- Входная точка: `recognizePlan(file)` в `client/src/utils/planRecognizer.js:19`.
- ML‑режим: `recognizePlanML(...)` в `client/src/utils/mlPlanRecognizer.js:364`
  - Загрузка моделей: `loadAllModels(...)` в `client/src/utils/mlModelLoader.js:163`
  - Детекция стен/комнат: `detectWallsML(...)`, `segmentRoomsML(...)`
  - OCR и PDF: `ocrProcessor.js`, `pdfProcessor.js`
- Алгоритмический fallback: `imageProcessor.js`
  - Обработка: `grayscale(...)`, `threshold(...)`, `detectEdges(...)`, `detectLines(...)`
  - Стены/комнаты: `groupLinesIntoWalls(...)`, `detectRooms(...)`
- Формирование JSON: методы `formatWalls(...)`, `formatRooms(...)` в `client/src/utils/imageProcessor.js`

## GraphQL API

- Endpoint: задаётся `VITE_GRAPHQL_ENDPOINT` (по умолчанию `'/query'`), см. `client/src/utils/graphqlClient.js:11`.
- Запросы:
  - Получение пользователя: `GET_USER_QUERY` в `client/src/App.vue:871`
  - Регистрация: `REGISTER_MUTATION` в `client/src/App.vue:859`
  - Отправка данных в BTI‑агент: `ASK_BTI_AGENT_MUTATION` в `client/src/utils/graphqlClient.js:255`
- Клиент формирует тело `{ query, variables }` и ожидает JSON; HTML‑ответ интерпретируется как ошибка конфигурации сервера (`client/src/utils/graphqlClient.js:64`).

### Переменные окружения (client)

- `VITE_ENABLE_PROJECT_API` — `'true'`|`'false'`, включает/выключает отправку на бэкенд (по умолчанию включено).
- `VITE_GRAPHQL_ENDPOINT` — адрес GraphQL (`/query` по умолчанию).
- `VITE_BTI_PROMPT_LIMIT` — ограничение длины текста при отправке в BTI‑агент.

## Быстрый старт

### Unity

1. Установите Unity 2022.3.62f3.
2. Откройте папку проекта: `3D/Hackaton`.
3. Загрузите сцену `Assets/Scenes/SampleScene.unity` и нажмите Play.
4. Для теста генерации — добавьте на сцену объект с компонентом `SimpleMapGenerator` и запустите `TestMap` из `Assets/Scripts/WaiterInfo.cs`.

### Веб‑клиент

1. Перейдите в каталог `client`.
2. Установите зависимости: `npm install`.
3. Запустите разработку: `npm run dev` (по умолчанию http://localhost:5173).
4. При необходимости задайте переменные окружения (`.env`):
   - `VITE_GRAPHQL_ENDPOINT=http://localhost:8080/query`
   - `VITE_ENABLE_PROJECT_API=true`

## Структура данных проекта (payload)

Клиент формирует JSON с данными плана, геометрии и ограничений и отправляет в API:

```json
{
  "plan": {
    "address": "Москва, ул. Примерная, д. 1",
    "area": 70,
    "source": "PDF / техпаспорт",
    "layoutType": "2-комнатная",
    "familyProfile": "Семья с ребёнком",
    "goal": "Больше света и рабочее место",
    "prompt": "Объединить кухню и гостиную",
    "ceilingHeight": 2.7,
    "floorDelta": 0,
    "recognitionStatus": "success",
    "file": { "name": "plan.pdf", "size": 123456, "type": "application/pdf" }
  },
  "geometry": { "rooms": [ { "id": "R1", "name": "Комната 1", "height": 2.7, "vertices": [ { "x": 0, "y": 0 }, { "x": 5.2, "y": 0 }, { "x": 5.2, "y": 4.1 }, { "x": 0, "y": 4.1 } ] } ] },
  "walls": [ { "id": "W1", "start": { "x": 0, "y": 0 }, "end": { "x": 5.2, "y": 0 }, "loadBearing": true, "thickness": 0.2 } ],
  "constraints": { "forbiddenMoves": ["нельзя переносить кухню над жилой"], "regionRules": "СНиП 31-02; ЖК РФ ст.25" },
  "timestamp": "2025-11-29T00:00:00.000Z"
}
```

## Замечания по ресурсам

- Папки `Mini First Person Controller` и `VNB - Gaming Set` содержат сторонние ассеты для демо визуализации и базовых объектов.
- Убедитесь, что слои (`Doors`, теги `Floor`/`Ceiling`) настроены в проекте Unity для корректной телепортации и установки объектов.
