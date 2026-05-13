export { ChatArea } from './components/ChatArea'
export {
  fetchEpics,
  createEpic,
  renameEpic,
  deleteEpic,
  createChat,
  renameChat,
  deleteChat,
  sendChatMessage,
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
} from './api'
export {
  seedProjects,
  defaultProjectId,
  fallbackAssistantMessage,
  buildInitialMessagesByChat,
  buildChatKey,
} from './constants'
export { useChatState } from './hooks/useChatState'
export type { ChatMessage, ChatMode, Epic, EpicChat, Project } from './types'
