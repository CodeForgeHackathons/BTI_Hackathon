package assistant

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "log"
    "net/http"
    "os"
    "strings"
    "time"
)

const (
	modelURI = "gpt://b1gu5443n2mkggql04p5/yandexgpt/rc"
	folderID = "b1gu5443n2mkggql04p5"
	apiUrl   = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
)

type BTIResponse struct {
	IsValid             bool     `json:"is_valid"`
	Decision            string   `json:"decision"`
	Justification       string   `json:"justification"`
	TechnicalBasis      []string `json:"technical_basis"`
	LimitationsRisks    []string `json:"limitations_risks"`
	ClarificationNeeded []string `json:"clarification_needed"`
}

type YandexAIRequest struct {
	ModelURI          string            `json:"modelUri"`
	CompletionOptions CompletionOptions `json:"completionOptions"`
	Messages          []Message         `json:"messages"`
}

type CompletionOptions struct {
	Temperature float32 `json:"temperature"`
	MaxTokens   int     `json:"maxTokens"`
}

type Message struct {
	Role string `json:"role"`
	Text string `json:"text"`
}

type YandexAIResponse struct {
	Result struct {
		Alternatives []struct {
			Message struct {
				Text string `json:"text"`
			} `json:"message"`
		} `json:"alternatives"`
	} `json:"result"`
}

func AiAnalyze(userQuestion string) (*BTIResponse, error) {
    if len(userQuestion) > 450000 {
        userQuestion = userQuestion[:450000]
    }

    instr := "Ты инженер БТИ. Возвращай строго JSON без лишнего текста в формате {\\\"is_valid\\\":bool,\\\"decision\\\":string,\\\"justification\\\":string,\\\"technical_basis\\\":[string],\\\"limitations_risks\\\":[string],\\\"clarification_needed\\\":[string]}. Если нет явных нарушений нормативов и несущих конструкций, decision=\\\"можно\\\", is_valid=true. При недостаточности данных или возможных ограничениях — decision=\\\"можно при условиях\\\", is_valid=true. Значение decision=\\\"нельзя\\\" и is_valid=false ставь только при очевидном запрете."

    request := YandexAIRequest{
        ModelURI: modelURI,
        CompletionOptions: CompletionOptions{
            Temperature: 0.3,
            MaxTokens:   3000,
        },
        Messages: []Message{
            {Role: "system", Text: instr},
            {Role: "user", Text: userQuestion},
        },
    }

    response, err := sendToYandexAI(request)
    if err != nil {
        return createFallbackResponse(userQuestion), nil
    }

    btiResponse, err := parseAiResponse(response)
    if err != nil {
        return createFallbackResponse(response), nil
    }

    return btiResponse, nil

}

func AiAnalyzeWithKey(userQuestion string, apiKey string) (*BTIResponse, error) {
    if len(userQuestion) > 450000 {
        userQuestion = userQuestion[:450000]
    }

    instr := "Ты инженер БТИ. Возвращай строго JSON без лишнего текста в формате {\\\"is_valid\\\":bool,\\\"decision\\\":string,\\\"justification\\\":string,\\\"technical_basis\\\":[string],\\\"limitations_risks\\\":[string],\\\"clarification_needed\\\":[string]}. Если нет явных нарушений нормативов и несущих конструкций, decision=\\\"можно\\\", is_valid=true. При недостаточности данных или возможных ограничениях — decision=\\\"можно при условиях\\\", is_valid=true. Значение decision=\\\"нельзя\\\" и is_valid=false ставь только при очевидном запрете."

    request := YandexAIRequest{
        ModelURI: modelURI,
        CompletionOptions: CompletionOptions{
            Temperature: 0.3,
            MaxTokens:   3000,
        },
        Messages: []Message{
            {Role: "system", Text: instr},
            {Role: "user", Text: userQuestion},
        },
    }

    response, err := sendToYandexAIWithKey(request, apiKey)
    if err != nil {
        return createFallbackResponse(userQuestion), nil
    }

    btiResponse, err := parseAiResponse(response)
    if err != nil {
        return createFallbackResponse(response), nil
    }

    return btiResponse, nil
}

