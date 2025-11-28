/**
 * GraphQL клиент для отправки запросов на бэкенд
 * 
 * Настройка endpoint:
 * - По умолчанию используется '/graphql' (проксируется через Vite)
 * - Для изменения создайте файл .env с переменной VITE_GRAPHQL_ENDPOINT
 * - Пример: VITE_GRAPHQL_ENDPOINT=http://localhost:8080/graphql
 */
 
// URL GraphQL endpoint (можно переопределить через переменные окружения)
const GRAPHQL_ENDPOINT = import.meta.env.VITE_GRAPHQL_ENDPOINT || '/graphql';

/**
 * Выполняет GraphQL запрос
 * Сервер принимает запрос как строку (string)
 * @param {string} query - GraphQL запрос или mutation
 * @param {object} variables - Переменные для запроса
 * @returns {Promise<object>} Результат запроса
 */
export async function graphqlRequest(query, variables = {}) {
  try {
    // Формируем запрос как строку с подставленными переменными
    const queryString = buildQueryString(query, variables);

    // Пытаемся достать токен авторизации для ЛК (если он сохранён)
    let token = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        token = window.localStorage.getItem('authToken');
      }
    } catch {
      token = null;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Отправляем запрос как строку (не JSON объект)
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(queryString), // Отправляем строку запроса
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL ошибки:', data.errors);
      throw new Error(data.errors.map(e => e.message).join(', '));
    }

    return data.data;
  } catch (error) {
    console.error('Ошибка GraphQL запроса:', error);
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
      }
      constraints {
        forbiddenMoves
        regionRules
      }
    }
  }
`;

