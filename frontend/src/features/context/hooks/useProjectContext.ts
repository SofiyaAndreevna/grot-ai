import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

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

  const contextByType = projectContextByType[projectId] ?? buildInitialContextByType()
  const activeTypeRecords = contextByType[activeContextType] ?? []

  const clearContextEditor = () => {
    setEditingContextId(null)
    setContextTitle('')
    setContextContent('')
    setContextFiles([])
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

  const handleContextSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedTitle = contextTitle.trim()
    const trimmedContent = contextContent.trim()
    const isFilesType = activeContextType === 'Файлы'

    if (!trimmedTitle) {
      return
    }

    if (!isFilesType && !trimmedContent) {
      return
    }

    if (isFilesType && contextFiles.length === 0) {
      return
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
                  title: trimmedTitle,
                  content: trimmedContent,
                  updatedAt,
                  files: isFilesType ? contextFiles : undefined,
                }
              : record,
          )
        : [
            {
              id: crypto.randomUUID(),
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
    clearContextEditor,
    startEditingContextRecord,
    handleFilesSelected,
    removeContextFile,
    handleContextSubmit,
    switchContextType,
  }
}
