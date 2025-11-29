using UnityEngine;
using System;
using System.Collections.Generic;

public class SceneController : MonoBehaviour
{
    [Serializable]
    public class Vector2D
    {
        public float x;
        public float y;

        public Vector3 ToVector3(float y = 0f)
        {
            return new Vector3(this.x, y, this.y);
        }

        public Vector2 ToVector2()
        {
            return new Vector2(this.x, this.y);
        }
    }

    [Serializable]
    public class WindowData
    {
        public Vector2D[] points;
        public int[] connections;
        public float height;
        public int wallIndex;
    }

    [Serializable]
    public class DoorData
    {
        public Vector2D[] points;
        public int[] connections;
        public float height;
        public int wallIndex;
    }

    [Serializable]
    public class LayoutData
    {
        public Vector2D[] points;
        public int[] connections;
        public float[] wallHeights;
        public float[] wallThicknesses;
        public WindowData[] windows;
        public DoorData[] doors;
    }

    // Префабы для создания объектов
    public GameObject wallPrefab;
    public GameObject windowPrefab;
    public GameObject doorPrefab;

    // Настройки для SimpleMapGenerator
    public float windowWidthOffset = 0.01f;
    public float doorWidthOffset = 0.01f;

    // Ссылка на SimpleMapGenerator (не сериализуем)
    [System.NonSerialized]
    private SimpleMapGenerator mapGenerator;

    // Родительские объекты для организации иерархии
    private Transform wallsParent;
    private Transform windowsParent;
    private Transform doorsParent;

    // Словари для хранения созданных объектов
    private Dictionary<int, GameObject> wallObjects = new Dictionary<int, GameObject>();
    private List<GameObject> windowObjects = new List<GameObject>();
    private List<GameObject> doorObjects = new List<GameObject>();

    private void Awake()
    {
        // Создаем родительские объекты для организации сцены
        wallsParent = new GameObject("Walls").transform;
        windowsParent = new GameObject("Windows").transform;
        doorsParent = new GameObject("Doors").transform;

        wallsParent.parent = transform;
        windowsParent.parent = transform;
        doorsParent.parent = transform;

        // Ищем SimpleMapGenerator во время выполнения
        FindMapGenerator();
    }

    private void FindMapGenerator()
    {
        try
        {
            mapGenerator = FindObjectOfType<SimpleMapGenerator>();
            if (mapGenerator != null)
            {
                Debug.Log("SimpleMapGenerator found successfully");
            }
            else
            {
                Debug.LogWarning("SimpleMapGenerator not found in scene");
            }
        }
        catch (Exception e)
        {
            Debug.LogWarning($"Error finding SimpleMapGenerator: {e.Message}");
        }
    }

    public void LoadLayoutData(string jsonData)
    {
        try
        {
            Debug.Log("Received layout data from Vue.js");
            LayoutData data = JsonUtility.FromJson<LayoutData>(jsonData);

            // Очищаем предыдущие объекты
            ClearScene();

            // Пытаемся использовать SimpleMapGenerator если доступен
            if (mapGenerator != null)
            {
                ProcessLayoutDataWithSimpleMapGenerator(data);
            }
            else
            {
                // Используем старый метод как запасной вариант
                ProcessLayoutData(data);
                Debug.LogWarning("Using fallback method - SimpleMapGenerator not available");
            }

            Debug.Log($"Layout loaded: {data.points.Length} points, {data.connections.Length / 2} walls, {data.windows.Length} windows, {data.doors.Length} doors");
        }
        catch (Exception e)
        {
            Debug.LogError($"Error parsing layout data: {e.Message}\n{e.StackTrace}");
        }
    }

    private void ClearScene()
    {
        // Удаляем все созданные объекты
        foreach (var wall in wallObjects.Values)
        {
            if (wall != null) Destroy(wall);
        }
        wallObjects.Clear();

        foreach (var window in windowObjects)
        {
            if (window != null) Destroy(window);
        }
        windowObjects.Clear();

        foreach (var door in doorObjects)
        {
            if (door != null) Destroy(door);
        }
        doorObjects.Clear();
    }

