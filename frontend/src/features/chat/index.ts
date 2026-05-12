export { ChatArea } from './components/ChatArea'
export { fetchEpics, createEpic, renameEpic, deleteEpic } from './api'
export {
  seedProjects,
  defaultProjectId,
  fallbackAssistantMessage,
  buildInitialMessagesByChat,
  buildChatKey,
} from './constants'
export { useChatState } from './hooks/useChatState'
export type { ChatMessage, ChatMode, Epic, EpicChat, Project } from './types'
