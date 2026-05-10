import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
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
const contextTypes = [
  'Описание',
  'GitHub',
  'Файлы',
  'Ссылки',
  'Jira',
  'Confluence',
  'Figma',
  'Базы данных',
  'Инструкции ИИ',
] as const

type ContextType = (typeof contextTypes)[number]

type ContextRecord = {
  id: string
  title: string
  content: string
  updatedAt: string
  files?: UploadedContextFile[]
}

type UploadedContextFile = {
  id: string
  name: string
  size: number
  type: string
}

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

const contextTitleByType: Record<ContextType, string> = {
  Описание: 'Описание проекта',
  GitHub: 'Репозитории и доступы',
  Файлы: 'Критичные файлы',
  Ссылки: 'Полезные ссылки',
  Jira: 'Процессы в Jira',
  Confluence: 'Страницы Confluence',
  Figma: 'Дизайн и макеты',
  'Базы данных': 'Доступ к базам данных',
  'Инструкции ИИ': 'Промпты и инструкции',
}

const contextPlaceholderByType: Record<ContextType, string> = {
  Описание: 'Опишите назначение проекта, ключевые сценарии, ограничения.',
  GitHub: 'Укажите URL репозиториев, ветки, правила PR и релизов.',
  Файлы: 'Добавьте пути к важным файлам и что в них искать.',
  Ссылки: 'Добавьте внешние ссылки и краткий контекст по ним.',
  Jira: 'Опишите доски, статусы, правила работы с тикетами.',
  Confluence: 'Укажите ключевые страницы и зачем они нужны.',
  Figma: 'Добавьте ссылки на файлы/фреймы и системные компоненты.',
  'Базы данных': 'Добавьте хосты, схемы, read-only инструкции по доступу.',
  'Инструкции ИИ': 'Сохраните рабочие промпты, ограничения и формат ответов.',
}

const buildInitialContextByType = (): Record<ContextType, ContextRecord[]> => ({
  Описание: [
    {
      id: crypto.randomUUID(),
      title: 'Что делает продукт',
      content:
        'SystemLens помогает команде быстро находить знания о проекте и формировать ответы для аналитиков и разработчиков.',
      updatedAt: 'Сегодня',
    },
  ],
  GitHub: [],
  Файлы: [],
  Ссылки: [],
  Jira: [],
  Confluence: [],
  Figma: [],
  'Базы данных': [],
  'Инструкции ИИ': [],
})

