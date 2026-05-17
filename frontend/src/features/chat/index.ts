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
  fetchChatMessages,
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
export type { ChatMessage, ChatMode, ChatScenario, Epic, EpicChat, Project } from './types'
