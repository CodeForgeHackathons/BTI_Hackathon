using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PlayerSpawnManager : MonoBehaviour
{
    [Header("Настройки спавна")]
    public GameObject playerPrefab;
    public SimpleMapGenerator mapGenerator;
    public bool spawnInCenter = true;
    public Vector3 customSpawnPosition = Vector3.zero;

    private GameObject playerInstance;

    void Start()
    {
        if (mapGenerator == null)
        {
            mapGenerator = FindObjectOfType<SimpleMapGenerator>();
        }

        // Подписываемся на события генерации карты
        if (mapGenerator != null)
        {
            mapGenerator.OnMapGenerationCompleted += OnMapGenerated;
        }
        else
        {
            Debug.LogError("MapGenerator не найден!");
        }
    }

    void OnDestroy()
    {
        // Отписываемся от событий при уничтожении объекта
        if (mapGenerator != null)
        {
            mapGenerator.OnMapGenerationCompleted -= OnMapGenerated;
        }
    }

    private void OnMapGenerated()
    {
        SpawnPlayer();
    }

    public void SpawnPlayer()
    {
        if (playerPrefab == null)
        {
            Debug.LogError("Player prefab не назначен!");
            return;
        }

        if (!mapGenerator.IsMapReady)
        {
            Debug.LogWarning("Карта еще не готова! Откладываем спавн...");
            return;
        }

        // Уничтожаем предыдущего игрока, если есть
        if (playerInstance != null)
        {
            Destroy(playerInstance);
        }

        // Вычисляем позицию спавна
        Vector3 spawnPosition = GetSpawnPosition();

        // Создаем игрока
        playerInstance = Instantiate(playerPrefab, spawnPosition, Quaternion.identity);
        Debug.Log($"Игрок заспавнен в позиции: {spawnPosition}");
    }

    private Vector3 GetSpawnPosition()
    {
        if (spawnInCenter)
        {
            // Вычисляем центр карты
            Vector2 minBounds = mapGenerator.GetMinBounds();
            Vector2 maxBounds = mapGenerator.GetMaxBounds();
            
            Vector3 center = new Vector3(
                (minBounds.x + maxBounds.x) / 2f,
                1f, // Немного выше пола
                (minBounds.y + maxBounds.y) / 2f
            );
            
            return center;
        }
        else
        {
            return customSpawnPosition;
        }
    }

    // Метод для принудительного спавна (если нужно)
    public void ForceSpawnPlayer()
    {
        SpawnPlayer();
    }
}