    private void ProcessLayoutDataWithSimpleMapGenerator(LayoutData data)
    {
        if (mapGenerator == null)
        {
            Debug.LogError("SimpleMapGenerator is not available!");
            ProcessLayoutData(data);
            return;
        }

        try
        {
            // Конвертируем данные в формат SimpleMapGenerator
            Vector2[] points = Array.ConvertAll(data.points, p => p.ToVector2());
            int[] connections = data.connections;
            float[] wallHeights = data.wallHeights;
            float[] wallThicknesses = data.wallThicknesses;

            // Создаем массивы окон и дверей в нужном формате
            var windows = new SimpleMapGenerator.WindowData[data.windows.Length];
            for (int i = 0; i < data.windows.Length; i++)
            {
                windows[i] = new SimpleMapGenerator.WindowData
                {
                    points = Array.ConvertAll(data.windows[i].points, p => p.ToVector2()),
                    connections = data.windows[i].connections,
                    height = data.windows[i].height,
                    wallIndex = data.windows[i].wallIndex
                };
            }

            var doors = new SimpleMapGenerator.DoorData[data.doors.Length];
            for (int i = 0; i < data.doors.Length; i++)
            {
                doors[i] = new SimpleMapGenerator.DoorData
                {
                    points = Array.ConvertAll(data.doors[i].points, p => p.ToVector2()),
                    connections = data.doors[i].connections,
                    height = data.doors[i].height,
                    wallIndex = data.doors[i].wallIndex
                };
            }

            // Настраиваем генератор
            mapGenerator.SetPoints(points);
            mapGenerator.SetConnections(connections);
            mapGenerator.SetWallDimensions(wallHeights, wallThicknesses);
            mapGenerator.SetWindows(windows);
            mapGenerator.SetDoors(doors);
            mapGenerator.SetWindowWidthOffset(windowWidthOffset);
            mapGenerator.SetDoorWidthOffset(doorWidthOffset);

            // Генерируем карту
            mapGenerator.GenerateMap();

            // Назначаем слои для дверей
            AssignDoorLayers();

            Debug.Log("Layout successfully processed with SimpleMapGenerator!");
        }
        catch (Exception e)
        {
            Debug.LogError($"Error processing layout with SimpleMapGenerator: {e.Message}");
            ProcessLayoutData(data);
        }
    }

    private void AssignDoorLayers()
    {
        if (mapGenerator == null) return;

        var doorObjects = mapGenerator.GetDoorObjects();
        int doorLayer = LayerMask.NameToLayer("Doors");

        if (doorLayer == -1)
        {
            Debug.LogWarning("Слой 'Doors' не существует. Создайте слой 'Doors' в настройках проекта.");
            return;
        }

        foreach (var door in doorObjects)
        {
            if (door != null)
            {
                door.layer = doorLayer;
                BoxCollider collider = door.GetComponent<BoxCollider>();
                if (collider == null)
                {
                    collider = door.AddComponent<BoxCollider>();
                }
                collider.isTrigger = true;
            }
        }
    }

    // Старый метод обработки
    private void ProcessLayoutData(LayoutData data)
    {
        // Создание стен на основе points и connections
        for (int i = 0; i < data.connections.Length; i += 2)
        {
            int startIndex = data.connections[i];
            int endIndex = data.connections[i + 1];
            int wallIndex = i / 2;

            if (startIndex < data.points.Length && endIndex < data.points.Length)
            {
                Vector2D startPoint = data.points[startIndex];
                Vector2D endPoint = data.points[endIndex];

                float wallHeight = wallIndex < data.wallHeights.Length ? data.wallHeights[wallIndex] : 2.5f;
                float wallThickness = wallIndex < data.wallThicknesses.Length ? data.wallThicknesses[wallIndex] : 0.2f;

                CreateWall(startPoint, endPoint, wallHeight, wallThickness, wallIndex);
            }
        }

        // Создание окон
        foreach (var window in data.windows)
        {
            CreateWindow(window);
        }

        // Создание дверей
        foreach (var door in data.doors)
        {
            CreateDoor(door);
        }
    }

    private void CreateWall(Vector2D start, Vector2D end, float height, float thickness, int wallIndex)
    {
        if (wallPrefab == null)
        {
            Debug.LogWarning("Wall prefab is not assigned!");
            return;
        }

        try
        {
            Vector3 startPos = start.ToVector3();
            Vector3 endPos = end.ToVector3();
            Vector3 center = (startPos + endPos) / 2f;

            Vector3 direction = endPos - startPos;
            float length = direction.magnitude;

            GameObject wall = Instantiate(wallPrefab, center, Quaternion.identity, wallsParent);
            wall.name = $"Wall_{wallIndex}";

            wall.transform.localScale = new Vector3(length, height, thickness);
            wall.transform.rotation = Quaternion.LookRotation(direction) * Quaternion.Euler(0, 90, 0);

            wallObjects[wallIndex] = wall;

            Debug.Log($"Created wall {wallIndex}: {start.x:F2},{start.y:F2} to {end.x:F2},{end.y:F2} (length: {length:F2})");
        }
        catch (Exception e)
        {
            Debug.LogError($"Error creating wall {wallIndex}: {e.Message}");
        }
    }

