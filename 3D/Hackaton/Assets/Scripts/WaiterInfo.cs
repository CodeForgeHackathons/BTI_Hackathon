using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class TestMap : MonoBehaviour
{
    public SimpleMapGenerator mapGenerator;

    [Header("Настройки материалов")]
    public Material windowMaterial;
    public Material doorMaterial;

    [Header("Настройки автоматической ширины")]
    public float windowWidthOffset = 0.01f;
    public float doorWidthOffset = 0.01f;

    void Start()
    {
        TestRoomWithDoors();
    }

    void TestRoomWithDoors()
    {
        // Точки для комнаты
        Vector2[] points = {
            new Vector2(0, 0),
            new Vector2(6, 0),
            new Vector2(6, 4),
            new Vector2(0, 4)
        };

        // Соединения: стены между точками
        int[] connections = {
            0, 1,  // нижняя стена
            1, 2,  // правая стена
            2, 3,  // верхняя стена
            3, 0   // левая стена
        };

        // Высота для каждой стены
        float[] wallHeights = {
            2.5f,
            2.5f,
            2.5f,
            2.5f
        };

        // Толщина для каждой стены
        float[] wallThicknesses = {
            0.2f,
            0.2f,
            0.2f,
            0.2f
        };

        // Создаем окна
        SimpleMapGenerator.WindowData[] windows = new SimpleMapGenerator.WindowData[1];
        windows[0] = new SimpleMapGenerator.WindowData
        {
            points = new Vector2[] {
                new Vector2(6, 1.5f),
                new Vector2(6, 2.5f)
            },
            connections = new int[] { 0, 1 },
            height = 1.0f,
            wallIndex = 1
        };

        // Создаем двери
        SimpleMapGenerator.DoorData[] doors = new SimpleMapGenerator.DoorData[2];
        doors[0] = new SimpleMapGenerator.DoorData
        {
            points = new Vector2[] {
            new Vector2(1, 0),
            new Vector2(2, 0)
        },
            connections = new int[] { 0, 1 },
            height = 2.0f,
            wallIndex = 0
        };
        doors[1] = new SimpleMapGenerator.DoorData
        {
            points = new Vector2[] {
            new Vector2(0, 1),
            new Vector2(0, 2)
        },
            connections = new int[] { 0, 1 },
            height = 2.0f,
            wallIndex = 3
        };

        mapGenerator.SetPoints(points);
        mapGenerator.SetConnections(connections);
        mapGenerator.SetWallDimensions(wallHeights, wallThicknesses);
        mapGenerator.SetWindows(windows);
        mapGenerator.SetDoors(doors);
        mapGenerator.SetWindowWidthOffset(windowWidthOffset);
        mapGenerator.SetDoorWidthOffset(doorWidthOffset);

        // Устанавливаем слой для дверей
        mapGenerator.doorLayerMask = LayerMask.GetMask("Doors");

        mapGenerator.GenerateMap();

        // Назначаем слой "Doors" для всех созданных дверей
        AssignDoorLayers();
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
            }
        }
    }

    public void RegenerateMap()
    {
        mapGenerator.GenerateMap();
    }
}