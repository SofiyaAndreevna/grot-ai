import { useState } from 'react'

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

function App() {
  const [activeProjectSection, setActiveProjectSection] = useState<ProjectSection>(projectSections[1])
  const [activeEpicId, setActiveEpicId] = useState(epics[0].id)
  const [activeChatId, setActiveChatId] = useState(epics[0].chats[0].id)

  const activeEpic = epics.find((epic) => epic.id === activeEpicId) ?? epics[0]
  const activeChat = activeEpic.chats.find((chat) => chat.id === activeChatId) ?? activeEpic.chats[0]

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

  const selectEpicAndChat = (epic: Epic, chat?: EpicChat) => {
    setActiveEpicId(epic.id)
    setActiveChatId((chat ?? epic.chats[0]).id)
  }

  return (
    <main className="layout">
      <Sidebar
        projectSections={projectSections}
        activeProjectSection={activeProjectSection}
        onProjectSectionChange={setActiveProjectSection}
        epics={epics}
        activeEpicId={activeEpicId}
        activeChatId={activeChatId}
        onSelectEpicAndChat={selectEpicAndChat}
      />

      {activeProjectSection === 'Контекст проекта' ? (
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
