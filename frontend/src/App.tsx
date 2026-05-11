import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import './App.css'
import { epics } from './features/chat/constants'
import { ChatArea } from './features/chat/components/ChatArea'
import { useChatState } from './features/chat/hooks/useChatState'
import type { Epic, EpicChat } from './features/chat/types'
import { ContextScreen } from './features/context/components/ContextScreen'
import { useProjectContext } from './features/context/hooks/useProjectContext'
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
  const [lastChatPath, setLastChatPath] = useState(defaultChatPath)
  const routeState = useMemo(() => resolveRouteState(location.pathname), [location.pathname])

  const activeProjectSection = routeState.section
  const activeEpic = epics.find((epic) => epic.id === routeState.epicId) ?? epics[0]
  const activeChat = activeEpic.chats.find((chat) => chat.id === routeState.chatId) ?? activeEpic.chats[0]

  const { chatMode, setChatMode, input, setInput, isLoading, activeChatMessages, handleSubmit } =
    useChatState({
      activeChatId: activeChat.id,
      activeChatTitle: activeChat.title,
      activeEpicTitle: activeEpic.title,
    })

  const {
    activeContextType,
    activeTypeRecords,
    editingContextId,
    contextTitle,
    setContextTitle,
    contextContent,
    setContextContent,
    contextFiles,
    clearContextEditor,
    startEditingContextRecord,
    handleFilesSelected,
    removeContextFile,
    handleContextSubmit,
    switchContextType,
  } = useProjectContext()

  useEffect(() => {
    if (isOverviewSection(activeProjectSection)) {
      const path = buildChatPath(activeEpic.id, activeChat.id)
      setLastChatPath(path)

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

    navigate(lastChatPath)
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

      {isContextSection(activeProjectSection) ? (
        <ContextScreen
          activeContextType={activeContextType}
          activeTypeRecords={activeTypeRecords}
          editingContextId={editingContextId}
          contextTitle={contextTitle}
          onContextTitleChange={setContextTitle}
          contextContent={contextContent}
          onContextContentChange={setContextContent}
          contextFiles={contextFiles}
          onFilesSelected={handleFilesSelected}
          onRemoveFile={removeContextFile}
          onSubmit={handleContextSubmit}
          onSwitchContextType={switchContextType}
          onResetEditor={clearContextEditor}
          onEditRecord={startEditingContextRecord}
        />
      ) : (
        <ChatArea
          activeEpicTitle={activeEpic.title}
          activeChatTitle={activeChat.title}
          chatMode={chatMode}
          onChatModeChange={setChatMode}
          messages={activeChatMessages}
          isLoading={isLoading}
          input={input}
          onInputChange={setInput}
          onSubmit={handleSubmit}
        />
      )}
    </main>
  )
}

export default App
