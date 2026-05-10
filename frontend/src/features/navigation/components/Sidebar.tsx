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
          {epics.map((epic) => (
            <div key={epic.id} className="epic-block">
              <button
                type="button"
                onClick={() => onSelectEpicAndChat(epic)}
                className={`epic-title ${activeEpicId === epic.id ? 'active' : ''}`}
              >
                <span className="chevron">▾</span> {epic.title}
              </button>

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
            </div>
          ))}

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
