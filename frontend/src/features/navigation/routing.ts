import { epics } from '../chat/constants'
import type { ProjectSection } from './constants'

const overviewSection: ProjectSection = 'Обзор проекта'
const contextSection: ProjectSection = 'Контекст проекта'

const defaultEpic = epics[0]
const defaultChat = defaultEpic.chats[0]

export const defaultRouteState = {
  section: overviewSection,
  epicId: defaultEpic.id,
  chatId: defaultChat.id,
} as const

export type RouteState = {
  section: ProjectSection
  epicId: string
  chatId: string
}

export const buildChatPath = (epicId: string, chatId: string) => `/chat/${epicId}/${chatId}`
export const contextPath = '/context'
export const defaultChatPath = buildChatPath(defaultEpic.id, defaultChat.id)

export const isOverviewSection = (section: ProjectSection) => section === overviewSection
export const isContextSection = (section: ProjectSection) => section === contextSection

export const resolveRouteState = (pathname: string): RouteState => {
  const [resource, epicIdFromPath, chatIdFromPath] = pathname.split('/').filter(Boolean)

  if (resource === 'context') {
    return {
      section: contextSection,
      epicId: defaultEpic.id,
      chatId: defaultChat.id,
    }
  }

  if (resource === 'chat') {
    const epic = epics.find((candidateEpic) => candidateEpic.id === epicIdFromPath) ?? defaultEpic
    const chat = epic.chats.find((candidateChat) => candidateChat.id === chatIdFromPath) ?? epic.chats[0]

    return {
      section: overviewSection,
      epicId: epic.id,
      chatId: chat.id,
    }
  }

  return {
    section: overviewSection,
    epicId: defaultEpic.id,
    chatId: defaultChat.id,
  }
}
