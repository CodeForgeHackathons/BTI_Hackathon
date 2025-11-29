/**
 * GraphQL клиент для отправки запросов на бэкенд
 * 
 * Настройка endpoint:
 * - По умолчанию используется '/query' (согласно настройкам сервера)
 * - Для изменения создайте файл .env с переменной VITE_GRAPHQL_ENDPOINT
 * - Пример: VITE_GRAPHQL_ENDPOINT=http://localhost:8080/query
 */
 
// URL GraphQL endpoint (можно переопределить через переменные окружения)
const GRAPHQL_ENDPOINT = import.meta.env.VITE_GRAPHQL_ENDPOINT || '/query';

/**
 * Выполняет GraphQL запрос
 * Сервер принимает запрос как строку (string)
 * @param {string} query - GraphQL запрос или mutation
 * @param {object} variables - Переменные для запроса
 * @returns {Promise<object>} Результат запроса
 */
export async function graphqlRequest(query, variables = {}) {
  try {
    // Пытаемся достать токен авторизации для ЛК (если он сохранён)
    let token = null;
    let userIdHeader = null;
    let yandexApiKeyHeader = null;
    let onlyApprovedHeader = null;
    let projectsFilterHeader = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        token = window.localStorage.getItem('authToken');
        userIdHeader = window.localStorage.getItem('homeplanner3d:userId');
        yandexApiKeyHeader = window.localStorage.getItem('homeplanner3d:yandexAPIKey');
        onlyApprovedHeader = window.localStorage.getItem('homeplanner3d:onlyApproved');
        projectsFilterHeader = window.localStorage.getItem('homeplanner3d:projectsFilter');
      }
    } catch {
      token = null;
      userIdHeader = null;
      yandexApiKeyHeader = null;
      onlyApprovedHeader = null;
      projectsFilterHeader = null;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (userIdHeader) {
      headers['X-User-Id'] = String(userIdHeader);
    }
    if (yandexApiKeyHeader) {
      headers['X-Yandex-Api-Key'] = String(yandexApiKeyHeader);
    }
    if (onlyApprovedHeader) {
      headers['X-Only-Approved'] = String(onlyApprovedHeader);
    }
    if (projectsFilterHeader) {
      headers['X-Projects-Filter'] = String(projectsFilterHeader);
    }
    
    // Формируем тело запроса в стандартном GraphQL формате
    const requestBody = {
      query: query,
      variables: variables
    };
    
    // Логируем для отладки (можно убрать в продакшене)
    // console.debug('GraphQL запрос:', { endpoint: GRAPHQL_ENDPOINT, body: requestBody });
    
    // Отправляем запрос в стандартном GraphQL формате: { query, variables }
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });
    
    // console.debug('GraphQL ответ:', {
    //   status: response.status,
    //   statusText: response.statusText,
    //   contentType: response.headers.get('content-type'),
    //   ok: response.ok
    // });

    // Проверяем Content-Type перед чтением ответа
    const contentType = response.headers.get('content-type') || '';
    const isJSON = contentType.includes('application/json');
    
    if (!response.ok) {
      // Пытаемся прочитать текст ошибки
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}. ` +
        `Content-Type: ${contentType || 'не указан'}. ` +
        `Ответ: ${errorText.substring(0, 200)}`
      );
    }

    // Если сервер вернул HTML вместо JSON - это проблема конфигурации
    if (!isJSON) {
      const text = await response.text();
      console.error('Сервер вернул HTML вместо JSON. Полный ответ:', text);
      throw new Error(
        `Сервер вернул HTML (GraphQL Playground) вместо JSON. ` +
        `Это означает, что endpoint ${GRAPHQL_ENDPOINT} настроен неправильно. ` +
        `Убедитесь, что: ` +
        `1) Сервер обрабатывает POST запросы на ${GRAPHQL_ENDPOINT}, ` +
        `2) GraphQL Playground отключён или доступен только на GET запросы, ` +
        `3) Endpoint возвращает JSON для POST запросов с Content-Type: application/json`
      );
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL ошибки:', data.errors);
      throw new Error(data.errors.map(e => e.message).join(', '));
    }

    return data.data;
  } catch (error) {
    console.error('Ошибка GraphQL запроса:', error);
    
    // Если это ошибка парсинга JSON (сервер вернул HTML)
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      const friendlyError = new Error(
        `Сервер вернул HTML вместо JSON. ` +
        `Возможно, GraphQL endpoint (${GRAPHQL_ENDPOINT}) недоступен или сервер не запущен. ` +
        `Проверьте настройки бэкенда.`
      );
      friendlyError.originalError = error;
      throw friendlyError;
    }
    
    throw error;
  }
}

/**
 * Строит GraphQL запрос как строку с подставленными переменными
 * @param {string} query - GraphQL запрос с переменными
 * @param {object} variables - Значения переменных
 * @returns {string} Готовый GraphQL запрос как строка
 */
function buildQueryString(query, variables) {
  if (!variables || Object.keys(variables).length === 0) {
    return query;
  }

  // Подставляем переменные в запрос
  // Заменяем $input: PlanningProjectInput! на значение переменной
  let queryString = query;
  
  if (variables.input) {
    // Преобразуем объект input в GraphQL формат
    const inputValue = formatGraphQLInput(variables.input);
    
    // Заменяем объявление переменной на значение
    queryString = queryString.replace(
      /\$input: PlanningProjectInput!/g,
      inputValue
    );
    
    // Заменяем использование переменной в вызове mutation
    queryString = queryString.replace(
      /input: \$input/g,
      `input: ${inputValue}`
    );
  }

  return queryString;
}

/**
 * Форматирует объект input в GraphQL формат
 * @param {object} input - Объект с данными
 * @returns {string} GraphQL форматированная строка
 */
function formatGraphQLInput(input) {
  const formatValue = (value) => {
    if (value === null || value === undefined) {
      return 'null';
    }
    
    if (typeof value === 'string') {
      // Экранируем специальные символы
      const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
      return `"${escaped}"`;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    
    if (Array.isArray(value)) {
      const items = value.map(item => formatValue(item)).join(', ');
      return `[${items}]`;
    }
    
    if (typeof value === 'object') {
      const fields = Object.entries(value)
        .filter(([_, val]) => val !== null && val !== undefined)
        .map(([key, val]) => {
          return `${key}: ${formatValue(val)}`;
        })
        .join(', ');
      return `{${fields}}`;
    }
    
    return JSON.stringify(value);
  };

  return formatValue(input);
}

/**
 * Mutation для создания проекта перепланировки
 */
export const CREATE_PLANNING_PROJECT_MUTATION = `
  mutation CreatePlanningProject($input: PlanningProjectInput!) {
    createPlanningProject(input: $input) {
      id
      status
      createdAt
      clientTimestamp
      plan {
        address
        area
        source
        layoutType
        familyProfile
        goal
        prompt
        ceilingHeight
        floorDelta
        recognitionStatus
        file { name size type content }
      }
      geometry {
        rooms {
          id
          name
          height
          vertices {
            x
            y
          }
        }
      }
      walls {
        id
        start {
          x
          y
        }
        end {
          x
          y
        }
        loadBearing
        thickness
        wallType
      }
      constraints {
        forbiddenMoves
        regionRules
      }
    }
  }
`;

export const GET_USER_PROJECTS_QUERY = `
  query GetUserProjects($userID: ID!) {
    getUserProjects(userID: $userID) {
      id
      status
      createdAt
      plan { address area source }
    }
  }
`;

export async function getLegalUserProjects(userID) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('homeplanner3d:userId', String(userID));
      window.localStorage.setItem('homeplanner3d:projectsFilter', 'legal');
      window.localStorage.removeItem('homeplanner3d:onlyApproved');
    }
  } catch {}
  const data = await graphqlRequest(GET_USER_PROJECTS_QUERY, { userID: String(userID) });
  return data?.getUserProjects ?? [];
}

/**
 * Запрос к BTI агенту (передаём данные проекта текстом)
 */
export const ASK_BTI_AGENT_MUTATION = `
  mutation AskBTIAgent($input: BTI_agent!) {
    askBTIagent(input: $input)
  }
`;

