package assistant

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	modelURI = "gpt://b1gu5443n2mkggql04p5/yandexgpt/rc"
	folderID = "b1gu5443n2mkggql04p5"
	apiUrl   = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
)

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

func AskAgent(userQuestion string) (string, error) {

	request := YandexAIRequest{
		ModelURI: modelURI,
		CompletionOptions: CompletionOptions{
			Temperature: 0.3,
			MaxTokens:   6000,
		},
		Messages: []Message{
			{
				Role: "user",
				Text: userQuestion,
			},
		},
	}

	response, err := sendToYandexAI(request)
	if err != nil {
		return "", err
	}
	return response, nil
}

func sendToYandexAI(request YandexAIRequest) (string, error) {
	iamToken := ""

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
