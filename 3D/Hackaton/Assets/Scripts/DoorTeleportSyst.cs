using UnityEngine;
using System.Collections;

public class DoorTeleportSystem : MonoBehaviour
{
    [Header("Настройки телепортации")]
    public float maxDistance = 3f;
    public LayerMask doorLayerMask = 1;
    public float teleportCooldown = 1f;

    [Header("Эффекты телепортации")]
    public ParticleSystem teleportEffect;
    public AudioClip teleportSound;

    private Camera playerCamera;
    private AudioSource audioSource;
    private bool canTeleport = true;
    private SimpleMapGenerator mapGenerator;

    void Start()
    {
        playerCamera = GetComponent<Camera>();
        if (playerCamera == null)
        {
            playerCamera = Camera.main;
        }

        audioSource = GetComponent<AudioSource>();
        if (audioSource == null)
        {
            audioSource = gameObject.AddComponent<AudioSource>();
        }

        mapGenerator = FindObjectOfType<SimpleMapGenerator>();
        if (mapGenerator == null)
        {
            Debug.LogError("SimpleMapGenerator не найден на сцене!");
        }
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.F) && canTeleport)
        {
            TryTeleportThroughDoor();
        }
    }

    void TryTeleportThroughDoor()
    {
        Ray ray = playerCamera.ScreenPointToRay(new Vector3(Screen.width / 2, Screen.height / 2, 0));
        RaycastHit hit;

        if (Physics.Raycast(ray, out hit, maxDistance, doorLayerMask))
        {
            GameObject hitObject = hit.collider.gameObject;

            if (hitObject.name.StartsWith("Door_"))
            {
                TeleportPlayer(hitObject);
            }
        }
    }

    void TeleportPlayer(GameObject doorObject)
    {
        if (mapGenerator == null || doorObject == null) return;

        // Получаем позицию игрока
        Vector3 playerPosition = transform.position;

        // Получаем позицию телепортации (с противоположной стороны двери)
        Vector3 teleportPosition = mapGenerator.GetExactTeleportPosition(doorObject, playerPosition);

        // Проверяем и корректируем позицию
        Vector3 finalPosition = GetValidTeleportPosition(teleportPosition, doorObject);

        StartCoroutine(TeleportCoroutine(finalPosition, doorObject));
    }

    Vector3 GetValidTeleportPosition(Vector3 desiredPosition, GameObject doorObject)
    {
        Vector3 doorForward = doorObject.transform.forward;
        Vector3 doorPosition = doorObject.transform.position;

        // Пробуем желаемую позицию
        if (IsPositionValid(desiredPosition))
        {
            return desiredPosition;
        }

        // Если желаемая позиция занята, пробуем варианты со смещением
        Vector3[] offsets = {
            Vector3.zero,
            doorObject.transform.right * 0.5f,
            -doorObject.transform.right * 0.5f,
            doorObject.transform.right * 1.0f,
            -doorObject.transform.right * 1.0f
        };

        foreach (Vector3 offset in offsets)
        {
            Vector3 testPosition = desiredPosition + offset;
            if (IsPositionValid(testPosition))
            {
                return testPosition;
            }
        }

        // Если все позиции заняты, возвращаем позицию с минимальным смещением
        return desiredPosition + doorObject.transform.right * 0.5f;
    }

    bool IsPositionValid(Vector3 position)
    {
        // Проверяем коллизии на целевой позиции
        Collider[] colliders = Physics.OverlapSphere(position, 0.4f); // Радиус немного меньше чем у игрока
        foreach (Collider collider in colliders)
        {
            // Игнорируем триггеры, двери и самого игрока
            if (!collider.isTrigger &&
                !collider.gameObject.name.StartsWith("Door_") &&
                collider.gameObject != gameObject)
            {
                return false;
            }
        }
        return true;
    }

    IEnumerator TeleportCoroutine(Vector3 targetPosition, GameObject doorObject)
    {
        canTeleport = false;

        // Эффекты перед телепортацией
        PlayTeleportEffects(transform.position);

        // Короткая задержка для эффекта
        yield return new WaitForSeconds(0.1f);

        // Телепортируем игрока
        transform.position = targetPosition;

        // Эффекты после телепортации
        PlayTeleportEffects(transform.position);

        // Визуальная обратная связь
        ShowTeleportMessage(doorObject);

        // Кулдаун
        yield return new WaitForSeconds(teleportCooldown);
        canTeleport = true;
    }

    void PlayTeleportEffects(Vector3 position)
    {
        if (teleportEffect != null)
        {
            Instantiate(teleportEffect, position, Quaternion.identity);
        }

        if (teleportSound != null)
        {
            audioSource.PlayOneShot(teleportSound);
        }
    }

    void ShowTeleportMessage(GameObject doorObject)
    {
        // Можно добавить UI-сообщение или логирование
        Debug.Log($"Телепортирован через дверь: {doorObject.name}");
    }

    // Визуализация для отладки
    void OnDrawGizmosSelected()
    {
        if (playerCamera != null)
        {
            // Луч прицеливания
            Gizmos.color = Color.green;
            Vector3 rayStart = playerCamera.transform.position;
            Vector3 rayDirection = playerCamera.transform.forward * maxDistance;
            Gizmos.DrawRay(rayStart, rayDirection);

            // Зона обнаружения дверей
            Gizmos.color = Color.yellow;
            Gizmos.DrawWireSphere(rayStart + rayDirection, 0.1f);
        }
    }
}