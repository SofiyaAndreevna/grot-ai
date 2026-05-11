import { ChatArea, useChatState } from '@/features/chat'
import { ContextScreen, useProjectContext } from '@/features/context'
import type { ProjectSection } from '@/features/navigation'
import { isContextSection } from '@/features/navigation'

type AppContentProps = {
  activeProjectSection: ProjectSection
  activeEpicTitle: string
  activeChatId: string
  activeChatTitle: string
}

export const AppContent = ({
  activeProjectSection,
  activeEpicTitle,
  activeChatId,
  activeChatTitle,
}: AppContentProps) => {
  const { chatMode, setChatMode, input, setInput, isLoading, activeChatMessages, handleSubmit } =
    useChatState({
      activeChatId,
      activeChatTitle,
      activeEpicTitle,
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
        onFilesSelected={handleFilesSelected}
        onRemoveFile={removeContextFile}
        onSubmit={handleContextSubmit}
        onSwitchContextType={switchContextType}
        onResetEditor={clearContextEditor}
        onEditRecord={startEditingContextRecord}
      />
    )
  }

  return (
    <ChatArea
      activeEpicTitle={activeEpicTitle}
      activeChatTitle={activeChatTitle}
      chatMode={chatMode}
      onChatModeChange={setChatMode}
      messages={activeChatMessages}
      isLoading={isLoading}
      input={input}
      onInputChange={setInput}
      onSubmit={handleSubmit}
    />
  )
}
