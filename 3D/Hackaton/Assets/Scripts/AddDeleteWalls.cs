using UnityEngine;
using System.Collections.Generic;

public class SimpleWallBuilder : MonoBehaviour
{
    [Header("Основные настройки")]
    public KeyCode buildModeKey = KeyCode.B;
    public float maxDistance = 5f;
    public float buildDistance = 3f;

    [Header("Настройки стены")]
    public float wallHeight = 2f;
    public float wallThickness = 0.2f;
    public float wallLength = 2f;
    public Material wallMaterial;

    [Header("Настройки изменения параметров")]
    public KeyCode heightChangeKey = KeyCode.H;
    public KeyCode lengthChangeKey1 = KeyCode.Y;
    public KeyCode lengthChangeKey2 = KeyCode.T;
    public float changeSensitivity = 0.1f;
    public float minWallHeight = 0.5f;
    public float maxWallHeight = 5f;
    public float minWallLength = 0.5f;
    public float maxWallLength = 10f;

    private Camera playerCamera;
    private GameObject currentTargetWall;
    private GameObject buildPreview;
    private bool isBuildMode = false;
    private List<GameObject> builtWalls = new List<GameObject>();

    void Start()
    {
        playerCamera = GetComponent<Camera>();
        if (playerCamera == null)
        {
            playerCamera = Camera.main;
        }

        CreateBuildPreview();
        Debug.Log("Нажмите B для режима строительства");
        Debug.Log("Зажмите H + колесо - высота, Y + колесо - длина1, T + колесо - длина2");
    }

    void Update()
    {
        // Обработка изменения параметров стены (работает всегда)
        HandleWallParameterChanges();

        // Переключение режима строительства
        if (Input.GetKeyDown(buildModeKey))
        {
            ToggleBuildMode();
        }

        if (isBuildMode)
        {
            // В режиме строительства обновляем превью
            UpdateBuildPreview();

            // ЛКМ для установки стены
            if (Input.GetMouseButtonDown(0))
            {
                BuildWall();
            }

            // ПКМ для отмены режима строительства
            if (Input.GetMouseButtonDown(1))
            {
                SetBuildMode(false);
            }
        }
        else
        {
            // В обычном режиме можно удалять стены
            FindWallForRemoval();

            if (Input.GetMouseButtonDown(0) && currentTargetWall != null)
            {
                RemoveWall(currentTargetWall);
            }
        }
    }

    void HandleWallParameterChanges()
    {
        float scroll = Input.GetAxis("Mouse ScrollWheel");

        if (Mathf.Abs(scroll) > 0.01f) // Если есть прокрутка
        {
            // Изменение высоты стены (H + колесо)
            if (Input.GetKey(heightChangeKey))
            {
                float heightChange = scroll * changeSensitivity;
                wallHeight = Mathf.Clamp(wallHeight + heightChange, minWallHeight, maxWallHeight);

                Debug.Log($"Высота стены: {wallHeight:F2}m");

                // Обновляем превью если в режиме строительства
                if (isBuildMode)
                {
                    UpdateBuildPreview();
                }
            }
            // Изменение длины стены с одной стороны (Y + колесо)
            else if (Input.GetKey(lengthChangeKey1))
            {
                float lengthChange = scroll * changeSensitivity;
                wallLength = Mathf.Clamp(wallLength + lengthChange, minWallLength, maxWallLength);

                Debug.Log($"Длина стены: {wallLength:F2}m");

                // Обновляем превью если в режиме строительства
                if (isBuildMode)
                {
                    UpdateBuildPreview();
                }
            }
            // Изменение толщины стены (T + колесо)
            else if (Input.GetKey(lengthChangeKey2))
            {
                float thicknessChange = scroll * changeSensitivity;
                wallThickness = Mathf.Clamp(wallThickness + thicknessChange, 0.05f, 1f);

                Debug.Log($"Толщина стены: {wallThickness:F2}m");

                // Обновляем превью если в режиме строительства
                if (isBuildMode)
                {
                    UpdateBuildPreview();
                }
            }
        }
    }

    void ToggleBuildMode()
    {
        SetBuildMode(!isBuildMode);
    }

    void SetBuildMode(bool mode)
    {
        isBuildMode = mode;
        if (buildPreview != null)
        {
            buildPreview.SetActive(mode);
        }

        if (mode)
        {
            Debug.Log("Режим строительства: ЛКМ - поставить стену, ПКМ - отмена");
            Debug.Log($"Текущие параметры: Высота: {wallHeight:F2}m, Длина: {wallLength:F2}m, Толщина: {wallThickness:F2}m");
            Cursor.lockState = CursorLockMode.Locked;
        }
        else
        {
            Debug.Log("Обычный режим: ЛКМ - удалить стену");
            currentTargetWall = null;
        }
    }

    void CreateBuildPreview()
    {
        buildPreview = GameObject.CreatePrimitive(PrimitiveType.Cube);
        buildPreview.name = "BuildPreview";

        // Настраиваем внешний вид превью
        Renderer renderer = buildPreview.GetComponent<Renderer>();
        renderer.material = new Material(Shader.Find("Standard"));
        renderer.material.color = new Color(0, 1, 0, 0.3f); // Полупрозрачный зеленый

        // Отключаем коллайдер чтобы не мешал
        buildPreview.GetComponent<Collider>().enabled = false;

        buildPreview.SetActive(false);
    }

