import type { Project } from '@/features/chat'
import type { ProjectSection } from './constants'

const overviewSection: ProjectSection = 'Обзор проекта'
const contextSection: ProjectSection = 'Контекст проекта'

export type RouteState = {
  projectId: string
  section: ProjectSection
  epicId: string
  chatId: string
}

type ResolvedProjectData = {
  project: Project
  epicId: string
  chatId: string
}

const resolveDefaultProjectData = (projects: Project[]): ResolvedProjectData => {
  const project = projects[0]
  const epic = project.epics[0]
  const chat = epic?.chats[0]

  return {
    project,
    epicId: epic?.id ?? '',
    chatId: chat?.id ?? '',
  }
}

const resolveProjectDataById = (projects: Project[], projectIdFromPath?: string): ResolvedProjectData => {
  const fallback = resolveDefaultProjectData(projects)
  const project = projects.find((candidateProject) => candidateProject.id === projectIdFromPath) ?? fallback.project
  const epic = project.epics[0]
  const chat = epic?.chats[0]

  return {
    project,
    epicId: epic?.id ?? '',
    chatId: chat?.id ?? '',
  }
}

export const buildChatPath = (projectId: string, epicId: string, chatId: string) =>
  `/${projectId}/chat/${epicId}/${chatId}`
export const buildContextPath = (projectId: string) => `/${projectId}/context`
export const buildDefaultChatPath = (projects: Project[]) => {
  const { project, epicId, chatId } = resolveDefaultProjectData(projects)
  if (!epicId || !chatId) {
    return buildContextPath(project.id)
  }
  return buildChatPath(project.id, epicId, chatId)
}

export const isOverviewSection = (section: ProjectSection) => section === overviewSection
export const isContextSection = (section: ProjectSection) => section === contextSection

export const resolveRouteState = (pathname: string, projects: Project[]): RouteState => {
  if (projects.length === 0) {
    throw new Error('At least one project is required for route resolving')
  }

  const [projectIdFromPath, resource, epicIdFromPath, chatIdFromPath] = pathname.split('/').filter(Boolean)
  const fallback = resolveProjectDataById(projects, projectIdFromPath)

  if (resource === 'context') {
    return {
      section: contextSection,
      projectId: fallback.project.id,
      epicId: fallback.epicId,
      chatId: fallback.chatId,
    }
  }

  if (resource === 'chat') {
    const epic = fallback.project.epics.find((candidateEpic) => candidateEpic.id === epicIdFromPath) ?? fallback.project.epics[0]
    const chat = epic?.chats.find((candidateChat) => candidateChat.id === chatIdFromPath) ?? epic?.chats[0]

    return {
      section: overviewSection,
      projectId: fallback.project.id,
      epicId: epic?.id ?? '',
      chatId: chat?.id ?? '',
    }
  }

  return {
    section: overviewSection,
    projectId: fallback.project.id,
    epicId: fallback.epicId,
    chatId: fallback.chatId,
  }
}
