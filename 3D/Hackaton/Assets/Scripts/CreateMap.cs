using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class SimpleMapGenerator : MonoBehaviour
{
    [Header("Настройки по умолчанию")]
    public float defaultWallHeight = 2f;
    public float defaultWallThickness = 0.2f;
    public Material wallMaterial;
    public Material windowMaterial;
    public Material doorMaterial;

    [Header("Настройки пола и потолка")]
    public bool generateFloor = true;
    public bool generateCeiling = true;
    public float floorThickness = 0.1f;
    public Material floorMaterial;
    public Material ceilingMaterial;

    [Header("Настройки автоматической ширины")]
    public float windowWidthOffset = 0.01f;
    public float doorWidthOffset = 0.01f;

    [Header("Настройки телепортации")]
    public float teleportDistance = 1.5f; // Расстояние телепортации за дверь
    public LayerMask doorLayerMask = 1; // Слой для обнаружения дверей

    [Header("Входные данные")]
    public Vector2[] points; // Массив 2D точек (X,Z координаты)
    public int[] connections; // Пары индексов для соединения точек
    public float[] wallHeights; // Высота для каждой стены
    public float[] wallThicknesses; // Толщина для каждой стены

    [Header("Данные окон")]
    public WindowData[] windows; // Данные о окнах

    [Header("Данные дверей")]
    public DoorData[] doors; // Данные о дверях

    private List<GameObject> walls = new List<GameObject>();
    private List<GameObject> floors = new List<GameObject>();
    private List<GameObject> ceilings = new List<GameObject>();
    private List<GameObject> windowObjects = new List<GameObject>();
    private List<GameObject> doorObjects = new List<GameObject>();

    [System.Serializable]
    public class WindowData
    {
        public Vector2[] points; // 2D точки окна (минимум 2 точки)
        public int[] connections; // Соединения точек окна
        public float height; // Высота окна
        public int wallIndex; // Индекс стены, на которой находится окно
    }

    [System.Serializable]
    public class DoorData
    {
        public Vector2[] points; // 2D точки двери (минимум 2 точки)
        public int[] connections; // Соединения точек двери
        public float height; // Высота двери
        public int wallIndex; // Индекс стены, на которой находится дверь
    }

    // События для отслеживания состояния генерации
    public System.Action OnMapGenerationStarted;
    public System.Action OnMapGenerationCompleted;

    // Флаг готовности карты
    public bool IsMapReady { get; private set; } = false;

    void Start()
    {
        GenerateMap();
    }

    public void GenerateMap()
    {
        IsMapReady = false;
        OnMapGenerationStarted?.Invoke();

        ClearMap();

        if (points == null || points.Length < 2)
        {
            Debug.LogError("Недостаточно точек для генерации карты");
            return;
        }

        CreateWalls();
        CreateWindows();
        CreateDoors();

        if (generateFloor)
            CreateFloor();

        if (generateCeiling)
            CreateCeiling();

        IsMapReady = true;
        OnMapGenerationCompleted?.Invoke();
    }

    void CreateWalls()
    {
        if (connections == null || connections.Length < 2 || connections.Length % 2 != 0)
        {
            Debug.LogError("Некорректный массив соединений");
            return;
        }

        int wallCount = connections.Length / 2;

        // Проверяем массивы высот и толщин
        if (wallHeights == null || wallHeights.Length != wallCount)
        {
            Debug.LogWarning($"Массив высот не задан или неверной длины. Используется высота по умолчанию: {defaultWallHeight}");
            wallHeights = new float[wallCount];
            for (int i = 0; i < wallCount; i++)
            {
                wallHeights[i] = defaultWallHeight;
            }
        }

        if (wallThicknesses == null || wallThicknesses.Length != wallCount)
        {
            Debug.LogWarning($"Массив толщин не задан или неверной длины. Используется толщина по умолчанию: {defaultWallThickness}");
            wallThicknesses = new float[wallCount];
            for (int i = 0; i < wallCount; i++)
            {
                wallThicknesses[i] = defaultWallThickness;
            }
        }

        for (int i = 0; i < connections.Length; i += 2)
        {
            int startIndex = connections[i];
            int endIndex = connections[i + 1];
            int wallIndex = i / 2;

            if (startIndex >= points.Length || endIndex >= points.Length)
            {
                Debug.LogError($"Неверный индекс точки: {startIndex} или {endIndex}");
                continue;
            }

            float height = wallHeights[wallIndex];
            float thickness = wallThicknesses[wallIndex];

            CreateWallBetweenPoints(points[startIndex], points[endIndex], height, thickness, wallIndex);
        }
    }

    void CreateWallBetweenPoints(Vector2 start, Vector2 end, float height, float thickness, int wallIndex)
    {
        GameObject wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
        wall.name = $"Wall_{wallIndex}_{start}_{end}";
        wall.transform.parent = this.transform;

        // Вычисляем позицию (середина между точками)
        Vector3 position = new Vector3(
            (start.x + end.x) / 2f,
            height / 2f, // Половина высоты чтобы стояла на земле
            (start.y + end.y) / 2f
        );

        wall.transform.position = position;

        // Вычисляем длину и направление
        Vector2 direction = end - start;
        float length = direction.magnitude;

        // Поворачиваем куб в нужном направлении
        float angle = Mathf.Atan2(direction.x, direction.y) * Mathf.Rad2Deg;
        wall.transform.rotation = Quaternion.Euler(0, -angle, 0);

        // Масштабируем куб (толщина, высота, длина)
        wall.transform.localScale = new Vector3(
            thickness, // Толщина для этой стены
            height,    // Высота для этой стены
            length     // Длина (вычисляется автоматически)
        );

        // Применяем материал
        MeshRenderer renderer = wall.GetComponent<MeshRenderer>();
        if (renderer != null && wallMaterial != null)
        {
            renderer.material = wallMaterial;
        }

        walls.Add(wall);
    }

    void CreateWindows()
    {
        if (windows == null || windows.Length == 0) return;

        for (int i = 0; i < windows.Length; i++)
        {
            WindowData window = windows[i];
            if (window.points == null || window.points.Length < 2 || window.connections == null)
            {
                Debug.LogWarning($"Некорректные данные для окна {i}");
                continue;
            }

            CreateWindow(window, i);
        }
    }

    void CreateWindow(WindowData window, int windowIndex)
    {
        // Создаем окно между двумя точками
        for (int i = 0; i < window.connections.Length; i += 2)
        {
            int startIndex = window.connections[i];
            int endIndex = window.connections[i + 1];

            if (startIndex >= window.points.Length || endIndex >= window.points.Length)
            {
                Debug.LogError($"Неверный индекс точки окна: {startIndex} или {endIndex}");
                continue;
            }

            Vector2 startPoint = window.points[startIndex];
            Vector2 endPoint = window.points[endIndex];

            // Получаем высоту стены, на которой находится окно
            float wallHeight = GetWallHeight(window.wallIndex);

            // Автоматически вычисляем ширину окна
            float windowWidth = GetWallThickness(window.wallIndex) + windowWidthOffset;

            CreateWindowBetweenPoints(startPoint, endPoint, window.height, windowWidth, wallHeight, windowIndex, i / 2);
        }
    }

    void CreateWindowBetweenPoints(Vector2 start, Vector2 end, float windowHeight, float windowWidth, float wallHeight, int windowIndex, int segmentIndex)
    {
        GameObject windowObj = GameObject.CreatePrimitive(PrimitiveType.Cube);
        windowObj.name = $"Window_{windowIndex}_{segmentIndex}";
        windowObj.transform.parent = this.transform;

        windowObj.tag = "Window";
        // Вычисляем позицию (середина между точками окна)
        // Окно размещается посередине стены по высоте
        Vector3 position = new Vector3(
            (start.x + end.x) / 2f,
            wallHeight / 2f, // Окно точно посередине стены по высоте
            (start.y + end.y) / 2f
        );

        windowObj.transform.position = position;

        // Вычисляем длину и направление
        Vector2 windowDirection = end - start;
        float windowLength = windowDirection.magnitude;

        // Поворачиваем окно в нужном направлении
        float angle = Mathf.Atan2(windowDirection.x, windowDirection.y) * Mathf.Rad2Deg;
        windowObj.transform.rotation = Quaternion.Euler(0, -angle, 0);

        // Масштабируем окно (толщина, высота, длина)
        windowObj.transform.localScale = new Vector3(
            windowWidth,    // Толщина окна (автоматически вычисленная)
            windowHeight,   // Высота окна
            windowLength    // Длина окна
        );

        // Применяем материал окна
        MeshRenderer renderer = windowObj.GetComponent<MeshRenderer>();
        if (renderer != null && windowMaterial != null)
        {
            renderer.material = windowMaterial;
        }

        windowObjects.Add(windowObj);
    }

    void CreateDoors()
    {
        if (doors == null || doors.Length == 0) return;

        for (int i = 0; i < doors.Length; i++)
        {
            DoorData door = doors[i];
            if (door.points == null || door.points.Length < 2 || door.connections == null)
            {
                Debug.LogWarning($"Некорректные данные для двери {i}");
                continue;
            }

            CreateDoor(door, i);
        }
    }

    void CreateDoor(DoorData door, int doorIndex)
    {
        // Создаем дверь между двумя точками
        for (int i = 0; i < door.connections.Length; i += 2)
        {
            int startIndex = door.connections[i];
            int endIndex = door.connections[i + 1];

            if (startIndex >= door.points.Length || endIndex >= door.points.Length)
            {
                Debug.LogError($"Неверный индекс точки двери: {startIndex} или {endIndex}");
                continue;
            }

            Vector2 startPoint = door.points[startIndex];
            Vector2 endPoint = door.points[endIndex];

            // Автоматически вычисляем ширину двери
            float doorWidth = GetWallThickness(door.wallIndex) + doorWidthOffset;

            CreateDoorBetweenPoints(startPoint, endPoint, door.height, doorWidth, doorIndex, i / 2);
        }
    }

    void CreateDoorBetweenPoints(Vector2 start, Vector2 end, float doorHeight, float doorWidth, int doorIndex, int segmentIndex)
    {
        GameObject doorObj = GameObject.CreatePrimitive(PrimitiveType.Cube);
        doorObj.name = $"Door_{doorIndex}_{segmentIndex}";
        doorObj.transform.parent = this.transform;

        doorObj.tag = "Door";
        // Вычисляем позицию (середина между точками двери)
        // Дверь размещается прижатой к полу
        Vector3 position = new Vector3(
            (start.x + end.x) / 2f,
            doorHeight / 2f, // Дверь прижата к полу (половина высоты от пола)
            (start.y + end.y) / 2f
        );

        doorObj.transform.position = position;

        // Вычисляем длину и направление
        Vector2 doorDirection = end - start;
        float doorLength = doorDirection.magnitude;

        // Поворачиваем дверь в нужном направлении
        float angle = Mathf.Atan2(doorDirection.x, doorDirection.y) * Mathf.Rad2Deg;
        doorObj.transform.rotation = Quaternion.Euler(0, -angle, 0);

        // Масштабируем дверь (толщина, высота, длина)
        doorObj.transform.localScale = new Vector3(
            doorWidth,    // Толщина двери (автоматически вычисленная)
            doorHeight,   // Высота двери
            doorLength    // Длина двери
        );

        // Применяем материал двери
        MeshRenderer renderer = doorObj.GetComponent<MeshRenderer>();
        if (renderer != null && doorMaterial != null)
        {
            renderer.material = doorMaterial;
        }

        // Добавляем коллайдер для обнаружения (если его нет)
        if (doorObj.GetComponent<Collider>() == null)
        {
            doorObj.AddComponent<BoxCollider>();
        }

        doorObjects.Add(doorObj);
    }

    // ========== МЕТОДЫ ДЛЯ ТЕЛЕПОРТАЦИИ ==========

    /// <summary>
    /// Получает позицию телепортации за дверь (с противоположной стороны)
    /// </summary>
    public Vector3 GetTeleportPosition(GameObject doorObject, Vector3 playerPosition)
    {
        if (doorObject == null) return playerPosition;

        // Получаем направление двери (нормаль)
        Vector3 doorForward = doorObject.transform.forward;
        Vector3 doorPosition = doorObject.transform.position;

        // Определяем, с какой стороны от двери находится игрок
        Vector3 toPlayer = playerPosition - doorPosition;
        float dotProduct = Vector3.Dot(doorForward, toPlayer.normalized);

        // Если игрок перед дверью (dotProduct > 0), телепортируем его за дверь
        // Если игрок за дверью (dotProduct < 0), телепортируем его перед дверью
        Vector3 teleportDirection = dotProduct > 0 ? -doorForward : doorForward;

        // Вычисляем позицию телепортации
        Vector3 teleportPos = doorPosition + teleportDirection * teleportDistance;

        // Сохраняем высоту игрока
        teleportPos.y = playerPosition.y;

        // Добавляем небольшое смещение вбок чтобы не застрять в стене
        Vector3 rightOffset = doorObject.transform.right * 0.3f;
        teleportPos += rightOffset;

        return teleportPos;
    }

    /// <summary>
    /// Альтернативный метод для точного позиционирования за дверью
    /// </summary>
    public Vector3 GetExactTeleportPosition(GameObject doorObject, Vector3 playerPosition)
    {
        if (doorObject == null) return playerPosition;

        // Получаем трансформ двери
        Transform doorTransform = doorObject.transform;
        Vector3 doorPosition = doorObject.transform.position;

        // Определяем сторону игрока относительно двери
        Vector3 localPlayerPos = doorTransform.InverseTransformPoint(playerPosition);

        // Если игрок перед дверью (local Z > 0), телепортируем за дверь (local Z < 0)
        // Если игрок за дверью (local Z < 0), телепортируем перед дверью (local Z > 0)
        float targetLocalZ = localPlayerPos.z > 0 ? -teleportDistance : teleportDistance;

        // Создаем целевую позицию в локальных координатах двери
        Vector3 targetLocalPos = new Vector3(0, localPlayerPos.y, targetLocalZ);

        // Преобразуем обратно в мировые координаты
        Vector3 teleportPos = doorTransform.TransformPoint(targetLocalPos);

        return teleportPos;
    }

    /// <summary>
    /// Получает все созданные объекты дверей
    /// </summary>
    public List<GameObject> GetDoorObjects()
    {
        return doorObjects;
    }

    /// <summary>
    /// Находит дверь по имени
    /// </summary>
    public GameObject FindDoorByName(string doorName)
    {
        return doorObjects.Find(door => door != null && door.name == doorName);
    }

    /// <summary>
    /// Назначает слой для всех созданных дверей
    /// </summary>
    public void AssignDoorLayer(LayerMask layer)
    {
        int doorLayer = (int)Mathf.Log(layer.value, 2);
        foreach (GameObject door in doorObjects)
        {
            if (door != null)
            {
                door.layer = doorLayer;
            }
        }
    }

    // ========== СУЩЕСТВУЮЩИЕ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

    float GetWallHeight(int wallIndex)
    {
        if (wallHeights != null && wallIndex >= 0 && wallIndex < wallHeights.Length)
        {
            return wallHeights[wallIndex];
        }
        return defaultWallHeight;
    }

    float GetWallThickness(int wallIndex)
    {
        if (wallThicknesses != null && wallIndex >= 0 && wallIndex < wallThicknesses.Length)
        {
            return wallThicknesses[wallIndex];
        }
        return defaultWallThickness;
    }

    void CreateFloor()
    {
        GameObject floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
        floor.name = "Floor";
        floor.transform.parent = this.transform;

        // ДОБАВЛЯЕМ ТЕГ
        floor.tag = "Floor";

        // Вычисляем границы для пола
        Vector2 min = GetMinBounds();
        Vector2 max = GetMaxBounds();

        // Позиция пола (центр по XZ, немного ниже для выравнивания)
        Vector3 position = new Vector3(
            (min.x + max.x) / 2f,
            -floorThickness / 2f, // Половина толщины ниже нуля
            (min.y + max.y) / 2f
        );

        floor.transform.position = position;

        // Размер пола (по XZ границы + небольшой запас)
        float avgThickness = GetAverageThickness();
        float wallWidth = max.x - min.x + avgThickness * 2f;
        float wallDepth = max.y - min.y + avgThickness * 2f;

        floor.transform.localScale = new Vector3(wallWidth, floorThickness, wallDepth);

        // Применяем материал
        MeshRenderer renderer = floor.GetComponent<MeshRenderer>();
        if (renderer != null && floorMaterial != null)
        {
            renderer.material = floorMaterial;
        }

        floors.Add(floor);
    }

    void CreateCeiling()
    {
        GameObject ceiling = GameObject.CreatePrimitive(PrimitiveType.Cube);
        ceiling.name = "Ceiling";
        ceiling.transform.parent = this.transform;

        // ДОБАВЛЯЕМ ТЕГ (ОПЦИОНАЛЬНО)
        ceiling.tag = "Ceiling"; // или "Floor", в зависимости от ваших потребностей

        // Остальной код без изменений...
        // Вычисляем границы для потолка
        Vector2 min = GetMinBounds();
        Vector2 max = GetMaxBounds();

        // Вычисляем максимальную высоту для потолка
        float maxHeight = GetMaxHeight();

        // Позиция потолка (центр по XZ, на максимальной высоте стен)
        Vector3 position = new Vector3(
            (min.x + max.x) / 2f,
            maxHeight - floorThickness / 2f, // На максимальной высоте стен
            (min.y + max.y) / 2f
        );

        ceiling.transform.position = position;

        // Размер потолка (такой же как пол)
        float avgThickness = GetAverageThickness();
        float wallWidth = max.x - min.x + avgThickness * 2f;
        float wallDepth = max.y - min.y + avgThickness * 2f;

        ceiling.transform.localScale = new Vector3(wallWidth, floorThickness, wallDepth);

        // Применяем материал
        MeshRenderer renderer = ceiling.GetComponent<MeshRenderer>();
        if (renderer != null && ceilingMaterial != null)
        {
            renderer.material = ceilingMaterial;
        }

        ceilings.Add(ceiling);
    }

    float GetAverageThickness()
    {
        if (wallThicknesses == null || wallThicknesses.Length == 0)
            return defaultWallThickness;

        float sum = 0f;
        foreach (float thickness in wallThicknesses)
        {
            sum += thickness;
        }
        return sum / wallThicknesses.Length;
    }

    public float GetMaxHeight()
    {
        if (wallHeights == null || wallHeights.Length == 0)
            return defaultWallHeight;

        float max = wallHeights[0];
        foreach (float height in wallHeights)
        {
            if (height > max) max = height;
        }
        return max;
    }

    public Vector2 GetMinBounds()
    {
        if (points == null || points.Length == 0) return Vector2.zero;

        Vector2 min = points[0];
        foreach (Vector2 point in points)
        {
            min.x = Mathf.Min(min.x, point.x);
            min.y = Mathf.Min(min.y, point.y);
        }
        return min;
    }

    public Vector2 GetMaxBounds()
    {
        if (points == null || points.Length == 0) return Vector2.zero;

        Vector2 max = points[0];
        foreach (Vector2 point in points)
        {
            max.x = Mathf.Max(max.x, point.x);
            max.y = Mathf.Max(max.y, point.y);
        }
        return max;
    }

    void ClearMap()
    {
        foreach (GameObject wall in walls)
        {
            if (wall != null) DestroyImmediate(wall);
        }
        foreach (GameObject floor in floors)
        {
            if (floor != null) DestroyImmediate(floor);
        }
        foreach (GameObject ceiling in ceilings)
        {
            if (ceiling != null) DestroyImmediate(ceiling);
        }
        foreach (GameObject window in windowObjects)
        {
            if (window != null) DestroyImmediate(window);
        }
        foreach (GameObject door in doorObjects)
        {
            if (door != null) DestroyImmediate(door);
        }

        walls.Clear();
        floors.Clear();
        ceilings.Clear();
        windowObjects.Clear();
        doorObjects.Clear();
    }

    // === ПУБЛИЧНЫЕ МЕТОДЫ ДЛЯ НАСТРОЙКИ ИЗВНЕ ===

    public void SetPoints(Vector2[] newPoints)
    {
        points = newPoints;
    }

    public void SetConnections(int[] newConnections)
    {
        connections = newConnections;
    }

    public void SetWallHeights(float[] heights)
    {
        wallHeights = heights;
    }

    public void SetWallThicknesses(float[] thicknesses)
    {
        wallThicknesses = thicknesses;
    }

    public void SetWallDimensions(float[] heights, float[] thicknesses)
    {
        wallHeights = heights;
        wallThicknesses = thicknesses;
    }

    public void SetWindows(WindowData[] newWindows)
    {
        windows = newWindows;
    }

    public void SetDoors(DoorData[] newDoors)
    {
        doors = newDoors;
    }

    public void SetWindowWidthOffset(float offset)
    {
        windowWidthOffset = offset;
    }

    public void SetDoorWidthOffset(float offset)
    {
        doorWidthOffset = offset;
    }

    public void AddWindow(WindowData window)
    {
        if (windows == null)
            windows = new WindowData[0];

        List<WindowData> windowList = new List<WindowData>(windows);
        windowList.Add(window);
        windows = windowList.ToArray();
    }

    public void AddDoor(DoorData door)
    {
        if (doors == null)
            doors = new DoorData[0];

        List<DoorData> doorList = new List<DoorData>(doors);
        doorList.Add(door);
        doors = doorList.ToArray();
    }

    // Для отладки в редакторе
    void OnDrawGizmosSelected()
    {
        if (points != null)
        {
            Gizmos.color = Color.red;
            foreach (Vector2 point in points)
            {
                Gizmos.DrawSphere(new Vector3(point.x, 0, point.y), 0.1f);
            }
        }

        if (points != null && connections != null)
        {
            Gizmos.color = Color.blue;
            for (int i = 0; i < connections.Length; i += 2)
            {
                if (connections[i] < points.Length && connections[i + 1] < points.Length)
                {
                    Vector3 start = new Vector3(points[connections[i]].x, 0, points[connections[i]].y);
                    Vector3 end = new Vector3(points[connections[i + 1]].x, 0, points[connections[i + 1]].y);
                    Gizmos.DrawLine(start, end);
                }
            }
        }

        // Отображение окон в редакторе
        if (windows != null)
        {
            Gizmos.color = Color.cyan;
            foreach (WindowData window in windows)
            {
                if (window.points != null && window.connections != null)
                {
                    for (int i = 0; i < window.connections.Length; i += 2)
                    {
                        if (window.connections[i] < window.points.Length && window.connections[i + 1] < window.points.Length)
                        {
                            float wallHeight = GetWallHeight(window.wallIndex);
                            Vector3 start = new Vector3(window.points[window.connections[i]].x, wallHeight / 2f, window.points[window.connections[i]].y);
                            Vector3 end = new Vector3(window.points[window.connections[i + 1]].x, wallHeight / 2f, window.points[window.connections[i + 1]].y);
                            Gizmos.DrawLine(start, end);
                            Gizmos.DrawSphere(start, 0.05f);
                            Gizmos.DrawSphere(end, 0.05f);
                        }
                    }
                }
            }
        }

        // Отображение дверей в редакторе
        if (doors != null)
        {
            Gizmos.color = Color.yellow;
            foreach (DoorData door in doors)
            {
                if (door.points != null && door.connections != null)
                {
                    for (int i = 0; i < door.connections.Length; i += 2)
                    {
                        if (door.connections[i] < door.points.Length && door.connections[i + 1] < door.points.Length)
                        {
                            Vector3 start = new Vector3(door.points[door.connections[i]].x, door.height / 2f, door.points[door.connections[i]].y);
                            Vector3 end = new Vector3(door.points[door.connections[i + 1]].x, door.height / 2f, door.points[door.connections[i + 1]].y);
                            Gizmos.DrawLine(start, end);
                            Gizmos.DrawSphere(start, 0.05f);
                            Gizmos.DrawSphere(end, 0.05f);
                        }
                    }
                }
            }
        }
    }
}