import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import './Sidebar.css'
import { createChat, createEpic, createProject, deleteChat, deleteEpic, fetchEpics, renameChat, renameEpic } from '@/features/chat'
import type { Epic, Project } from '@/features/chat'
import { projectSections } from '../constants'
import type { ProjectSection } from '../constants'
import { buildChatPath, buildContextPath, isContextSection, isOverviewSection } from '../routing'

type SidebarProps = {
  projects: Project[]
  setProjects: Dispatch<SetStateAction<Project[]>>
  activeProject: Project | null
  activeProjectSection: ProjectSection
  activeEpicId: string
  activeChatId: string
}

const normalizeProjectId = (projectTitle: string) =>
  projectTitle
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'project'

const createUniqueProjectId = (projects: Project[], projectTitle: string) => {
  const baseId = normalizeProjectId(projectTitle)
  const existingIds = new Set(projects.map((project) => project.id))

  if (!existingIds.has(baseId)) {
    return baseId
  }

  let suffix = 2
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1
  }

  return `${baseId}-${suffix}`
}

const getFirstProjectRoute = (project: Project) => {
  const firstEpic = project.epics[0]
  if (!firstEpic) {
    return buildContextPath(project.id)
  }
  const firstChat = firstEpic.chats[0]
  if (!firstChat) {
    return buildContextPath(project.id)
  }

  return buildChatPath(project.id, firstEpic.id, firstChat.id)
}

