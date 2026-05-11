import { useState } from 'react'
import type { FormEvent } from 'react'

import { buildChatKey, buildInitialMessagesByChat, fallbackAssistantMessage } from '../constants'
import type { ChatMessage, ChatMode } from '../types'

type UseChatStateParams = {
  activeProjectId: string
  activeChatId: string
  activeChatTitle: string
  activeEpicTitle: string
}

export const useChatState = ({
  activeProjectId,
  activeChatId,
  activeChatTitle,
  activeEpicTitle,
}: UseChatStateParams) => {
  const [chatMode, setChatMode] = useState<ChatMode>('analyst')
  const [input, setInput] = useState('')
  const [messagesByChat, setMessagesByChat] =
    useState<Record<string, ChatMessage[]>>(buildInitialMessagesByChat)
  const [isLoading, setIsLoading] = useState(false)
  const activeChatKey = buildChatKey(activeProjectId, activeChatId)

  const activeChatMessages = messagesByChat[activeChatKey] ?? [fallbackAssistantMessage]

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedInput = input.trim()
    if (!trimmedInput || isLoading) {
      return
    }

    const targetChatKey = buildChatKey(activeProjectId, activeChatId)
    const targetChatTitle = activeChatTitle
    const targetEpicTitle = activeEpicTitle

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmedInput,
    }

    setMessagesByChat((prev) => ({
      ...prev,
      [targetChatKey]: [...(prev[targetChatKey] ?? []), userMessage],
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
          topic: targetChatTitle,
          epic: targetEpicTitle,
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
        [targetChatKey]: [...(prev[targetChatKey] ?? []), assistantMessage],
      }))
    } catch {
      setMessagesByChat((prev) => ({
        ...prev,
        [targetChatKey]: [
          ...(prev[targetChatKey] ?? []),
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

  return {
    chatMode,
    setChatMode,
    input,
    setInput,
    isLoading,
    activeChatMessages,
    handleSubmit,
  }
}
