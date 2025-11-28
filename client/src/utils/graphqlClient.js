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
 * @param {string} query - GraphQL запрос или mutation
 * @param {object} variables - Переменные для запроса
 * @returns {Promise<object>} Результат запроса
 */
export async function graphqlRequest(query, variables = {}) {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
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

