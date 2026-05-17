import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { contextPlaceholderByType, contextTitleByType } from '../constants'
import { contextTypes } from '../types'
import type { ContextRecord, ContextType, UploadedContextFile } from '../types'

type ContextScreenProps = {
  activeContextType: ContextType
  activeTypeRecords: ContextRecord[]
  editingContextId: string | null
  projectTitle: string
  onProjectRename: (nextProjectTitle: string) => Promise<void>
  contextTitle: string
  onContextTitleChange: (value: string) => void
  contextContent: string
  onContextContentChange: (value: string) => void
  contextFiles: UploadedContextFile[]
  isSubmitting: boolean
  submitError: string | null
  isContextSourcesLoading: boolean
  contextSourcesLoadError: string | null
  onFilesSelected: (event: ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (fileId: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onSwitchContextType: (type: ContextType) => void
  onResetEditor: () => void
  onEditRecord: (record: ContextRecord) => void
  onDeleteRecord: (record: ContextRecord) => void
}

export const ContextScreen = ({
  activeContextType,
  activeTypeRecords,
  editingContextId,
  projectTitle,
  onProjectRename,
  contextTitle,
  onContextTitleChange,
  contextContent,
  onContextContentChange,
  contextFiles,
  isSubmitting,
  submitError,
  isContextSourcesLoading,
  contextSourcesLoadError,
  onFilesSelected,
  onRemoveFile,
  onSubmit,
  onSwitchContextType,
  onResetEditor,
  onEditRecord,
  onDeleteRecord,
}: ContextScreenProps) => {
  const isFilesType = activeContextType === ('Файлы' as unknown as ContextType)
  const isDescriptionType = activeContextType === 'Описание'
  const [projectName, setProjectName] = useState(projectTitle)
  const [isProjectTitleEditing, setIsProjectTitleEditing] = useState(false)
  const [isProjectRenaming, setIsProjectRenaming] = useState(false)
  const [projectRenameError, setProjectRenameError] = useState<string | null>(null)
  const [isEditorVisible, setIsEditorVisible] = useState(false)
  const isProjectNameChanged = projectName.trim() !== projectTitle.trim()

  useEffect(() => {
    if (editingContextId) {
      setIsEditorVisible(true)
    }
  }, [editingContextId])

  const startProjectTitleEditing = () => {
    setProjectName(projectTitle)
    setProjectRenameError(null)
    setIsProjectTitleEditing(true)
  }

  const cancelProjectTitleEditing = () => {
    setProjectName(projectTitle)
    setProjectRenameError(null)
    setIsProjectTitleEditing(false)
  }

  const handleProjectRenameSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isProjectRenaming) {
      return
    }

    const trimmedProjectName = projectName.trim()
    if (!trimmedProjectName || !isProjectNameChanged) {
      setIsProjectTitleEditing(false)
      return
    }

    setProjectRenameError(null)
    setIsProjectRenaming(true)

    try {
      await onProjectRename(trimmedProjectName)
      setProjectName(trimmedProjectName)
      setIsProjectTitleEditing(false)
    } catch (error) {
      setProjectRenameError(
        error instanceof Error ? error.message : 'Не удалось обновить название проекта.',
      )
    } finally {
      setIsProjectRenaming(false)
    }
  }

  const handleCreateRecordClick = () => {
    onResetEditor()
    setIsEditorVisible(true)
  }

  const handleEditRecordClick = (record: ContextRecord) => {
    onEditRecord(record)
    setIsEditorVisible(true)
  }

  const handleCloseEditorClick = () => {
    onResetEditor()
    setIsEditorVisible(false)
  }

  return (
    <section className="context-screen">
      <header className="context-header">
        <p className="chat-meta">Контекст проекта</p>
        <h2 className="chat-topic">Управление знаниями по проекту</h2>
        <p className="context-subtitle">
          Добавляйте и редактируйте данные, которые будут использоваться в анализе и ответах ИИ.
        </p>
      </header>

      <div className="context-body">
        <nav className="context-type-nav">
          {contextTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={`context-type-button ${activeContextType === type ? 'active' : ''}`}
              onClick={() => onSwitchContextType(type)}
            >
              {type}
            </button>
          ))}
        </nav>

        <div className={`context-content-grid ${isEditorVisible ? 'with-editor' : ''}`}>
          <section className="context-records">
            <div className="context-panel-head">
              <h3>{activeContextType}</h3>
              <button type="button" onClick={handleCreateRecordClick} className="add-action compact">
                + Добавить запись
              </button>
            </div>

            {isDescriptionType ? (
              <div className="context-project-title-form">
                <div className="context-project-title-view">
                  <p className="context-project-title-label">Название проекта</p>
                  {!isProjectTitleEditing ? (
                    <div className="context-project-title-row">
                      <span className="context-project-title-value">{projectTitle}</span>
                      <button
                        type="button"
                        className="context-project-title-edit-button"
                        aria-label="Редактировать название проекта"
                        onClick={startProjectTitleEditing}
                        disabled={isProjectRenaming}
                      >
                        ✎
                      </button>
                    </div>
                  ) : null}
                </div>

                {isProjectTitleEditing ? (
                  <form onSubmit={handleProjectRenameSubmit}>
                    <input
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      placeholder="Введите название проекта"
                      disabled={isProjectRenaming}
                    />
                    <div className="context-project-title-actions">
                      <button
                        type="submit"
                        disabled={isProjectRenaming || !projectName.trim() || !isProjectNameChanged}
                      >
                        {isProjectRenaming ? 'Сохраняем...' : 'Сохранить название'}
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={cancelProjectTitleEditing}
                        disabled={isProjectRenaming}
                      >
                        Отмена
                      </button>
                    </div>
                    {projectRenameError ? <p className="context-empty">{projectRenameError}</p> : null}
                  </form>
                ) : null}
              </div>
            ) : null}

            {activeTypeRecords.length === 0 ? (
              <p className="context-empty">
                {isContextSourcesLoading && activeContextType === 'GitHub'
                  ? 'Загружаем GitHub-источники...'
                  : 'Записей пока нет. Нажмите "+ Добавить запись", чтобы создать первую.'}
              </p>
            ) : (
              <div className="context-record-list">
                {activeTypeRecords.map((record) => (
                  <div key={record.id} className="context-record-item">
                    <button
                      type="button"
                      className={`context-record-card ${editingContextId === record.id ? 'active' : ''}`}
                      onClick={() => handleEditRecordClick(record)}
                    >
                      <span className="context-record-title">{record.title}</span>
                      <span className="context-record-date">Обновлено: {record.updatedAt}</span>
                      <span className="context-record-preview">
                        {isFilesType
                          ? (record.files ?? []).map((file) => file.name).join(', ') || 'Файлы не выбраны'
                          : record.content}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onDeleteRecord(record)}
                      disabled={isSubmitting}
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeContextType === 'GitHub' && contextSourcesLoadError ? (
              <p className="context-empty">{contextSourcesLoadError}</p>
            ) : null}
          </section>

          {isEditorVisible ? (
            <section className="context-editor">
              <div className="context-panel-head context-editor-head">
                <h3>{editingContextId ? 'Редактирование записи' : 'Новая запись'}</h3>
                <button
                  type="button"
                  className="ghost-button context-editor-close-button"
                  onClick={handleCloseEditorClick}
                  aria-label="Закрыть форму"
                >
                  ×
                </button>
              </div>
              <p>{contextTitleByType[activeContextType]}</p>
              <form onSubmit={onSubmit}>
                <label>
                  Заголовок
                  <input
                    value={contextTitle}
                    onChange={(event) => onContextTitleChange(event.target.value)}
                    placeholder="Например: Основной репозиторий"
                  />
                </label>

                <label>
                  {isFilesType ? 'Загрузка файлов' : 'Контекст'}
                  {isFilesType ? (
                    <div className="context-file-upload">
                      <input type="file" multiple onChange={onFilesSelected} />
                      {contextFiles.length > 0 ? (
                        <ul className="context-file-list">
                          {contextFiles.map((file) => (
                            <li key={file.id}>
                              <span>{file.name}</span>
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => onRemoveFile(file.id)}
                              >
                                Удалить
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="context-file-empty">Пока не загружено ни одного файла.</p>
                      )}
                    </div>
                  ) : (
                    <textarea
                      value={contextContent}
                      onChange={(event) => onContextContentChange(event.target.value)}
                      placeholder={contextPlaceholderByType[activeContextType]}
                      rows={8}
                    />
                  )}
                </label>

                <div className="context-editor-actions">
                  <button type="button" className="ghost-button" onClick={onResetEditor}>
                    Очистить
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      !contextTitle.trim() ||
                      (isFilesType
                        ? contextFiles.length === 0
                        : !contextContent.trim())
                    }
                  >
                    {isSubmitting
                      ? 'Сохраняем...'
                      : editingContextId
                        ? 'Сохранить изменения'
                        : 'Добавить запись'}
                  </button>
                </div>
                {submitError ? <p className="context-empty">{submitError}</p> : null}
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  )
}
