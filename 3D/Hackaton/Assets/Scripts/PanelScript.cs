using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class PanelScript : MonoBehaviour
{
    public GameObject[] rama;
    int lastInd;
    public GameObject[] objectToPlace;
    public float placementDistance = 3f;

    // Добавляем теги для пола и потолка
    public string floorTag = "Floor";
    public string ceilingTag = "Ceiling";

    private Camera playerCamera;

    public LayerMask placedObjectLayer;

    void Start()
    {
        playerCamera = Camera.main;
    }

    void PlaceObject()
    {
        Ray ray = playerCamera.ScreenPointToRay(new Vector3(Screen.width / 2, Screen.height / 2, 0));
        RaycastHit hit;

        if (Physics.Raycast(ray, out hit, placementDistance))
        {
            // Проверяем, попал ли луч в объект с тегом "Floor" или "Ceiling"
            if ((hit.collider.CompareTag(floorTag) && lastInd != 2 && lastInd != 4) || (hit.collider.CompareTag(ceilingTag) &&  lastInd == 2 && lastInd != 4) || (!hit.collider.CompareTag(ceilingTag) && !hit.collider.CompareTag(floorTag) && lastInd == 4))
            {
                // Определяем, на полу или потолке размещаем объект
                bool isOnCeiling = hit.collider.CompareTag(ceilingTag);

                Vector3 directionToPlayer = playerCamera.transform.position - hit.point;

                if (isOnCeiling)
                {
                    // Для потолка - направляем объект вниз и лицом к игроку
                    directionToPlayer.y = 0; // Обнуляем Y для горизонтального поворота

                    if (directionToPlayer != Vector3.zero)
                    {
                        Quaternion rotation = Quaternion.LookRotation(directionToPlayer);
                        GameObject newObject = Instantiate(objectToPlace[lastInd], hit.point, rotation);
                        newObject.layer = (int)Mathf.Log(placedObjectLayer.value, 2);
                    }
                    else
                    {
                        Quaternion rotation = Quaternion.Euler(0, -playerCamera.transform.eulerAngles.y, 180f);
                        GameObject newObject = Instantiate(objectToPlace[lastInd], hit.point, rotation);
                        newObject.layer = (int)Mathf.Log(placedObjectLayer.value, 2);
                    }
                    Debug.Log("Объект установлен на потолке: " + hit.point);
                }
                else
                {
                    // Для пола - стандартная логика
                    directionToPlayer.y = 0;

                    if (directionToPlayer != Vector3.zero)
                    {
                        Quaternion rotation = Quaternion.LookRotation(directionToPlayer);
                        GameObject newObject = Instantiate(objectToPlace[lastInd], hit.point, rotation);
                        newObject.layer = (int)Mathf.Log(placedObjectLayer.value, 2);
                    }
                    else
                    {
                        Quaternion rotation = Quaternion.Euler(0, -playerCamera.transform.eulerAngles.y, 0);
                        GameObject newObject = Instantiate(objectToPlace[lastInd], hit.point, rotation);
                        newObject.layer = (int)Mathf.Log(placedObjectLayer.value, 2);
                    }
                    Debug.Log("Объект установлен на полу: " + hit.point);
                }
            }
            else
            {
                Debug.Log("Можно размещать только на полу или потолке!");
            }
        }
    }

    // Остальной код без изменений
    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Alpha1))
        {
            ChangeIndex(0);
        }
        else if (Input.GetKeyDown(KeyCode.Alpha2))
        {
            ChangeIndex(1);
        }
        else if (Input.GetKeyDown(KeyCode.Alpha3))
        {
            ChangeIndex(2);
        }
        else if (Input.GetKeyDown(KeyCode.Alpha4))
        {
            ChangeIndex(3);
        }
        else if (Input.GetKeyDown(KeyCode.Alpha5))
        {
            ChangeIndex(4);
        }
        else if (Input.GetKeyDown(KeyCode.Alpha6))
        {
            ChangeIndex(5);
        }
        else if (Input.GetKeyDown(KeyCode.Alpha7))
        {
            ChangeIndex(6);
        }

        if (Input.GetKeyDown(KeyCode.E))
        {
            PlaceObject();
        }
        if (Input.GetKeyDown(KeyCode.Q))
        {
            DeleteObject();
        }
    }
    void DeleteObject()
    {
        Ray ray = playerCamera.ScreenPointToRay(new Vector3(Screen.width / 2, Screen.height / 2, 0));
        RaycastHit hit;

        // Увеличиваем дистанцию для удаления, чтобы было удобнее целиться
        if (Physics.Raycast(ray, out hit, placementDistance * 2f, placedObjectLayer))
        {
            // Если луч попал в объект на нужном слое - удаляем его
            Destroy(hit.collider.gameObject);
            Debug.Log("Объект удален: " + hit.collider.gameObject.name);
        }
        else
        {
            Debug.Log("Не удалось найти объект для удаления");
        }
    }
    void ChangeIndex(int newInd)
    {
        if (newInd != lastInd)
        {
            rama[lastInd].SetActive(false);
            rama[newInd].SetActive(true);
            lastInd = newInd;
        }
    }
}