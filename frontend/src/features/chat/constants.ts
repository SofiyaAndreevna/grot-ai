import type { ChatMessage, Epic } from './types'

export const epics: Epic[] = [
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

export const fallbackAssistantMessage: ChatMessage = {
  id: 'default-assistant-message',
  role: 'assistant',
  text: 'Выберите чат внутри эпика и задайте вопрос по проекту.',
}

const createInitialAssistantMessage = (): ChatMessage => ({
  id: crypto.randomUUID(),
  role: 'assistant',
  text: fallbackAssistantMessage.text,
})

const allChatIds = epics.flatMap((epic) => epic.chats.map((chat) => chat.id))

export const buildInitialMessagesByChat = () =>
  Object.fromEntries(
    allChatIds.map((chatId) => [chatId, [createInitialAssistantMessage()]]),
  ) as Record<string, ChatMessage[]>