    private void CreateWindow(WindowData window)
    {
        if (windowPrefab == null || window.points.Length < 2)
        {
            Debug.LogWarning("Window prefab is not assigned or insufficient points!");
            return;
        }

        try
        {
            if (!wallObjects.TryGetValue(window.wallIndex, out GameObject parentWall))
            {
                Debug.LogWarning($"Wall {window.wallIndex} not found for window");
                return;
            }

            Vector2D windowStart = window.points[0];
            Vector2D windowEnd = window.points[1];
            Vector3 windowCenter = ((windowStart.ToVector3() + windowEnd.ToVector3()) / 2f);

            float windowWidth = Vector3.Distance(windowStart.ToVector3(), windowEnd.ToVector3());

            GameObject windowObj = Instantiate(windowPrefab, windowCenter, Quaternion.identity, windowsParent);
            windowObj.name = $"Window_{windowObjects.Count}";

            windowObj.transform.localScale = new Vector3(windowWidth, window.height, 0.1f);
            windowObj.transform.rotation = parentWall.transform.rotation;
            windowObj.transform.position = parentWall.transform.position + parentWall.transform.forward * 0.11f;

            windowObjects.Add(windowObj);
            Debug.Log($"Created window on wall {window.wallIndex}");
        }
        catch (Exception e)
        {
            Debug.LogError($"Error creating window: {e.Message}");
        }
    }

    private void CreateDoor(DoorData door)
    {
        if (doorPrefab == null || door.points.Length < 2)
        {
            Debug.LogWarning("Door prefab is not assigned or insufficient points!");
            return;
        }

        try
        {
            if (!wallObjects.TryGetValue(door.wallIndex, out GameObject parentWall))
            {
                Debug.LogWarning($"Wall {door.wallIndex} not found for door");
                return;
            }

            Vector2D doorStart = door.points[0];
            Vector2D doorEnd = door.points[1];
            Vector3 doorCenter = ((doorStart.ToVector3() + doorEnd.ToVector3()) / 2f);

            float doorWidth = Vector3.Distance(doorStart.ToVector3(), doorEnd.ToVector3());

            GameObject doorObj = Instantiate(doorPrefab, doorCenter, Quaternion.identity, doorsParent);
            doorObj.name = $"Door_{doorObjects.Count}";

            doorObj.transform.localScale = new Vector3(doorWidth, door.height, 0.05f);
            doorObj.transform.rotation = parentWall.transform.rotation;
            doorObj.transform.position = parentWall.transform.position + parentWall.transform.forward * 0.06f;

            doorObjects.Add(doorObj);
            Debug.Log($"Created door on wall {door.wallIndex}");
        }
        catch (Exception e)
        {
            Debug.LogError($"Error creating door: {e.Message}");
        }
    }

    // Метод для тестирования из Unity Editor
    [ContextMenu("Test Layout Data")]
    private void TestLayoutData()
    {
        string testData = @"{
            ""points"": [
                {""x"": 0, ""y"": 0},
                {""x"": 6, ""y"": 0},
                {""x"": 6, ""y"": 4},
                {""x"": 0, ""y"": 4}
            ],
            ""connections"": [0, 1, 1, 2, 2, 3, 3, 0],
            ""wallHeights"": [2.5, 2.5, 2.5, 2.5],
            ""wallThicknesses"": [0.2, 0.2, 0.2, 0.2],
            ""windows"": [
                {
                    ""points"": [
                        {""x"": 6, ""y"": 1.5},
                        {""x"": 6, ""y"": 2.5}
                    ],
                    ""connections"": [0, 1],
                    ""height"": 1.0,
                    ""wallIndex"": 1
                }
            ],
            ""doors"": [
                {
                    ""points"": [
                        {""x"": 1, ""y"": 0},
                        {""x"": 2, ""y"": 0}
                    ],
                    ""connections"": [0, 1],
                    ""height"": 2.0,
                    ""wallIndex"": 0
                }
            ]
        }";

        LoadLayoutData(testData);
    }

    // Метод для принудительной регенерации
    public void RegenerateLayout()
    {
        if (mapGenerator != null)
        {
            mapGenerator.GenerateMap();
            AssignDoorLayers();
        }
    }

    // Метод для ручного назначения генератора
    public void SetMapGenerator(SimpleMapGenerator generator)
    {
        this.mapGenerator = generator;
    }
}