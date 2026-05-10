import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  sources?: string[]
}

type EpicChat = {
  id: string
  title: string
}

type Epic = {
  id: string
  title: string
  chats: EpicChat[]
}

type ChatMode = 'analyst' | 'developer'

const projectSections = ['Обзор проекта', 'Контекст проекта', 'Настройки']

const epics: Epic[] = [
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

const defaultAssistantMessage: ChatMessage = {
  id: crypto.randomUUID(),
  role: 'assistant',
  text: 'Выберите чат внутри эпика и задайте вопрос по проекту.',
}

const allChatIds = epics.flatMap((epic) => epic.chats.map((chat) => chat.id))

const buildInitialMessagesByChat = () =>
  Object.fromEntries(allChatIds.map((chatId) => [chatId, [defaultAssistantMessage]]))

function App() {
  const [activeProjectSection, setActiveProjectSection] = useState(projectSections[1])
  const [activeEpicId, setActiveEpicId] = useState(epics[0].id)
  const [activeChatId, setActiveChatId] = useState(epics[0].chats[0].id)
  const [chatMode, setChatMode] = useState<ChatMode>('analyst')
  const [input, setInput] = useState('')
  const [messagesByChat, setMessagesByChat] =
    useState<Record<string, ChatMessage[]>>(buildInitialMessagesByChat)
  const [isLoading, setIsLoading] = useState(false)

  const activeEpic = epics.find((epic) => epic.id === activeEpicId) ?? epics[0]
  const activeChat = activeEpic.chats.find((chat) => chat.id === activeChatId) ?? activeEpic.chats[0]
  const activeChatMessages = messagesByChat[activeChat.id] ?? [defaultAssistantMessage]

  const selectEpicAndChat = (epic: Epic, chat?: EpicChat) => {
    setActiveEpicId(epic.id)
    setActiveChatId((chat ?? epic.chats[0]).id)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedInput = input.trim()
    if (!trimmedInput || isLoading) {
      return
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmedInput,
    }

    setMessagesByChat((prev) => ({
      ...prev,
      [activeChat.id]: [...(prev[activeChat.id] ?? []), userMessage],
    }))
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: trimmedInput,
          topic: activeChat.title,
          epic: activeEpic.title,
          mode: chatMode,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response from server')
      }

      const data = (await response.json()) as { reply?: string; sources?: string[] }
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.reply ?? 'Сервер вернул пустой ответ',
        sources: data.sources,
      }

      setMessagesByChat((prev) => ({
        ...prev,
        [activeChat.id]: [...(prev[activeChat.id] ?? []), assistantMessage],
      }))
    } catch (error) {
      setMessagesByChat((prev) => ({
        ...prev,
        [activeChat.id]: [
          ...(prev[activeChat.id] ?? []),
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: 'Не удалось связаться с backend. Проверь, запущен ли сервер.',
          },
        ],
      }))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="layout">
      <aside className="sidebar">
        <div className="workspace-brand">
          <h1>SystemLens</h1>
        </div>

        <div className="project-nav">
          {projectSections.map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => setActiveProjectSection(section)}
              className={`project-link ${activeProjectSection === section ? 'active' : ''}`}
            >
              {section}
            </button>
          ))}
        </div>

        <div className="epics-area">
          <p className="section-label">Эпики</p>
          {epics.map((epic) => (
            <div key={epic.id} className="epic-block">
              <button
                type="button"
                onClick={() => selectEpicAndChat(epic)}
                className={`epic-title ${activeEpicId === epic.id ? 'active' : ''}`}
              >
                <span className="chevron">▾</span> {epic.title}
              </button>

              <div className="epic-chats">
                {epic.chats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => selectEpicAndChat(epic, chat)}
                    className={`chat-link ${activeChatId === chat.id ? 'active' : ''}`}
                  >
                    • {chat.title}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button type="button" className="add-action">
            + Новый эпик
          </button>
          <button type="button" className="add-action">
            + Новый чат
          </button>
        </div>
      </aside>

      <section className="chat-area">
        <header className="chat-header">
          <p className="chat-meta">Эпик: {activeEpic.title}</p>
          <h2 className="chat-topic">Тема: {activeChat.title}</h2>
          <div className="mode-switch">
            <button
              type="button"
              className={`mode-button ${chatMode === 'analyst' ? 'active' : ''}`}
              onClick={() => setChatMode('analyst')}
            >
              Для аналитика
            </button>
            <button
              type="button"
              className={`mode-button ${chatMode === 'developer' ? 'active' : ''}`}
              onClick={() => setChatMode('developer')}
            >
              Для разработчика
            </button>
          </div>
        </header>

        <div className="messages">
          {activeChatMessages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              <p>{message.text}</p>
              {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                <div className="message-sources">
                  <span>Источники:</span>
                  <ul>
                    {message.sources.map((source) => (
                      <li key={source}>{source}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
          {isLoading && <div className="message assistant">Печатает...</div>}
        </div>

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={`Задайте вопрос в режиме "${chatMode === 'analyst' ? 'аналитик' : 'разработчик'}"...`}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()}>
            Отправить
          </button>
        </form>
      </section>
    </main>
  )
}

export default App
