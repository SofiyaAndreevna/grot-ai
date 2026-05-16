import type { ChatMessage, ChatMode, Epic, EpicChat, Project } from '../types'

type EpicDto = {
  id: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
  chats: Array<{
    id: string
    title: string
  }>
}

type ProjectDto = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

type ApiErrorResponse = {
  error?: string
  code?: string
}

type ChatDto = {
  id: string
  epicId: string
  title: string
  mode: ChatMode
  createdAt: string
  updatedAt: string
}

type SendMessageResponseDto = {
  reply?: string
  sources?: string[]
}

type ChatMessageDto = {
  id: string
  role: ChatMessage['role']
  text: string
  createdAt: string
}

type ChatMessagesResponseDto = {
  mode: ChatMode
  isModeLocked: boolean
  messages: ChatMessageDto[]
}

const mapEpicDto = (epic: EpicDto): Epic => ({
  id: epic.id,
  title: epic.title,
  createdAt: epic.createdAt,
  updatedAt: epic.updatedAt,
  chats: epic.chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
  })),
})

const mapProjectDto = (project: ProjectDto): Project => ({
  id: project.id,
  title: project.name,
  description: '',
  epics: [],
})

const mapChatDto = (chat: ChatDto): EpicChat => ({
  id: chat.id,
  title: chat.title,
})

const readErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as ApiErrorResponse
    if (payload.error) {
      return payload.error
    }
  } catch {
    // Ignore JSON parsing error and use generic message.
  }

  return `Request failed with status ${response.status}`
}

export const fetchEpics = async (projectId: string): Promise<Epic[]> => {
  const response = await fetch(`/api/epics?projectId=${encodeURIComponent(projectId)}`)
  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const payload = (await response.json()) as { epics: EpicDto[] }
  return payload.epics.map(mapEpicDto)
}

export const fetchProjects = async (): Promise<Project[]> => {
  const response = await fetch('/api/projects')
  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const payload = (await response.json()) as { projects: ProjectDto[] }
  return payload.projects.map(mapProjectDto)
}

export const createProject = async (id: string, name: string): Promise<Project> => {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, name }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const payload = (await response.json()) as { project: ProjectDto }
  return mapProjectDto(payload.project)
}

export const updateProject = async (projectId: string, name: string): Promise<Project> => {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const payload = (await response.json()) as { project: ProjectDto }
  return mapProjectDto(payload.project)
}

export const deleteProject = async (projectId: string): Promise<void> => {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
}

export const createEpic = async (projectId: string, name: string): Promise<Epic> => {
  const response = await fetch('/api/epics', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId, name }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const payload = (await response.json()) as { epic: EpicDto }
  return mapEpicDto(payload.epic)
}

export const renameEpic = async (epicId: string, name: string): Promise<Epic> => {
  const response = await fetch(`/api/epics/${encodeURIComponent(epicId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const payload = (await response.json()) as { epic: EpicDto }
  return mapEpicDto(payload.epic)
}

export const deleteEpic = async (epicId: string): Promise<void> => {
  const response = await fetch(`/api/epics/${encodeURIComponent(epicId)}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
}

export const createChat = async (epicId: string, title: string): Promise<EpicChat> => {
  const response = await fetch('/api/chats', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ epicId, title }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const payload = (await response.json()) as { chat: ChatDto }
  return mapChatDto(payload.chat)
}

export const renameChat = async (chatId: string, title: string): Promise<EpicChat> => {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const payload = (await response.json()) as { chat: ChatDto }
  return mapChatDto(payload.chat)
}

export const deleteChat = async (chatId: string): Promise<void> => {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
}

export const sendChatMessage = async (chatId: string, message: string, mode: ChatMode) => {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      mode,
      role: mode,
    }),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  return (await response.json()) as SendMessageResponseDto
}

export const fetchChatMessages = async (
  chatId: string,
): Promise<{
  mode: ChatMode
  isModeLocked: boolean
  messages: ChatMessage[]
}> => {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}/messages`)
  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const payload = (await response.json()) as ChatMessagesResponseDto
  return {
    mode: payload.mode,
    isModeLocked: payload.isModeLocked,
    messages: payload.messages.map((message) => ({
      id: message.id,
      role: message.role,
      text: message.text,
    })),
  }
}
