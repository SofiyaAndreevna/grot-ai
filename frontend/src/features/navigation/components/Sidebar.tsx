import { useState } from 'react'
import type { FormEvent } from 'react'

import type { Epic, EpicChat, Project } from '@/features/chat'
import type { ProjectSection } from '../constants'

export type NewProjectPayload = {
  title: string
  description: string
}

type SidebarProps = {
  projects: Project[]
  activeProjectId: string
  onProjectChange: (project: Project) => void
  onAddProject: (payload: NewProjectPayload) => void
  projectSections: readonly ProjectSection[]
  activeProjectSection: ProjectSection
  onProjectSectionChange: (section: ProjectSection) => void
  epics: Epic[]
  activeEpicId: string
  activeChatId: string
  onSelectEpicAndChat: (epic: Epic, chat?: EpicChat) => void
}

export const Sidebar = ({
  projects,
  activeProjectId,
  onProjectChange,
  onAddProject,
  projectSections,
  activeProjectSection,
  onProjectSectionChange,
  epics,
  activeEpicId,
  activeChatId,
  onSelectEpicAndChat,
}: SidebarProps) => {
  const [expandedEpicIds, setExpandedEpicIds] = useState<Set<string>>(() => new Set([activeEpicId]))
  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')

  const handleEpicClick = (epic: Epic) => {
    onSelectEpicAndChat(epic)
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

  const handleProjectSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = projectName.trim()
    const trimmedDescription = projectDescription.trim()

    if (!trimmedName) {
      return
    }

    onAddProject({
      title: trimmedName,
      description: trimmedDescription,
    })
    resetProjectForm()
  }

  return (
    <aside className="sidebar">
      <div className="workspace-brand">
        <h1>SystemLens</h1>
      </div>

      <div className="projects-area">
        <p className="section-label">Проекты</p>
        <div className="project-list">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              className={`project-switch ${activeProjectId === project.id ? 'active' : ''}`}
              onClick={() => onProjectChange(project)}
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
            onClick={() => onProjectSectionChange(section)}
            className={`project-link ${activeProjectSection === section ? 'active' : ''}`}
          >
            {section}
          </button>
        ))}
      </div>

      {activeProjectSection === 'Обзор проекта' && (
        <div className="epics-area">
          <p className="section-label">Эпики</p>
          {epics.map((epic) => {
            const isExpanded = expandedEpicIds.has(epic.id) || activeEpicId === epic.id

            return (
              <div key={epic.id} className="epic-block">
                <button
                  type="button"
                  onClick={() => handleEpicClick(epic)}
                  className={`epic-title ${activeEpicId === epic.id ? 'active' : ''}`}
                >
                  <span className="chevron">{isExpanded ? '▾' : '▸'}</span> {epic.title}
                </button>

                {isExpanded && (
                  <div className="epic-chats">
                    {epic.chats.map((chat) => (
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => onSelectEpicAndChat(epic, chat)}
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
