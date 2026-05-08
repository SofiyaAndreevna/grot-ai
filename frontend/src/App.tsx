import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
}

type ChatTopic = {
  id: string
  folder: string
  title: string
}

const topics: ChatTopic[] = [
  { id: 'frontend-ideas', folder: 'Проект', title: 'Идеи по frontend' },
  { id: 'backend-api', folder: 'Проект', title: 'Вопросы по backend API' },
  { id: 'interview-prep', folder: 'Личное', title: 'Подготовка к интервью' },
]

function App() {
  const [activeTopicId, setActiveTopicId] = useState(topics[0].id)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: 'Привет! Выбери тему слева и задай вопрос, я отправлю его на backend.',
    },
  ])
  const [isLoading, setIsLoading] = useState(false)

  const activeTopic = topics.find((topic) => topic.id === activeTopicId) ?? topics[0]

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

    setMessages((prev) => [...prev, userMessage])
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
          topic: activeTopic.title,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response from server')
      }

      const data = (await response.json()) as { reply?: string }
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.reply ?? 'Сервер вернул пустой ответ',
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Не удалось связаться с backend. Проверь, запущен ли сервер.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Папки</h1>
        </div>
        <div className="folder-block">
          <p className="folder-name">Проект</p>
          {topics
            .filter((topic) => topic.folder === 'Проект')
            .map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => setActiveTopicId(topic.id)}
                className={`chat-link ${activeTopicId === topic.id ? 'active' : ''}`}
              >
                {topic.title}
              </button>
            ))}
        </div>
        <div className="folder-block">
          <p className="folder-name">Личное</p>
          {topics
            .filter((topic) => topic.folder === 'Личное')
            .map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => setActiveTopicId(topic.id)}
                className={`chat-link ${activeTopicId === topic.id ? 'active' : ''}`}
              >
                {topic.title}
              </button>
            ))}
        </div>
      </aside>

      <section className="chat-area">
        <header className="chat-header">
          <h2>{activeTopic.title}</h2>
        </header>

        <div className="messages">
          {messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              {message.text}
            </div>
          ))}
          {isLoading && <div className="message assistant">Печатает...</div>}
        </div>

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Введите вопрос по выбранной теме..."
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
