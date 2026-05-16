import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { buildChatKey, buildInitialMessagesByChat, fallbackAssistantMessage } from '../constants'
import { fetchChatMessages, sendChatMessage } from '../api'
import type { ChatMessage, ChatMode } from '../types'

type UseChatStateParams = {
  activeProjectId: string
  activeChatId: string
}

type ChatSettings = {
  mode: ChatMode
  isModeLocked: boolean
}

const defaultChatSettings: ChatSettings = {
  mode: 'analyst',
  isModeLocked: false,
}

export const useChatState = ({
  activeProjectId,
  activeChatId,
}: UseChatStateParams) => {
  const [chatSettingsByChat, setChatSettingsByChat] = useState<Record<string, ChatSettings>>({})
  const [input, setInput] = useState('')
  const [messagesByChat, setMessagesByChat] =
    useState<Record<string, ChatMessage[]>>(buildInitialMessagesByChat)
  const [isLoading, setIsLoading] = useState(false)
  const [isMessagesLoading, setIsMessagesLoading] = useState(false)
  const activeChatKey = buildChatKey(activeProjectId, activeChatId)
  const activeChatSettings = chatSettingsByChat[activeChatKey] ?? defaultChatSettings
  const chatMode = activeChatSettings.mode
  const isChatModeLocked = activeChatSettings.isModeLocked

  const activeChatMessages = messagesByChat[activeChatKey] ?? [fallbackAssistantMessage]

  useEffect(() => {
    let isCancelled = false

    const loadChatMessages = async () => {
      if (!activeChatId) {
        return
      }

      setIsMessagesLoading(true)
      try {
        const payload = await fetchChatMessages(activeChatId)

        if (isCancelled) {
          return
        }

        setMessagesByChat((prev) => ({
          ...prev,
          [activeChatKey]: payload.messages.length > 0 ? payload.messages : [fallbackAssistantMessage],
        }))
        setChatSettingsByChat((prev) => ({
          ...prev,
          [activeChatKey]: {
            mode: payload.mode,
            isModeLocked: payload.isModeLocked,
          },
        }))
      } catch {
        if (isCancelled) {
          return
        }

        setMessagesByChat((prev) => ({
          ...prev,
          [activeChatKey]: prev[activeChatKey] ?? [fallbackAssistantMessage],
        }))
      } finally {
        if (!isCancelled) {
          setIsMessagesLoading(false)
        }
      }
    }

    loadChatMessages()

    return () => {
      isCancelled = true
    }
  }, [activeChatId, activeChatKey])

  const handleChatModeChange = (mode: ChatMode) => {
    if (isChatModeLocked) {
      return
    }

    setChatSettingsByChat((prev) => ({
      ...prev,
      [activeChatKey]: {
        mode,
        isModeLocked: false,
      },
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedInput = input.trim()
    if (!trimmedInput || isLoading || isMessagesLoading) {
      return
    }

    const targetChatKey = buildChatKey(activeProjectId, activeChatId)
    const targetChatId = activeChatId
    const targetChatSettings = chatSettingsByChat[targetChatKey] ?? defaultChatSettings

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
      const data = await sendChatMessage(targetChatId, trimmedInput, targetChatSettings.mode)
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
      setChatSettingsByChat((prev) => ({
        ...prev,
        [targetChatKey]: {
          mode: targetChatSettings.mode,
          isModeLocked: true,
        },
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
    isChatModeLocked,
    setChatMode: handleChatModeChange,
    input,
    setInput,
    isLoading,
    isMessagesLoading,
    activeChatMessages,
    handleSubmit,
  }
}
