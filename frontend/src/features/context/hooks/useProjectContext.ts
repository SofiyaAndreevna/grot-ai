import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { createContextSource, deleteContextSource, fetchContextSources } from '../api'
import { buildInitialContextByType } from '../constants'
import { contextTypes } from '../types'
import type { ContextRecord, ContextType, UploadedContextFile } from '../types'

type UseProjectContextParams = {
  projectId: string
}

export const useProjectContext = ({ projectId }: UseProjectContextParams) => {
  const [activeContextType, setActiveContextType] = useState<ContextType>(contextTypes[0])
  const [projectContextByType, setProjectContextByType] = useState<
    Record<string, Record<ContextType, ContextRecord[]>>
  >(() => ({
    [projectId]: buildInitialContextByType(),
  }))
  const [editingContextId, setEditingContextId] = useState<string | null>(null)
  const [contextTitle, setContextTitle] = useState('')
  const [contextContent, setContextContent] = useState('')
  const [contextFiles, setContextFiles] = useState<UploadedContextFile[]>([])
  const [isContextSubmitting, setIsContextSubmitting] = useState(false)
  const [contextSubmitError, setContextSubmitError] = useState<string | null>(null)
  const [isContextSourcesLoading, setIsContextSourcesLoading] = useState(false)
  const [contextSourcesLoadError, setContextSourcesLoadError] = useState<string | null>(null)

  const contextByType = projectContextByType[projectId] ?? buildInitialContextByType()
  const activeTypeRecords = contextByType[activeContextType] ?? []

  useEffect(() => {
    let isCancelled = false

    const loadContextSources = async () => {
      setIsContextSourcesLoading(true)
      setContextSourcesLoadError(null)

      try {
        const contextSources = await fetchContextSources(projectId)

        if (isCancelled) {
          return
        }

        const githubRecords: ContextRecord[] = contextSources
          .filter((source) => source.type === 'github')
          .map((source) => ({
            id: source.id,
            title: source.name,
            content: source.url,
            updatedAt: new Date(source.updatedAt).toLocaleDateString('ru-RU'),
          }))

        setProjectContextByType((prev) => {
          const projectRecords = prev[projectId] ?? buildInitialContextByType()

          return {
            ...prev,
            [projectId]: {
              ...projectRecords,
              GitHub: githubRecords,
            },
          }
        })
      } catch (error) {
        if (isCancelled) {
          return
        }

        setContextSourcesLoadError(
          error instanceof Error ? error.message : 'Не удалось загрузить источники контекста.',
        )
      } finally {
        if (!isCancelled) {
          setIsContextSourcesLoading(false)
        }
      }
    }

    void loadContextSources()

    return () => {
      isCancelled = true
    }
  }, [projectId])

  const clearContextEditor = () => {
    setEditingContextId(null)
    setContextTitle('')
    setContextContent('')
    setContextFiles([])
    setContextSubmitError(null)
  }

  const startEditingContextRecord = (record: ContextRecord) => {
    setEditingContextId(record.id)
    setContextTitle(record.title)
    setContextContent(record.content)
    setContextFiles(record.files ?? [])
  }

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(event.target.files ?? []).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      size: file.size,
      type: file.type,
    }))

    setContextFiles((prev) => {
      const prevById = new Map(prev.map((file) => [file.id, file]))
      for (const file of uploadedFiles) {
        prevById.set(file.id, file)
      }
      return Array.from(prevById.values())
    })

    event.target.value = ''
  }

  const removeContextFile = (fileId: string) => {
    setContextFiles((prev) => prev.filter((file) => file.id !== fileId))
  }

  const deleteContextRecord = async (recordToDelete: ContextRecord) => {
    if (isContextSubmitting) {
      return
    }

    const isGitHubType = activeContextType === 'GitHub'
    setContextSubmitError(null)
    setIsContextSubmitting(true)

    try {
      if (isGitHubType) {
        await deleteContextSource(recordToDelete.id)
      }

      setProjectContextByType((prev) => {
        const projectRecords = prev[projectId] ?? buildInitialContextByType()
        const records = projectRecords[activeContextType] ?? []
        const nextRecords = records.filter((record) => record.id !== recordToDelete.id)

        return {
          ...prev,
          [projectId]: {
            ...projectRecords,
            [activeContextType]: nextRecords,
          },
        }
      })

      if (editingContextId === recordToDelete.id) {
        clearContextEditor()
      }
    } catch (error) {
      setContextSubmitError(
        error instanceof Error ? error.message : 'Не удалось удалить запись контекста.',
      )
    } finally {
      setIsContextSubmitting(false)
    }
  }

  const handleContextSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isContextSubmitting) {
      return
    }

    const trimmedTitle = contextTitle.trim()
    const trimmedContent = contextContent.trim()
    const isFilesType = activeContextType === ('Файлы' as unknown as ContextType)
    const isGitHubType = activeContextType === 'GitHub'

    setContextSubmitError(null)

    if (!trimmedTitle) {
      return
    }

    if (!isFilesType && !trimmedContent) {
      return
    }

    if (isFilesType && contextFiles.length === 0) {
      return
    }

    let nextRecordId = editingContextId ?? crypto.randomUUID()

    if (isGitHubType) {
      setIsContextSubmitting(true)

      try {
        const contextSource = await createContextSource({
          projectId,
          type: 'github',
          name: trimmedTitle,
          url: trimmedContent,
        })

        nextRecordId = contextSource.id
      } catch (error) {
        setContextSubmitError(
          error instanceof Error ? error.message : 'Не удалось сохранить GitHub-ссылку на backend.',
        )
        setIsContextSubmitting(false)
        return
      }
    }

    const updatedAt = new Date().toLocaleDateString('ru-RU')

    setProjectContextByType((prev) => {
      const projectRecords = prev[projectId] ?? buildInitialContextByType()
      const records = projectRecords[activeContextType] ?? []
      const nextRecords = editingContextId
        ? records.map((record) =>
            record.id === editingContextId
              ? {
                  ...record,
                  id: nextRecordId,
                  title: trimmedTitle,
                  content: trimmedContent,
                  updatedAt,
                  files: isFilesType ? contextFiles : undefined,
                }
              : record,
          )
        : [
            {
              id: nextRecordId,
              title: trimmedTitle,
              content: trimmedContent,
              updatedAt,
              files: isFilesType ? contextFiles : undefined,
            },
            ...records,
          ]

      return {
        ...prev,
        [projectId]: {
          ...projectRecords,
          [activeContextType]: nextRecords,
        },
      }
    })

    clearContextEditor()
    setIsContextSubmitting(false)
  }

  const switchContextType = (type: ContextType) => {
    setActiveContextType(type)
    clearContextEditor()
  }

  return {
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
  }
}
