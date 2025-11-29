using UnityEngine;
using System.Collections;

public class DoorTeleportSystem : MonoBehaviour
{
    [Header("Настройки телепортации")]
    public float maxDistance = 3f;
    public LayerMask doorLayerMask = 1;
    public float teleportCooldown = 1f;
    public float teleportDistance = 1.5f;
    public float playerRadius = 0.5f;
    public float heightCheck = 2f;

    [Header("Эффекты телепортации")]
    public ParticleSystem teleportEffect;
    public AudioClip teleportSound;

    private Camera playerCamera;
    private AudioSource audioSource;
    private bool canTeleport = true;
    private CharacterController characterController;

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

        characterController = GetComponent<CharacterController>();
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
        if (doorObject == null) return;

        Vector3 teleportPosition = CalculateTeleportPosition(doorObject);
        Vector3 finalPosition = GetValidTeleportPosition(teleportPosition, doorObject);

        StartCoroutine(TeleportCoroutine(finalPosition, doorObject));
    }

    Vector3 CalculateTeleportPosition(GameObject doorObject)
    {
        Vector3 playerPosition = transform.position;
        Vector3 doorPosition = doorObject.transform.position;
        Vector3 doorForward = doorObject.transform.forward;

        // Определяем направление от игрока к двери
        Vector3 toDoor = (doorPosition - playerPosition).normalized;

        // Определяем, с какой стороны двери находится игрок
        float dotProduct = Vector3.Dot(toDoor, doorForward);

        // Телепортируем в противоположном направлении от текущей позиции игрока
        Vector3 teleportDirection = (dotProduct > 0) ? -doorForward : doorForward;

        // Вычисляем позицию телепортации
        Vector3 teleportPosition = doorPosition + teleportDirection * teleportDistance;

        // Сохраняем высоту игрока
        teleportPosition.y = playerPosition.y;

        return teleportPosition;
    }

    Vector3 GetValidTeleportPosition(Vector3 desiredPosition, GameObject doorObject)
    {
        Vector3 doorForward = doorObject.transform.forward;
        Vector3 doorRight = doorObject.transform.right;

        // Проверяем основную позицию
        if (IsPositionValid(desiredPosition))
        {
            return desiredPosition;
        }

        // Пробуем разные смещения
        Vector3[] offsets = {
            Vector3.zero,
            doorRight * 0.5f,
            -doorRight * 0.5f,
            doorRight * 0.8f,
            -doorRight * 0.8f,
            (doorRight + doorForward * 0.3f) * 0.5f,
            (-doorRight + doorForward * 0.3f) * 0.5f,
            doorForward * 0.5f,
            -doorForward * 0.5f
        };

        // Сначала проверяем близкие позиции
        for (int i = 0; i < offsets.Length; i++)
        {
            Vector3 testPosition = desiredPosition + offsets[i];
            if (IsPositionValid(testPosition))
            {
                return testPosition;
            }
        }

        // Если ничего не найдено, возвращаем желаемую позицию (будет предупреждение)
        Debug.LogWarning("Не найдена валидная позиция для телепортации!");
        return desiredPosition;
    }

    bool IsPositionValid(Vector3 position)
    {
        // Проверяем коллизии с помощью CapsuleCast для более точного определения
        Vector3 point1 = position + Vector3.up * 0.1f;
        Vector3 point2 = position + Vector3.up * (heightCheck - 0.1f);

        Collider[] colliders = Physics.OverlapCapsule(point1, point2, playerRadius);

        foreach (Collider collider in colliders)
        {
            // Игнорируем триггеры, двери и самого игрока
            if (collider.isTrigger) continue;
            if (collider.gameObject.name.StartsWith("Door_")) continue;
            if (collider.gameObject == gameObject) continue;
            if (collider.transform.IsChildOf(transform)) continue;

            // Если нашли любой другой коллайдер - позиция невалидна
            return false;
        }

        return true;
    }

    IEnumerator TeleportCoroutine(Vector3 targetPosition, GameObject doorObject)
    {
        canTeleport = false;

        // Отключаем CharacterController на время телепортации если он есть
        bool wasEnabled = false;
        if (characterController != null)
        {
            wasEnabled = characterController.enabled;
            characterController.enabled = false;
        }

        // Эффекты перед телепортацией
        PlayTeleportEffects(transform.position);

        // Короткая задержка для эффекта
        yield return new WaitForSeconds(0.1f);

        // Телепортируем игрока
        transform.position = targetPosition;

        // Включаем CharacterController обратно
        if (characterController != null && wasEnabled)
        {
            characterController.enabled = true;
        }

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