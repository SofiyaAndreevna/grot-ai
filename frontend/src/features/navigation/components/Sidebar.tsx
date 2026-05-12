import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import './Sidebar.css'
import { createEpic, deleteEpic, fetchEpics, renameEpic, seedProjects } from '@/features/chat'
import type { Epic, Project } from '@/features/chat'
import { projectSections } from '../constants'
import type { ProjectSection } from '../constants'
import { buildChatPath, buildContextPath, isContextSection, isOverviewSection } from '../routing'

type SidebarProps = {
  projects: Project[]
  setProjects: Dispatch<SetStateAction<Project[]>>
  activeProject: Project
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
  const activeProjectId = activeProject.id
  const epics = activeProject.epics
  const [expandedEpicIds, setExpandedEpicIds] = useState<Set<string>>(() => new Set([activeEpicId]))
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [isEpicFormOpen, setIsEpicFormOpen] = useState(false)
  const [epicName, setEpicName] = useState('')
  const [editingEpicId, setEditingEpicId] = useState<string | null>(null)
  const [editingEpicName, setEditingEpicName] = useState('')

  useEffect(() => {
    let isCancelled = false

    const syncEpics = async () => {
      for (const project of seedProjects) {
        try {
          const projectEpics = await fetchEpics(project.id)
          if (isCancelled) {
            return
          }
          setProjects((previousProjects) =>
            previousProjects.map((candidateProject) =>
              candidateProject.id === project.id
                ? {
                    ...candidateProject,
                    epics: projectEpics,
                  }
                : candidateProject,
            ),
          )
        } catch (error) {
          console.error(`Failed to load epics for project ${project.id}`, error)
        }
      }
    }

    void syncEpics()
    return () => {
      isCancelled = true
    }
  }, [setProjects])

  const selectEpicAndChat = (epic: Epic, chat = epic.chats[0]) => {
    if (!chat) {
      return
    }
    navigate(buildChatPath(activeProjectId, epic.id, chat.id))
  }

  const handleProjectSectionChange = (section: ProjectSection) => {
    if (isContextSection(section)) {
      navigate(buildContextPath(activeProjectId))
      return
    }

    if (!activeEpicId || !activeChatId) {
      return
    }

    navigate(buildChatPath(activeProjectId, activeEpicId, activeChatId))
  }

  const handleProjectChange = (project: Project) => {
    navigate(getFirstProjectRoute(project))
  }

  const handleAddProject = (title: string, description: string) => {
    let nextProjectRoute = ''

    setProjects((previousProjects) => {
      const projectId = createUniqueProjectId(previousProjects, title)
      const nextProject: Project = {
        id: projectId,
        title,
        description,
        epics: [],
      }

      const nextProjects = [...previousProjects, nextProject]
      nextProjectRoute = getFirstProjectRoute(nextProject)
      return nextProjects
    })

    if (nextProjectRoute) {
      navigate(nextProjectRoute)
    }
  }

  const handleEpicClick = (epic: Epic) => {
    selectEpicAndChat(epic)
    setExpandedEpicIds((previousExpandedEpics) => {
      const nextExpandedEpics = new Set(previousExpandedEpics)

      if (nextExpandedEpics.has(epic.id)) {
        nextExpandedEpics.delete(epic.id)
      } else {
        nextExpandedEpics.add(epic.id)
      }

      return nextExpandedEpics
    })
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

  const handleProjectSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = projectName.trim()
    const trimmedDescription = projectDescription.trim()

    if (!trimmedName) {
      return
    }

    handleAddProject(trimmedName, trimmedDescription)
    resetProjectForm()
  }

  const handleCreateEpicSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
        {projectSections.map((section) => (
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

      {isOverviewSection(activeProjectSection) && (
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
            const isExpanded = expandedEpicIds.has(epic.id) || activeEpicId === epic.id

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
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => selectEpicAndChat(epic, chat)}
                        className={`chat-link ${activeChatId === chat.id ? 'active' : ''}`}
                      >
                        • {chat.title}
                      </button>
                    ))}
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
