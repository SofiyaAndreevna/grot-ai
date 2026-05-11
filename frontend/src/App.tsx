import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import './App.css'
import { AppContent } from './features/app-content/components/AppContent'
import { epics } from './features/chat/constants'
import type { Epic, EpicChat } from './features/chat/types'
import { Sidebar } from './features/navigation/components/Sidebar'
import { projectSections } from './features/navigation/constants'
import type { ProjectSection } from './features/navigation/constants'
import {
  buildChatPath,
  contextPath,
  defaultChatPath,
  isContextSection,
  isOverviewSection,
  resolveRouteState,
} from './features/navigation/routing'

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const lastChatPathRef = useRef(defaultChatPath)
  const routeState = useMemo(() => resolveRouteState(location.pathname), [location.pathname])

  const activeProjectSection = routeState.section
  const activeEpic = epics.find((epic) => epic.id === routeState.epicId) ?? epics[0]
  const activeChat = activeEpic.chats.find((chat) => chat.id === routeState.chatId) ?? activeEpic.chats[0]

  useEffect(() => {
    if (isOverviewSection(activeProjectSection)) {
      const path = buildChatPath(activeEpic.id, activeChat.id)
      lastChatPathRef.current = path

      if (location.pathname !== path) {
        navigate(path, { replace: true })
      }
    }
  }, [activeChat.id, activeEpic.id, activeProjectSection, location.pathname, navigate])

  useEffect(() => {
    if (isContextSection(activeProjectSection) && location.pathname !== contextPath) {
      navigate(contextPath, { replace: true })
    }
  }, [activeProjectSection, location.pathname, navigate])

  const handleProjectSectionChange = (section: ProjectSection) => {
    if (isContextSection(section)) {
      navigate(contextPath)
      return
    }

    navigate(lastChatPathRef.current)
  }

  const selectEpicAndChat = (epic: Epic, chat?: EpicChat) => {
    const nextChat = chat ?? epic.chats[0]
    navigate(buildChatPath(epic.id, nextChat.id))
  }

  return (
    <main className="layout">
      <Sidebar
        projectSections={projectSections}
        activeProjectSection={activeProjectSection}
        onProjectSectionChange={handleProjectSectionChange}
        epics={epics}
        activeEpicId={activeEpic.id}
        activeChatId={activeChat.id}
        onSelectEpicAndChat={selectEpicAndChat}
      />

      <AppContent
        activeProjectSection={activeProjectSection}
        activeEpicTitle={activeEpic.title}
        activeChatId={activeChat.id}
        activeChatTitle={activeChat.title}
      />
    </main>
  )
}

export default App
