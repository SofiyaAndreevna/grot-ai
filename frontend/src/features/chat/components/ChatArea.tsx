import { useEffect, useRef, type FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { ChatMessage, ChatMode } from '../types'

type ChatAreaProps = {
  activeEpicTitle: string
  activeChatTitle: string
  chatMode: ChatMode
  isChatModeLocked: boolean
  onChatModeChange: (mode: ChatMode) => void
  messages: ChatMessage[]
  isMessagesLoading: boolean
  isLoading: boolean
  input: string
  onInputChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export const ChatArea = ({
  activeEpicTitle,
  activeChatTitle,
  chatMode,
  isChatModeLocked,
  onChatModeChange,
  messages,
  isMessagesLoading,
  isLoading,
  input,
  onInputChange,
  onSubmit,
}: ChatAreaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.style.height = 'auto'
    const nextHeight = Math.min(textarea.scrollHeight, 210)
    textarea.style.height = `${nextHeight}px`
    textarea.style.overflowY = textarea.scrollHeight > 210 ? 'auto' : 'hidden'
  }, [input])

  return (
    <section className="chat-area">
      <header className="chat-header">
        <p className="chat-meta">Эпик: {activeEpicTitle}</p>
        <h2 className="chat-topic">Тема: {activeChatTitle}</h2>
        <div className="mode-switch">
          <button
            type="button"
            className={`mode-button ${chatMode === 'analyst' ? 'active' : ''}`}
            onClick={() => onChatModeChange('analyst')}
            disabled={isChatModeLocked}
          >
            Для аналитика
          </button>
          <button
            type="button"
            className={`mode-button ${chatMode === 'developer' ? 'active' : ''}`}
            onClick={() => onChatModeChange('developer')}
            disabled={isChatModeLocked}
          >
            Для разработчика
          </button>
        </div>
      </header>

      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            {message.role === 'assistant' ? (
              <div className="message-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
              </div>
            ) : (
              <p>{message.text}</p>
            )}
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
        {isMessagesLoading && <div className="message assistant">Загружаю историю чата...</div>}
        {isLoading && <div className="message assistant">Печатает...</div>}
      </div>

      <form className="chat-form" onSubmit={onSubmit}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={`Задайте вопрос в режиме "${chatMode === 'analyst' ? 'аналитик' : 'разработчик'}"...`}
          disabled={isLoading || isMessagesLoading}
          rows={1}
        />
        <button type="submit" disabled={isLoading || isMessagesLoading || !input.trim()}>
          Отправить
        </button>
      </form>
    </section>
  )
}