function App() {
  const [activeProjectSection, setActiveProjectSection] = useState(projectSections[1])
  const [activeEpicId, setActiveEpicId] = useState(epics[0].id)
  const [activeChatId, setActiveChatId] = useState(epics[0].chats[0].id)
  const [chatMode, setChatMode] = useState<ChatMode>('analyst')
  const [input, setInput] = useState('')
  const [messagesByChat, setMessagesByChat] =
    useState<Record<string, ChatMessage[]>>(buildInitialMessagesByChat)
  const [isLoading, setIsLoading] = useState(false)
  const [activeContextType, setActiveContextType] = useState<ContextType>(contextTypes[0])
  const [contextByType, setContextByType] =
    useState<Record<ContextType, ContextRecord[]>>(buildInitialContextByType)
  const [editingContextId, setEditingContextId] = useState<string | null>(null)
  const [contextTitle, setContextTitle] = useState('')
  const [contextContent, setContextContent] = useState('')
  const [contextFiles, setContextFiles] = useState<UploadedContextFile[]>([])

  const activeEpic = epics.find((epic) => epic.id === activeEpicId) ?? epics[0]
  const activeChat = activeEpic.chats.find((chat) => chat.id === activeChatId) ?? activeEpic.chats[0]
  const activeChatMessages = messagesByChat[activeChat.id] ?? [defaultAssistantMessage]
  const activeTypeRecords = contextByType[activeContextType] ?? []

  const selectEpicAndChat = (epic: Epic, chat?: EpicChat) => {
    setActiveEpicId(epic.id)
    setActiveChatId((chat ?? epic.chats[0]).id)
  }

  const clearContextEditor = () => {
    setEditingContextId(null)
    setContextTitle('')
    setContextContent('')
    setContextFiles([])
  }

  const startEditingContextRecord = (record: ContextRecord) => {
    setEditingContextId(record.id)
    setContextTitle(record.title)
    setContextContent(record.content)
    setContextFiles(record.files ?? [])
  }

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(event.target.files ?? []).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      size: file.size,
      type: file.type,
    }))

    setContextFiles((prev) => {
      const prevById = new Map(prev.map((file) => [file.id, file]))
      for (const file of uploadedFiles) {
        prevById.set(file.id, file)
      }
      return Array.from(prevById.values())
    })

    event.target.value = ''
  }

  const removeContextFile = (fileId: string) => {
    setContextFiles((prev) => prev.filter((file) => file.id !== fileId))
  }

  const handleContextSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedTitle = contextTitle.trim()
    const trimmedContent = contextContent.trim()
    const isFilesType = activeContextType === 'Файлы'

    if (!trimmedTitle) {
      return
    }

    if (!isFilesType && !trimmedContent) {
      return
    }

    if (isFilesType && contextFiles.length === 0) {
      return
    }

    const updatedAt = new Date().toLocaleDateString('ru-RU')

    setContextByType((prev) => {
      const records = prev[activeContextType] ?? []
      const nextRecords = editingContextId
        ? records.map((record) =>
            record.id === editingContextId
              ? {
                  ...record,
                  title: trimmedTitle,
                  content: trimmedContent,
                  updatedAt,
                  files: isFilesType ? contextFiles : undefined,
                }
              : record,
          )
        : [
            {
              id: crypto.randomUUID(),
              title: trimmedTitle,
              content: trimmedContent,
              updatedAt,
              files: isFilesType ? contextFiles : undefined,
            },
            ...records,
          ]

      return {
        ...prev,
        [activeContextType]: nextRecords,
      }
    })

    clearContextEditor()
  }

  const switchContextType = (type: ContextType) => {
    setActiveContextType(type)
    clearContextEditor()
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

        {activeProjectSection === 'Обзор проекта' && (
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
        )}
      </aside>

      {activeProjectSection === 'Контекст проекта' ? (
        <section className="context-screen">
          <header className="context-header">
            <p className="chat-meta">Контекст проекта</p>
            <h2 className="chat-topic">Управление знаниями по проекту</h2>
            <p className="context-subtitle">
              Добавляйте и редактируйте данные, которые будут использоваться в анализе и ответах ИИ.
            </p>
          </header>

          <div className="context-body">
            <nav className="context-type-nav">
              {contextTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`context-type-button ${activeContextType === type ? 'active' : ''}`}
                  onClick={() => switchContextType(type)}
                >
                  {type}
                </button>
              ))}
            </nav>

            <div className="context-content-grid">
              <section className="context-records">
                <div className="context-panel-head">
                  <h3>{activeContextType}</h3>
                  <button type="button" onClick={clearContextEditor} className="add-action compact">
                    + Добавить запись
                  </button>
                </div>

                {activeTypeRecords.length === 0 ? (
                  <p className="context-empty">Записей пока нет. Добавьте первую запись справа.</p>
                ) : (
                  <div className="context-record-list">
                    {activeTypeRecords.map((record) => (
                      <button
                        key={record.id}
                        type="button"
                        className={`context-record-card ${editingContextId === record.id ? 'active' : ''}`}
                        onClick={() => startEditingContextRecord(record)}
                      >
                        <span className="context-record-title">{record.title}</span>
                        <span className="context-record-date">Обновлено: {record.updatedAt}</span>
                        <span className="context-record-preview">
                          {activeContextType === 'Файлы'
                            ? (record.files ?? []).map((file) => file.name).join(', ') || 'Файлы не выбраны'
                            : record.content}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="context-editor">
                <h3>{editingContextId ? 'Редактирование записи' : 'Новая запись'}</h3>
                <p>{contextTitleByType[activeContextType]}</p>
                <form onSubmit={handleContextSubmit}>
                  <label>
                    Заголовок
                    <input
                      value={contextTitle}
                      onChange={(event) => setContextTitle(event.target.value)}
                      placeholder="Например: Основной репозиторий"
                    />
                  </label>

                  <label>
                    {activeContextType === 'Файлы' ? 'Загрузка файлов' : 'Контекст'}
                    {activeContextType === 'Файлы' ? (
                      <div className="context-file-upload">
                        <input type="file" multiple onChange={handleFilesSelected} />
                        {contextFiles.length > 0 ? (
                          <ul className="context-file-list">
                            {contextFiles.map((file) => (
                              <li key={file.id}>
                                <span>{file.name}</span>
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => removeContextFile(file.id)}
                                >
                                  Удалить
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="context-file-empty">Пока не загружено ни одного файла.</p>
                        )}
                      </div>
                    ) : (
                      <textarea
                        value={contextContent}
                        onChange={(event) => setContextContent(event.target.value)}
                        placeholder={contextPlaceholderByType[activeContextType]}
                        rows={8}
                      />
                    )}
                  </label>

                  <div className="context-editor-actions">
                    <button type="button" className="ghost-button" onClick={clearContextEditor}>
                      Очистить
                    </button>
                    <button
                      type="submit"
                      disabled={
                        !contextTitle.trim() ||
                        (activeContextType === 'Файлы'
                          ? contextFiles.length === 0
                          : !contextContent.trim())
                      }
                    >
                      {editingContextId ? 'Сохранить изменения' : 'Добавить запись'}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </div>
        </section>
      ) : (
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
      )}
    </main>
  )
}

export default App