export const Sidebar = ({
  projects,
  setProjects,
  activeProject,
  activeProjectSection,
  activeEpicId,
  activeChatId,
}: SidebarProps) => {
  const navigate = useNavigate()
  const activeProjectId = activeProject?.id ?? ''
  const epics = activeProject?.epics ?? []
  const projectIdsSignature = JSON.stringify(projects.map((project) => project.id))
  const [expandedEpicId, setExpandedEpicId] = useState<string>(activeEpicId)
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [isEpicFormOpen, setIsEpicFormOpen] = useState(false)
  const [epicName, setEpicName] = useState('')
  const [editingEpicId, setEditingEpicId] = useState<string | null>(null)
  const [editingEpicName, setEditingEpicName] = useState('')
  const [chatFormEpicId, setChatFormEpicId] = useState<string | null>(null)
  const [chatName, setChatName] = useState('')
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingChatName, setEditingChatName] = useState('')

  useEffect(() => {
    let isCancelled = false
    const projectIds = JSON.parse(projectIdsSignature) as string[]

    const syncEpics = async () => {
      const projectEpicsEntries = await Promise.all(
        projectIds.map(async (projectId) => {
          try {
            const projectEpics = await fetchEpics(projectId)
            return [projectId, projectEpics] as const
          } catch (error) {
            console.error(`Failed to load epics for project ${projectId}`, error)
            return [projectId, null] as const
          }
        }),
      )

      if (isCancelled) {
        return
      }

      const projectEpicsByProjectId = new Map(
        projectEpicsEntries.filter((entry): entry is readonly [string, Epic[]] => entry[1] !== null),
      )

      setProjects((previousProjects) =>
        previousProjects.map((candidateProject) => {
          const nextEpics = projectEpicsByProjectId.get(candidateProject.id)
          if (!nextEpics) {
            return candidateProject
          }

          return {
            ...candidateProject,
            epics: nextEpics,
          }
        }),
      )
    }

    if (projectIds.length > 0) {
      void syncEpics()
    }

    return () => {
      isCancelled = true
    }
  }, [projectIdsSignature, setProjects])

  useEffect(() => {
    if (!activeProject) {
      setExpandedEpicId('')
      return
    }

    if (activeEpicId) {
      setExpandedEpicId(activeEpicId)
      return
    }

    setExpandedEpicId((previousExpandedEpicId) =>
      activeProject.epics.some((epic) => epic.id === previousExpandedEpicId) ? previousExpandedEpicId : '',
    )
  }, [activeProject, activeEpicId])

  const selectEpicAndChat = (epic: Epic, chat = epic.chats[0]) => {
    if (!chat) {
      return
    }
    navigate(buildChatPath(activeProjectId, epic.id, chat.id))
  }

  const handleProjectSectionChange = (section: ProjectSection) => {
    if (!activeProject) {
      return
    }

    if (isContextSection(section)) {
      navigate(buildContextPath(activeProjectId))
      return
    }

    if (!activeEpicId || !activeChatId) {
      navigate(`/${activeProjectId}`)
      return
    }

    navigate(buildChatPath(activeProjectId, activeEpicId, activeChatId))
  }

  const handleProjectChange = (project: Project) => {
    navigate(getFirstProjectRoute(project))
  }

  const handleAddProject = async (title: string, description: string) => {
    const projectId = createUniqueProjectId(projects, title)
    const createdProject = await createProject(projectId, title)
    const nextProject: Project = {
      ...createdProject,
      description,
      epics: [],
    }

    setProjects((previousProjects) => [...previousProjects, nextProject])
    navigate(getFirstProjectRoute(nextProject))
  }

  const handleEpicClick = (epic: Epic) => {
    selectEpicAndChat(epic)
    setExpandedEpicId(epic.id)
  }

  const resetProjectForm = () => {
    setProjectName('')
    setProjectDescription('')
    setIsProjectFormOpen(false)
  }

  const resetEpicForm = () => {
    setEpicName('')
    setIsEpicFormOpen(false)
  }

  const resetEpicEdit = () => {
    setEditingEpicId(null)
    setEditingEpicName('')
  }

  const resetChatForm = () => {
    setChatFormEpicId(null)
    setChatName('')
  }

  const resetChatEdit = () => {
    setEditingChatId(null)
    setEditingChatName('')
  }

  const handleProjectSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = projectName.trim()
    const trimmedDescription = projectDescription.trim()

    if (!trimmedName) {
      return
    }

    try {
      await handleAddProject(trimmedName, trimmedDescription)
      resetProjectForm()
    } catch (error) {
      console.error('Failed to create project', error)
    }
  }

  const handleCreateEpicSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeProject) {
      return
    }

    const trimmedName = epicName.trim()
    if (!trimmedName) {
      return
    }

    const createdEpic = await createEpic(activeProjectId, trimmedName)
    setProjects((previousProjects) =>
      previousProjects.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              epics: [...project.epics, createdEpic],
            }
          : project,
      ),
    )

    const nextChat = createdEpic.chats[0]
    if (nextChat) {
      navigate(buildChatPath(activeProjectId, createdEpic.id, nextChat.id))
    }
    resetEpicForm()
  }

  const startEpicEditing = (epic: Epic) => {
    setEditingEpicId(epic.id)
    setEditingEpicName(epic.title)
  }

  const handleRenameEpicSubmit = async (event: FormEvent<HTMLFormElement>, epicId: string) => {
    event.preventDefault()
    if (!activeProject) {
      return
    }

    const trimmedName = editingEpicName.trim()
    if (!trimmedName) {
      return
    }

    const renamedEpic = await renameEpic(epicId, trimmedName)
    setProjects((previousProjects) =>
      previousProjects.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              epics: project.epics.map((epic) =>
                epic.id === epicId
                  ? {
                      ...epic,
                      title: renamedEpic.title,
                      updatedAt: renamedEpic.updatedAt,
                    }
                  : epic,
              ),
            }
          : project,
      ),
    )
    resetEpicEdit()
  }

  const handleDeleteEpic = async (epic: Epic) => {
    if (!activeProject) {
      return
    }

    const shouldDelete = window.confirm(`Удалить эпик "${epic.title}"? Все его чаты тоже будут удалены.`)
    if (!shouldDelete) {
      return
    }

    await deleteEpic(epic.id)

    let nextPath: string | null = null
    setProjects((previousProjects) =>
      previousProjects.map((project) => {
        if (project.id !== activeProjectId) {
          return project
        }

        const nextEpics = project.epics.filter((candidateEpic) => candidateEpic.id !== epic.id)
        if (activeEpicId === epic.id) {
          const fallbackEpic = nextEpics[0]
          const fallbackChat = fallbackEpic?.chats[0]
          nextPath =
            fallbackEpic && fallbackChat
              ? buildChatPath(activeProjectId, fallbackEpic.id, fallbackChat.id)
              : buildContextPath(activeProjectId)
        }

        return {
          ...project,
          epics: nextEpics,
        }
      }),
    )

    if (nextPath) {
      navigate(nextPath)
    }
    if (editingEpicId === epic.id) {
      resetEpicEdit()
    }
    if (chatFormEpicId === epic.id) {
      resetChatForm()
    }
    if (editingChatId && epic.chats.some((chat) => chat.id === editingChatId)) {
      resetChatEdit()
    }
  }

  const handleCreateChatSubmit = async (event: FormEvent<HTMLFormElement>, epic: Epic) => {
    event.preventDefault()
    if (!activeProject) {
      return
    }

    const trimmedName = chatName.trim()
    if (!trimmedName) {
      return
    }

    const createdChat = await createChat(epic.id, trimmedName)
    setProjects((previousProjects) =>
      previousProjects.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              epics: project.epics.map((candidateEpic) =>
                candidateEpic.id === epic.id
                  ? {
                      ...candidateEpic,
                      chats: [...candidateEpic.chats, createdChat],
                    }
                  : candidateEpic,
              ),
            }
          : project,
      ),
    )

    navigate(buildChatPath(activeProjectId, epic.id, createdChat.id))
    resetChatForm()
  }

  const startChatEditing = (chatId: string, title: string) => {
    setEditingChatId(chatId)
    setEditingChatName(title)
  }

  const handleRenameChatSubmit = async (event: FormEvent<HTMLFormElement>, epicId: string, chatId: string) => {
    event.preventDefault()
    if (!activeProject) {
      return
    }

    const trimmedName = editingChatName.trim()
    if (!trimmedName) {
      return
    }

    const renamed = await renameChat(chatId, trimmedName)
    setProjects((previousProjects) =>
      previousProjects.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              epics: project.epics.map((epic) =>
                epic.id === epicId
                  ? {
                      ...epic,
                      chats: epic.chats.map((chat) => (chat.id === chatId ? { ...chat, title: renamed.title } : chat)),
                    }
                  : epic,
              ),
            }
          : project,
      ),
    )
    resetChatEdit()
  }

  const handleDeleteChat = async (epic: Epic, chatId: string) => {
    if (!activeProject) {
      return
    }

    const targetChat = epic.chats.find((chat) => chat.id === chatId)
    if (!targetChat) {
      return
    }

    const shouldDelete = window.confirm(`Удалить чат "${targetChat.title}"?`)
    if (!shouldDelete) {
      return
    }

    await deleteChat(chatId)

    let nextPath: string | null = null
    setProjects((previousProjects) =>
      previousProjects.map((project) => {
        if (project.id !== activeProjectId) {
          return project
        }

        const nextEpics = project.epics.map((candidateEpic) =>
          candidateEpic.id === epic.id
            ? {
                ...candidateEpic,
                chats: candidateEpic.chats.filter((chat) => chat.id !== chatId),
              }
            : candidateEpic,
        )

        if (activeChatId === chatId) {
          const sameEpic = nextEpics.find((candidateEpic) => candidateEpic.id === epic.id)
          const fallbackSameEpicChat = sameEpic?.chats[0]
          if (fallbackSameEpicChat) {
            nextPath = buildChatPath(activeProjectId, epic.id, fallbackSameEpicChat.id)
          } else {
            const fallbackEpic = nextEpics.find((candidateEpic) => candidateEpic.chats.length > 0)
            const fallbackChat = fallbackEpic?.chats[0]
            nextPath =
              fallbackEpic && fallbackChat ? buildChatPath(activeProjectId, fallbackEpic.id, fallbackChat.id) : buildContextPath(activeProjectId)
          }
        }

        return {
          ...project,
          epics: nextEpics,
        }
      }),
    )

    if (nextPath) {
      navigate(nextPath)
    }
    if (editingChatId === chatId) {
      resetChatEdit()
    }
  }

  return (
    <aside className="sidebar">
      <div className="workspace-brand">
        <h1>Grot</h1>
      </div>

      <div className="projects-area">
        <p className="section-label">Проекты</p>
        <div className="project-list">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`project-switch ${activeProjectId === project.id ? 'active' : ''}`}
              onClick={() => handleProjectChange(project)}
            >
              {project.title}
            </button>
          ))}
        </div>

        {!isProjectFormOpen && (
          <button type="button" className="add-action" onClick={() => setIsProjectFormOpen(true)}>
            + Добавить проект
          </button>
        )}

        {isProjectFormOpen && (
          <form className="project-form" onSubmit={handleProjectSubmit}>
            <label>
              Название проекта
              <input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="Например: Payments Team"
              />
            </label>
            <label>
              Описание
              <textarea
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
                placeholder="Кратко опишите проект"
                rows={3}
              />
            </label>
            <div className="project-form-actions">
              <button type="submit" disabled={!projectName.trim()}>
                Добавить проект
              </button>
              <button type="button" className="ghost-button" onClick={resetProjectForm}>
                Отмена
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="project-nav">
        {activeProject &&
          projectSections.map((section) => (
            <button
              key={section}
              type="button"
              onClick={() => handleProjectSectionChange(section)}
              className={`project-link ${activeProjectSection === section ? 'active' : ''}`}
            >
              {section}
            </button>
          ))}
      </div>

      {activeProject && isOverviewSection(activeProjectSection) && (
        <div className="epics-area">
          <p className="section-label">Эпики</p>
          {!isEpicFormOpen && (
            <button type="button" className="add-action" onClick={() => setIsEpicFormOpen(true)}>
              + Добавить эпик
            </button>
          )}

          {isEpicFormOpen && (
            <form className="epic-form" onSubmit={handleCreateEpicSubmit}>
              <label>
                Название эпика
                <input
                  value={epicName}
                  onChange={(event) => setEpicName(event.target.value)}
                  placeholder="Например: Платежи"
                />
              </label>
              <div className="epic-form-actions">
                <button type="submit" disabled={!epicName.trim()}>
                  Добавить
                </button>
                <button type="button" className="ghost-button" onClick={resetEpicForm}>
                  Отмена
                </button>
              </div>
            </form>
          )}

          {epics.length === 0 && <p className="context-empty">Эпиков пока нет. Добавьте первый эпик.</p>}
          {epics.map((epic) => {
            const isExpanded = expandedEpicId === epic.id

            return (
              <div key={epic.id} className="epic-block">
                <div className="epic-row">
                  {editingEpicId === epic.id ? (
                    <form className="epic-edit-form" onSubmit={(event) => handleRenameEpicSubmit(event, epic.id)}>
                      <input
                        value={editingEpicName}
                        onChange={(event) => setEditingEpicName(event.target.value)}
                        autoFocus
                      />
                      <button type="submit" disabled={!editingEpicName.trim()}>
                        Сохранить
                      </button>
                      <button type="button" className="ghost-button" onClick={resetEpicEdit}>
                        Отмена
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEpicClick(epic)}
                        className={`epic-title ${activeEpicId === epic.id ? 'active' : ''}`}
                      >
                        <span className="chevron">{isExpanded ? '▾' : '▸'}</span> {epic.title}
                      </button>
                      <div className="epic-actions">
                        <button
                          type="button"
                          className="epic-action-button"
                          aria-label="Переименовать эпик"
                          onClick={() => startEpicEditing(epic)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="epic-action-button danger"
                          aria-label="Удалить эпик"
                          onClick={() => handleDeleteEpic(epic)}
                        >
                          🗑
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {isExpanded && (
                  <div className="epic-chats">
                    {epic.chats.map((chat) => (
                      <div key={chat.id} className="chat-row">
                        {editingChatId === chat.id ? (
                          <form className="chat-edit-form" onSubmit={(event) => handleRenameChatSubmit(event, epic.id, chat.id)}>
                            <input value={editingChatName} onChange={(event) => setEditingChatName(event.target.value)} autoFocus />
                            <button type="submit" disabled={!editingChatName.trim()}>
                              Сохранить
                            </button>
                            <button type="button" className="ghost-button" onClick={resetChatEdit}>
                              Отмена
                            </button>
                          </form>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => selectEpicAndChat(epic, chat)}
                              className={`chat-link ${activeChatId === chat.id ? 'active' : ''}`}
                            >
                              • {chat.title}
                            </button>
                            <div className="epic-actions">
                              <button
                                type="button"
                                className="epic-action-button"
                                aria-label="Переименовать чат"
                                onClick={() => startChatEditing(chat.id, chat.title)}
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                className="epic-action-button danger"
                                aria-label="Удалить чат"
                                onClick={() => handleDeleteChat(epic, chat.id)}
                              >
                                🗑
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    {chatFormEpicId === epic.id ? (
                      <form className="chat-edit-form" onSubmit={(event) => handleCreateChatSubmit(event, epic)}>
                        <input
                          value={chatName}
                          onChange={(event) => setChatName(event.target.value)}
                          placeholder="Название чата"
                          autoFocus
                        />
                        <button type="submit" disabled={!chatName.trim()}>
                          Создать
                        </button>
                        <button type="button" className="ghost-button" onClick={resetChatForm}>
                          Отмена
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="chat-create-button"
                        onClick={() => {
                          resetChatEdit()
                          setChatFormEpicId(epic.id)
                        }}
                      >
                        + Добавить чат
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}