func sendToYandexAI(request YandexAIRequest) (string, error) {
    iamToken := os.Getenv("YANDEX_CLOUD_API_KEY")

    if iamToken == "" {
        return "", fmt.Errorf("Api key not found")
    }

	jsonData, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("ошибка создания JSON: %w", err)
	}

	req, err := http.NewRequest("POST", apiUrl, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("ошибка создания запроса: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+iamToken)
	req.Header.Set("X-Folder-Id", folderID)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("ошибка отправки запроса: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("ошибка чтения ответа: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ошибка API (статус %d): %s", resp.StatusCode, string(body))
	}

	var aiResponse YandexAIResponse
	if err := json.Unmarshal(body, &aiResponse); err != nil {
		return "", fmt.Errorf("ошибка парсинга ответа: %w", err)
	}

	if len(aiResponse.Result.Alternatives) > 0 {
		return aiResponse.Result.Alternatives[0].Message.Text, nil
	}

	return "", fmt.Errorf("пустой ответ от AI")
}

func sendToYandexAIWithKey(request YandexAIRequest, iamToken string) (string, error) {
    if strings.TrimSpace(iamToken) == "" {
        return "", fmt.Errorf("Api key not found")
    }

    jsonData, err := json.Marshal(request)
    if err != nil {
        return "", fmt.Errorf("ошибка создания JSON: %w", err)
    }

    req, err := http.NewRequest("POST", apiUrl, bytes.NewBuffer(jsonData))
    if err != nil {
        return "", fmt.Errorf("ошибка создания запроса: %w", err)
    }

    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+iamToken)
    req.Header.Set("X-Folder-Id", folderID)

    client := &http.Client{Timeout: 30 * time.Second}
    resp, err := client.Do(req)
    if err != nil {
        return "", fmt.Errorf("ошибка отправки запроса: %w", err)
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return "", fmt.Errorf("ошибка чтения ответа: %w", err)
    }

    if resp.StatusCode != http.StatusOK {
        return "", fmt.Errorf("ошибка API (статус %d): %s", resp.StatusCode, string(body))
    }

    var aiResponse YandexAIResponse
    if err := json.Unmarshal(body, &aiResponse); err != nil {
        return "", fmt.Errorf("ошибка парсинга ответа: %w", err)
    }

    if len(aiResponse.Result.Alternatives) > 0 {
        return aiResponse.Result.Alternatives[0].Message.Text, nil
    }

    return "", fmt.Errorf("пустой ответ от AI")
}
func parseAiResponse(aiRawResponse string) (*BTIResponse, error) {
	cleanedResponse := cleanAIResponse(aiRawResponse)

	var btiResponse BTIResponse
	if err := json.Unmarshal([]byte(cleanedResponse), &btiResponse); err != nil {
		log.Printf("AI response parsing failed: %v\nRaw: %s", err, aiRawResponse)
		return createFallbackResponse(aiRawResponse), nil
	}

	if btiResponse.Decision == "" {
		btiResponse.Decision = "можно"
	}

	return &btiResponse, nil
}
func cleanAIResponse(response string) string {
	response = strings.TrimSpace(response)
	response = strings.TrimPrefix(response, "```json")
	response = strings.TrimSuffix(response, "```")
	response = strings.TrimSpace(response)

	start := strings.Index(response, "{")
	end := strings.LastIndex(response, "}") + 1

	if start >= 0 && end > start {
		return response[start:end]
	}

	return response
}

func createFallbackResponse(aiRawResponse string) *BTIResponse {
    response := &BTIResponse{
        IsValid:             false,
        Decision:            "pending",
        Justification:       "Требуется уточнение данных",
        TechnicalBasis:      []string{},
        LimitationsRisks:    []string{"Требуется ручная проверка инженером"},
        ClarificationNeeded: []string{"Необходима полная техническая документация"},
    }

    lowerResponse := strings.ToLower(aiRawResponse)

    if strings.Contains(lowerResponse, "нельзя") ||
        strings.Contains(lowerResponse, "запрещ") ||
        strings.Contains(lowerResponse, "противоречит") ||
        strings.Contains(lowerResponse, "не допуска") {
        response.IsValid = false
        response.Decision = "нельзя"
    } else if strings.Contains(lowerResponse, "услови") || strings.Contains(lowerResponse, "ограничен") {
        response.Decision = "можно при условиях"
    }
    if strings.Contains(aiRawResponse, "обоснование") || strings.Contains(aiRawResponse, "justification") {
        lines := strings.Split(aiRawResponse, "\n")
        for _, line := range lines {
            if strings.Contains(strings.ToLower(line), "обоснование") ||
                strings.Contains(strings.ToLower(line), "justification") {
                parts := strings.Split(line, ":")
                if len(parts) > 1 {
                    response.Justification = strings.TrimSpace(parts[1])
                }
            }
        }
    }

    return response
}
