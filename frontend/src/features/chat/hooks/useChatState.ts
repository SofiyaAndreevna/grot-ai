import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { buildChatKey, buildInitialMessagesByChat } from '../constants'
import { fetchChatMessages, sendChatMessage } from '../api'
import type { ChatMessage, ChatMode, ChatScenario } from '../types'

type UseChatStateParams = {
  activeProjectId: string
  activeChatId: string
}

type ChatSettings = {
  mode: ChatMode
  scenario: ChatScenario
  isModeLocked: boolean
  isModeConfirmed: boolean
}

const defaultChatSettings: ChatSettings = {
  mode: 'analyst',
  scenario: 'questions',
  isModeLocked: false,
  isModeConfirmed: false,
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
  const chatScenario = activeChatSettings.scenario
  const isChatModeLocked = activeChatSettings.isModeLocked
  const isChatModeConfirmed = activeChatSettings.isModeConfirmed

  const activeChatMessages = messagesByChat[activeChatKey] ?? []

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
          [activeChatKey]: payload.messages,
        }))
        setChatSettingsByChat((prev) => ({
          ...prev,
          [activeChatKey]: {
            mode: payload.mode,
            scenario: payload.scenario,
            isModeLocked: payload.isModeLocked,
            isModeConfirmed: payload.messages.length > 0,
          },
        }))
      } catch {
        if (isCancelled) {
          return
        }

        setMessagesByChat((prev) => ({
          ...prev,
          [activeChatKey]: prev[activeChatKey] ?? [],
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
        scenario: activeChatSettings.scenario,
        isModeLocked: false,
        isModeConfirmed: activeChatSettings.isModeConfirmed,
      },
    }))
  }

  const handleChatScenarioChange = (scenario: ChatScenario) => {
    if (isChatModeLocked) {
      return
    }

    setChatSettingsByChat((prev) => ({
      ...prev,
      [activeChatKey]: {
        mode: activeChatSettings.mode,
        scenario,
        isModeLocked: false,
        isModeConfirmed: activeChatSettings.isModeConfirmed,
      },
    }))
  }

  const confirmChatMode = () => {
    if (isChatModeLocked) {
      return
    }

    setChatSettingsByChat((prev) => ({
      ...prev,
      [activeChatKey]: {
        mode: activeChatSettings.mode,
        scenario: activeChatSettings.scenario,
        isModeLocked: false,
        isModeConfirmed: true,
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
    if (!targetChatSettings.isModeConfirmed) {
      return
    }

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
      const data = await sendChatMessage(
        targetChatId,
        trimmedInput,
        targetChatSettings.mode,
        targetChatSettings.scenario,
      )
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
          scenario: targetChatSettings.scenario,
          isModeLocked: true,
          isModeConfirmed: true,
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
    chatScenario,
    isChatModeLocked,
    isChatModeConfirmed,
    setChatMode: handleChatModeChange,
    setChatScenario: handleChatScenarioChange,
    confirmChatMode,
    input,
    setInput,
    isLoading,
    isMessagesLoading,
    activeChatMessages,
    handleSubmit,
  }
}
