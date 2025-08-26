// Mock API service for testing
export const api = {
  login: async (credentials: { email: string; password: string }) => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    if (credentials.email === 'wrong@example.com') {
      throw new Error('Invalid credentials')
    }
    
    return {
      user: { id: '1', email: credentials.email },
      token: 'mock-token',
      refreshToken: 'mock-refresh-token'
    }
  },

  register: async (userData: any) => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return {
      user: { 
        id: '1', 
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName
      },
      token: 'mock-token',
      refreshToken: 'mock-refresh-token'
    }
  },

  verifyToken: async (token: string) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (token === 'valid-token') {
      return {
        user: { id: '1', email: 'test@example.com' }
      }
    }
    
    throw new Error('Invalid token')
  },

  refreshToken: async (refreshToken: string) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return {
      token: 'new-token',
      refreshToken: 'new-refresh-token'
    }
  },

  createProject: async (data: { title: string; content?: string }) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return {
      id: 'project-1',
      title: data.title,
      content: data.content || '',
      currentPhase: 'ideation',
      createdAt: new Date().toISOString()
    }
  },

  updateProject: async (id: string, data: any) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return {
      id,
      ...data,
      updatedAt: new Date().toISOString()
    }
  },

  getProject: async (id: string) => {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return {
      id,
      title: 'Test Project',
      content: '',
      currentPhase: 'ideation',
      phases: [
        { id: 'phase-1', type: 'ideation', status: 'active' }
      ]
    }
  },

  sendMessage: async (data: { projectId: string; content: string; agentType: string }) => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    return {
      id: 'msg-1',
      content: 'Great idea! Let me help you develop that concept...',
      role: 'agent',
      agentType: data.agentType
    }
  }
}