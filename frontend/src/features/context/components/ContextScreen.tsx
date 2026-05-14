import type { ChangeEvent, FormEvent } from 'react'

import { contextPlaceholderByType, contextTitleByType } from '../constants'
import { contextTypes } from '../types'
import type { ContextRecord, ContextType, UploadedContextFile } from '../types'

type ContextScreenProps = {
  activeContextType: ContextType
  activeTypeRecords: ContextRecord[]
  editingContextId: string | null
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

        <div className="context-content-grid">
          <section className="context-records">
            <div className="context-panel-head">
              <h3>{activeContextType}</h3>
              <button type="button" onClick={onResetEditor} className="add-action compact">
                + Добавить запись
              </button>
            </div>

            {activeTypeRecords.length === 0 ? (
              <p className="context-empty">
                {isContextSourcesLoading && activeContextType === 'GitHub'
                  ? 'Загружаем GitHub-источники...'
                  : 'Записей пока нет. Добавьте первую запись справа.'}
              </p>
            ) : (
              <div className="context-record-list">
                {activeTypeRecords.map((record) => (
                  <div key={record.id} className="context-record-item">
                    <button
                      type="button"
                      className={`context-record-card ${editingContextId === record.id ? 'active' : ''}`}
                      onClick={() => onEditRecord(record)}
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

          <section className="context-editor">
            <h3>{editingContextId ? 'Редактирование записи' : 'Новая запись'}</h3>
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
        </div>
      </div>
    </section>
  )
}