    void UpdateBuildPreview()
    {
        if (buildPreview == null) return;

        // Позиция перед игроком
        Vector3 buildPos = playerCamera.transform.position + playerCamera.transform.forward * buildDistance;
        buildPos.y = wallHeight / 2f; // Половина высоты от пола

        buildPreview.transform.position = buildPos;
        buildPreview.transform.rotation = Quaternion.LookRotation(playerCamera.transform.right); // Перпендикулярно взгляду
        buildPreview.transform.localScale = new Vector3(wallThickness, wallHeight, wallLength);
    }

    void FindWallForRemoval()
    {
        Ray ray = playerCamera.ScreenPointToRay(new Vector3(Screen.width / 2, Screen.height / 2, 0));
        RaycastHit hit;

        if (Physics.Raycast(ray, out hit, maxDistance))
        {
            GameObject hitObject = hit.collider.gameObject;
            if ((hitObject.name.StartsWith("Wall_") || (hitObject.CompareTag("Wall")) && hitObject != buildPreview) || hitObject.CompareTag("Door") || hitObject.CompareTag("Window"))
            {
                currentTargetWall = hitObject;
            }
            else
            {
                currentTargetWall = null;
            }
        }
        else
        {
            currentTargetWall = null;
        }
    }

    void BuildWall()
    {
        if (buildPreview == null) return;

        // Создаем стену на месте превью
        GameObject newWall = GameObject.CreatePrimitive(PrimitiveType.Cube);
        newWall.transform.position = buildPreview.transform.position;
        newWall.transform.rotation = buildPreview.transform.rotation;
        newWall.transform.localScale = buildPreview.transform.localScale;
        newWall.name = $"Wall_Built_{builtWalls.Count}";
        newWall.tag = "Wall";

        // Применяем материал если задан
        if (wallMaterial != null)
        {
            newWall.GetComponent<Renderer>().material = wallMaterial;
        }

        builtWalls.Add(newWall);
        Debug.Log($"Построена новая стена! Высота: {wallHeight:F2}m, Длина: {wallLength:F2}m, Толщина: {wallThickness:F2}m");
    }

    void RemoveWall(GameObject wall)
    {
        if (wall != null && wall != buildPreview)
        {
            // Удаляем из списка построенных стен
            if (builtWalls.Contains(wall))
            {
                builtWalls.Remove(wall);
            }

            Destroy(wall);
            Debug.Log($"Стена удалена. Осталось: {builtWalls.Count}");
            currentTargetWall = null;
        }
    }

    // Публичные методы для настройки параметров
    public void SetWallHeight(float height)
    {
        wallHeight = Mathf.Clamp(height, minWallHeight, maxWallHeight);
        if (isBuildMode)
        {
            UpdateBuildPreview();
        }
    }

    public void SetWallLength(float length)
    {
        wallLength = Mathf.Clamp(length, minWallLength, maxWallLength);
        if (isBuildMode)
        {
            UpdateBuildPreview();
        }
    }

    public void SetWallThickness(float thickness)
    {
        wallThickness = Mathf.Clamp(thickness, 0.05f, 1f);
        if (isBuildMode)
        {
            UpdateBuildPreview();
        }
    }

    public void SetBuildDistance(float distance)
    {
        buildDistance = distance;
        if (isBuildMode)
        {
            UpdateBuildPreview();
        }
    }

    public void ClearAllBuiltWalls()
    {
        foreach (GameObject wall in builtWalls)
        {
            if (wall != null) Destroy(wall);
        }
        builtWalls.Clear();
        Debug.Log("Все построенные стены удалены");
    }

    public bool IsInBuildMode()
    {
        return isBuildMode;
    }

    public int GetBuiltWallsCount()
    {
        return builtWalls.Count;
    }

    // Получение текущих параметров
    public float GetCurrentHeight()
    {
        return wallHeight;
    }

    public float GetCurrentLength()
    {
        return wallLength;
    }

    public float GetCurrentThickness()
    {
        return wallThickness;
    }

    // Визуализация для отладки
    void OnDrawGizmos()
    {
        if (playerCamera != null)
        {
            // Луч прицеливания
            Gizmos.color = isBuildMode ? Color.green : Color.white;
            Vector3 rayStart = playerCamera.transform.position;
            Vector3 rayDirection = playerCamera.transform.forward * maxDistance;
            Gizmos.DrawRay(rayStart, rayDirection);

            // Область строительства в режиме строительства
            if (isBuildMode)
            {
                Gizmos.color = Color.cyan;
                Vector3 buildPos = playerCamera.transform.position + playerCamera.transform.forward * buildDistance;
                Gizmos.DrawWireCube(buildPos, new Vector3(wallThickness, wallHeight, wallLength));
            }

            // Подсветка цели для удаления
            if (!isBuildMode && currentTargetWall != null)
            {
                Gizmos.color = Color.red;
                Gizmos.DrawWireCube(currentTargetWall.transform.position, currentTargetWall.transform.localScale);
            }
        }
    }

    void OnGUI()
    {
        // Отображение текущих параметров на экране
        if (isBuildMode)
        {
            GUI.Box(new Rect(10, 10, 250, 100), "Параметры стены");
            GUI.Label(new Rect(20, 35, 230, 20), $"Высота: {wallHeight:F2}m (H + колесо)");
            GUI.Label(new Rect(20, 55, 230, 20), $"Длина: {wallLength:F2}m (Y + колесо)");
            GUI.Label(new Rect(20, 75, 230, 20), $"Толщина: {wallThickness:F2}m (T + колесо)");
        }
    }

    void OnDestroy()
    {
        // Убираем превью при уничтожении
        if (buildPreview != null)
        {
            Destroy(buildPreview);
        }
    }
}