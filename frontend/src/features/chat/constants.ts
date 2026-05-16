import type { ChatMessage, Epic, Project } from './types'

const systemLensEpics: Epic[] = [
  {
    id: 'registration',
    title: 'Регистрация',
    chats: [
      { id: 'registration-flow', title: 'Как работает регистрация?' },
      { id: 'registration-email', title: 'Где проверяется email?' },
      { id: 'registration-captcha', title: 'Как устроена captcha?' },
    ],
  },
  {
    id: 'payments',
    title: 'Оплаты',
    chats: [
      { id: 'payments-create', title: 'Как создается платеж?' },
      { id: 'payments-callback', title: 'Как обрабатывается callback?' },
      { id: 'payments-status', title: 'Где меняется статус заказа?' },
    ],
  },
  {
    id: 'profile',
    title: 'Личный кабинет',
    chats: [
      { id: 'profile-load', title: 'Как загружается профиль?' },
      { id: 'profile-edit', title: 'Где редактируются данные пользователя?' },
    ],
  },
]

const mattEpics: Epic[] = [
  {
    id: 'razgovor',
    title: 'Разговор',
    chats: [{ id: 'govorim', title: 'Говорим' }],
  },
]

export const seedProjects: Project[] = [
  {
    id: 'systemlens',
    title: 'SystemLens',
    description: 'Базовый проект продукта SystemLens.',
    epics: systemLensEpics,
  },
  {
    id: 'matt',
    title: 'Matt',
    description: 'Сидовый проект для теста мультипроектности.',
    epics: mattEpics,
  },
]

export const defaultProjectId = seedProjects[0]?.id ?? 'systemlens'

export const fallbackAssistantMessage: ChatMessage = {
  id: 'default-assistant-message',
  role: 'assistant',
  text: 'Выберите чат внутри эпика и задайте вопрос по проекту.',
}

const buildChatStorageKey = (projectId: string, chatId: string) => `${projectId}:${chatId}`

const allChatKeys = seedProjects.flatMap((project) =>
  project.epics.flatMap((epic) => epic.chats.map((chat) => buildChatStorageKey(project.id, chat.id))),
)

export const buildInitialMessagesByChat = () =>
  Object.fromEntries(
    allChatKeys.map((chatKey) => [chatKey, []]),
  ) as Record<string, ChatMessage[]>

export const buildChatKey = (projectId: string, chatId: string) => `${projectId}:${chatId}`
