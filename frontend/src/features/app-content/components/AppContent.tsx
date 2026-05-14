import { ChatArea, useChatState } from '@/features/chat'
import { ContextScreen, useProjectContext } from '@/features/context'
import type { ProjectSection } from '@/features/navigation'
import { isContextSection } from '@/features/navigation'

type AppContentProps = {
  activeProjectId: string
  activeProjectSection: ProjectSection
  activeEpicTitle: string
  activeChatId: string
  activeChatTitle: string
}

export const AppContent = ({
  activeProjectId,
  activeProjectSection,
  activeEpicTitle,
  activeChatId,
  activeChatTitle,
}: AppContentProps) => {
  const { chatMode, isChatModeLocked, setChatMode, input, setInput, isLoading, activeChatMessages, handleSubmit } =
    useChatState({
      activeProjectId,
      activeChatId,
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
    isContextSubmitting,
    contextSubmitError,
    isContextSourcesLoading,
    contextSourcesLoadError,
    clearContextEditor,
    startEditingContextRecord,
    deleteContextRecord,
    handleFilesSelected,
    removeContextFile,
    handleContextSubmit,
    switchContextType,
  } = useProjectContext({ projectId: activeProjectId })

  if (isContextSection(activeProjectSection)) {
    return (
      <ContextScreen
        activeContextType={activeContextType}
        activeTypeRecords={activeTypeRecords}
        editingContextId={editingContextId}
        contextTitle={contextTitle}
        onContextTitleChange={setContextTitle}
        contextContent={contextContent}
        onContextContentChange={setContextContent}
        contextFiles={contextFiles}
        isSubmitting={isContextSubmitting}
        submitError={contextSubmitError}
        isContextSourcesLoading={isContextSourcesLoading}
        contextSourcesLoadError={contextSourcesLoadError}
        onFilesSelected={handleFilesSelected}
        onRemoveFile={removeContextFile}
        onSubmit={handleContextSubmit}
        onSwitchContextType={switchContextType}
        onResetEditor={clearContextEditor}
        onEditRecord={startEditingContextRecord}
        onDeleteRecord={deleteContextRecord}
      />
    )
  }

  if (!activeEpicTitle || !activeChatId || !activeChatTitle) {
    return (
      <section className="chat-area empty-state">
        <header className="chat-header">
          <p className="chat-meta">Эпики</p>
          <h2 className="chat-topic">Создайте первый эпик в сайдбаре</h2>
        </header>
      </section>
    )
  }

  return (
    <ChatArea
      activeEpicTitle={activeEpicTitle}
      activeChatTitle={activeChatTitle}
      chatMode={chatMode}
      isChatModeLocked={isChatModeLocked}
      onChatModeChange={setChatMode}
      messages={activeChatMessages}
      isLoading={isLoading}
      input={input}
      onInputChange={setInput}
      onSubmit={handleSubmit}
    />
  )
}
