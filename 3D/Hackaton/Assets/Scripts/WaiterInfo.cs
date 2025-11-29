using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class TwoRoomApartment : MonoBehaviour
{
    public SimpleMapGenerator mapGenerator;

    [Header("Настройки материалов")]
    public Material windowMaterial;
    public Material doorMaterial;

    [Header("Настройки автоматической ширины")]
    public float windowWidthOffset = 0.01f;
    public float doorWidthOffset = 0.01f;

    [Header("Настройки комнат")]
    public float wallHeight = 2.5f;
    public float wallThickness = 0.2f;
    public float doorHeight = 2.0f;

    [Header("Размеры комнат")]
    public float room1Width = 6f;
    public float room2Width = 6f;
    public float roomHeight = 4f;

    void Start()
    {
        GenerateTwoRooms();
    }

    void GenerateTwoRooms()
    {
        // Точки для двух комнат
        Vector2[] points = {
            // Первая комната (левая)
            new Vector2(0, 0),                    // 0
            new Vector2(room1Width, 0),           // 1
            new Vector2(room1Width, roomHeight),  // 2
            new Vector2(0, roomHeight),           // 3
            
            // Вторая комната (правая)
            new Vector2(room1Width, 0),           // 4 (та же точка что и 1)
            new Vector2(room1Width + room2Width, 0), // 5
            new Vector2(room1Width + room2Width, roomHeight), // 6
            new Vector2(room1Width, roomHeight),  // 7 (та же точка что и 2)
        };

        // Соединения между точками (стены)
        int[] connections = {
            // Первая комната
            0, 1,   // нижняя стена комнаты 1
            1, 2,   // правая стена комнаты 1 (общая со второй комнатой)
            2, 3,   // верхняя стена комнаты 1
            3, 0,   // левая стена комнаты 1
            
            // Вторая комната  
            4, 5,   // нижняя стена комнаты 2
            5, 6,   // правая стена комнаты 2
            6, 7,   // верхняя стена комнаты 2
            7, 4,   // левая стена комнаты 2 (общая с первой комнатой)
        };

        // Высоты и толщины для каждой стены
        int wallCount = connections.Length / 2;
        float[] wallHeights = new float[wallCount];
        float[] wallThicknesses = new float[wallCount];

        for (int i = 0; i < wallCount; i++)
        {
            wallHeights[i] = wallHeight;
            wallThicknesses[i] = wallThickness;
        }

        // Большие окна для обеих комнат
        SimpleMapGenerator.WindowData[] windows = new SimpleMapGenerator.WindowData[4];

        // Окна в первой комнате
        windows[0] = new SimpleMapGenerator.WindowData
        {
            points = new Vector2[] {
                new Vector2(1.0f, 0),
                new Vector2(3.0f, 0)
            },
            connections = new int[] { 0, 1 },
            height = 1.5f,
            wallIndex = 0 // нижняя стена первой комнаты
        };

        windows[1] = new SimpleMapGenerator.WindowData
        {
            points = new Vector2[] {
                new Vector2(0, 1.0f),
                new Vector2(0, 3.0f)
            },
            connections = new int[] { 0, 1 },
            height = 1.5f,
            wallIndex = 3 // левая стена первой комнаты
        };

        // Окна во второй комнате
        windows[2] = new SimpleMapGenerator.WindowData
        {
            points = new Vector2[] {
                new Vector2(room1Width + 1.0f, 0),
                new Vector2(room1Width + 3.0f, 0)
            },
            connections = new int[] { 0, 1 },
            height = 1.5f,
            wallIndex = 4 // нижняя стена второй комнаты
        };

        windows[3] = new SimpleMapGenerator.WindowData
        {
            points = new Vector2[] {
                new Vector2(room1Width + room2Width, 1.0f),
                new Vector2(room1Width + room2Width, 3.0f)
            },
            connections = new int[] { 0, 1 },
            height = 1.5f,
            wallIndex = 5 // правая стена второй комнаты
        };

        // Одна дверь между комнатами
        SimpleMapGenerator.DoorData[] doors = new SimpleMapGenerator.DoorData[1];

        doors[0] = new SimpleMapGenerator.DoorData
        {
            points = new Vector2[] {
                new Vector2(room1Width, 1.5f),    // начало двери
                new Vector2(room1Width, 2.5f)     // конец двери
            },
            connections = new int[] { 0, 1 },
            height = doorHeight,
            wallIndex = 1 // общая стена между комнатами (индекс 1 или 7)
        };

        // Настройка генератора
        mapGenerator.SetPoints(points);
        mapGenerator.SetConnections(connections);
        mapGenerator.SetWallDimensions(wallHeights, wallThicknesses);
        mapGenerator.SetWindows(windows);
        mapGenerator.SetDoors(doors);
        mapGenerator.SetWindowWidthOffset(windowWidthOffset);
        mapGenerator.SetDoorWidthOffset(doorWidthOffset);

        mapGenerator.doorLayerMask = LayerMask.GetMask("Doors");
        mapGenerator.GenerateMap();
        AssignDoorLayers();

        Debug.Log($"Две комнаты сгенерированы! Размеры: {room1Width}x{roomHeight} и {room2Width}x{roomHeight}");
        Debug.Log("Комнаты соединены одной дверью в общей стене");
    }

    void AssignDoorLayers()
    {
        List<GameObject> doorObjects = mapGenerator.GetDoorObjects();
        int doorLayer = LayerMask.NameToLayer("Doors");

        if (doorLayer == -1)
        {
            Debug.LogWarning("Слой 'Doors' не существует. Создайте слой 'Doors' в настройках проекта.");
            return;
        }

        foreach (GameObject door in doorObjects)
        {
            if (door != null)
            {
                door.layer = doorLayer;
                // Добавляем коллайдер для взаимодействия
                BoxCollider collider = door.GetComponent<BoxCollider>();
                if (collider == null)
                {
                    collider = door.AddComponent<BoxCollider>();
                }
                collider.isTrigger = true;
            }
        }
    }

    public void RegenerateRooms()
    {
        mapGenerator.GenerateMap();
        AssignDoorLayers();
    }

    // Метод для изменения размеров комнат
    public void ChangeRoomSizes(float room1Width, float room2Width, float roomHeight)
    {
        this.room1Width = room1Width;
        this.room2Width = room2Width;
        this.roomHeight = roomHeight;
        RegenerateRooms();
    }

    // Метод для получения информации о комнатах
    public void PrintRoomInfo()
    {
        Debug.Log($"Комната 1: {room1Width}x{roomHeight} метров");
        Debug.Log($"Комната 2: {room2Width}x{roomHeight} метров");
        Debug.Log($"Общая площадь: {(room1Width + room2Width) * roomHeight} м²");
        Debug.Log("Дверь расположена в общей стене между комнатами");
    }
}