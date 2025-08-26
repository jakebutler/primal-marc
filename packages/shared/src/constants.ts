// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    REFRESH: '/api/auth/refresh',
    LOGOUT: '/api/auth/logout'
  },
  CONTENT: {
    LIST: '/api/content',
    CREATE: '/api/content',
    GET: (id: string) => `/api/content/${id}`,
    UPDATE: (id: string) => `/api/content/${id}`,
    DELETE: (id: string) => `/api/content/${id}`
  },
  AGENTS: {
    INTERACT: '/api/agents/interact',
    HISTORY: (contentId: string) => `/api/agents/history/${contentId}`
  }
} as const

// Socket events
export const SOCKET_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  AGENT_INTERACTION: 'agent_interaction',
  AGENT_RESPONSE: 'agent_response',
  CONTENT_UPDATE: 'content_update'
} as const

// Application limits
export const LIMITS = {
  CONTENT_TITLE_MAX: 200,
  CONTENT_BODY_MAX: 50000,
  USERNAME_MIN: 3,
  USERNAME_MAX: 50,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 100
} as const

// Error messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  NOT_FOUND: 'Resource not found',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
  RATE_LIMIT: 'Too many requests'
} as const