import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import './App.css'
import { AppContent } from '@/features/app-content'
import { seedProjects } from '@/features/chat'
import type { Epic, EpicChat, Project } from '@/features/chat'
import { Sidebar } from '@/features/navigation'
import type { NewProjectPayload } from '@/features/navigation'
import { projectSections } from '@/features/navigation'
import type { ProjectSection } from '@/features/navigation'
import {
  buildChatPath,
  buildContextPath,
  isContextSection,
  isOverviewSection,
  resolveRouteState,
} from '@/features/navigation'

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
  const firstChat = firstEpic.chats[0]

  return buildChatPath(project.id, firstEpic.id, firstChat.id)
}

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>(seedProjects)
  const routeState = useMemo(() => resolveRouteState(location.pathname, projects), [location.pathname, projects])

  const activeProjectSection = routeState.section
  const activeProject = projects.find((project) => project.id === routeState.projectId) ?? projects[0]
  const activeEpic = activeProject.epics.find((epic) => epic.id === routeState.epicId) ?? activeProject.epics[0]
  const activeChat = activeEpic.chats.find((chat) => chat.id === routeState.chatId) ?? activeEpic.chats[0]

  useEffect(() => {
    if (isOverviewSection(activeProjectSection)) {
      const path = buildChatPath(activeProject.id, activeEpic.id, activeChat.id)

      if (location.pathname !== path) {
        navigate(path, { replace: true })
      }
    }
  }, [
    activeChat.id,
    activeEpic.id,
    activeProject.id,
    activeProjectSection,
    location.pathname,
    navigate,
  ])

  useEffect(() => {
    const targetContextPath = buildContextPath(activeProject.id)
    if (isContextSection(activeProjectSection) && location.pathname !== targetContextPath) {
      navigate(targetContextPath, { replace: true })
    }
  }, [activeProject.id, activeProjectSection, location.pathname, navigate])

  const handleProjectSectionChange = (section: ProjectSection) => {
    if (isContextSection(section)) {
      navigate(buildContextPath(activeProject.id))
      return
    }

    navigate(buildChatPath(activeProject.id, activeEpic.id, activeChat.id))
  }

  const selectEpicAndChat = (epic: Epic, chat?: EpicChat) => {
    const nextChat = chat ?? epic.chats[0]
    navigate(buildChatPath(activeProject.id, epic.id, nextChat.id))
  }

  const handleProjectChange = (project: Project) => {
    navigate(getFirstProjectRoute(project))
  }

  const handleAddProject = ({ title, description }: NewProjectPayload) => {
    let nextProjectRoute = ''

    setProjects((previousProjects) => {
      const projectId = createUniqueProjectId(previousProjects, title)
      const nextProject: Project = {
        id: projectId,
        title,
        description,
        epics: [
          {
            id: 'new-epic',
            title: 'Новый эпик',
            chats: [{ id: 'new-chat', title: 'Новый чат' }],
          },
        ],
      }

      const nextProjects = [...previousProjects, nextProject]
      nextProjectRoute = getFirstProjectRoute(nextProject)
      return nextProjects
    })

    if (nextProjectRoute) {
      navigate(nextProjectRoute)
    }
  }

  return (
    <main className="layout">
      <Sidebar
        projects={projects}
        activeProjectId={activeProject.id}
        onProjectChange={handleProjectChange}
        onAddProject={handleAddProject}
        projectSections={projectSections}
        activeProjectSection={activeProjectSection}
        onProjectSectionChange={handleProjectSectionChange}
        epics={activeProject.epics}
        activeEpicId={activeEpic.id}
        activeChatId={activeChat.id}
        onSelectEpicAndChat={selectEpicAndChat}
      />

      <AppContent
        activeProjectId={activeProject.id}
        activeProjectSection={activeProjectSection}
        activeEpicTitle={activeEpic.title}
        activeChatId={activeChat.id}
        activeChatTitle={activeChat.title}
      />
    </main>
  )
}

export default App
