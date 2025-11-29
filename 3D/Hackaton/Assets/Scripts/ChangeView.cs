using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class ChangeView : MonoBehaviour
{
    GameObject ceil;
    void Update()
    {
        if (Input.GetKeyDown(KeyCode.V))
        {
            if(ceil == null)
                ceil = GameObject.Find("Ceiling");
            if (ceil.active)
                ceil.SetActive(false);
            else
                ceil.SetActive(true);
        }
    } 
}
