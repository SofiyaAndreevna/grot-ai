import { useEffect, useState } from 'react'

import type { Epic, EpicChat } from '../../chat/types'
import type { ProjectSection } from '../constants'

type SidebarProps = {
  projectSections: readonly ProjectSection[]
  activeProjectSection: ProjectSection
  onProjectSectionChange: (section: ProjectSection) => void
  epics: Epic[]
  activeEpicId: string
  activeChatId: string
  onSelectEpicAndChat: (epic: Epic, chat?: EpicChat) => void
}

export const Sidebar = ({
  projectSections,
  activeProjectSection,
  onProjectSectionChange,
  epics,
  activeEpicId,
  activeChatId,
  onSelectEpicAndChat,
}: SidebarProps) => {
  const [expandedEpicIds, setExpandedEpicIds] = useState<Set<string>>(() => new Set([activeEpicId]))

  useEffect(() => {
    setExpandedEpicIds((previousExpandedEpics) => {
      if (previousExpandedEpics.has(activeEpicId)) {
        return previousExpandedEpics
      }

      const nextExpandedEpics = new Set(previousExpandedEpics)
      nextExpandedEpics.add(activeEpicId)
      return nextExpandedEpics
    })
  }, [activeEpicId])

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

  return (
    <aside className="sidebar">
      <div className="workspace-brand">
        <h1>SystemLens</h1>
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
            const isExpanded = expandedEpicIds.has(epic.id)

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

          <button type="button" className="add-action">
            + Новый эпик
          </button>
          <button type="button" className="add-action">
            + Новый чат
          </button>
        </div>
      )}
    </aside>
  )
}
