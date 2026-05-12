import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import './App.css'
import { AppContent } from '@/features/app-content'
import { seedProjects } from '@/features/chat'
import type { Project } from '@/features/chat'
import { Sidebar } from '@/features/navigation'
import {
  buildChatPath,
  buildContextPath,
  isContextSection,
  isOverviewSection,
  resolveRouteState,
} from '@/features/navigation'

function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>(seedProjects)
  const routeState = useMemo(() => resolveRouteState(location.pathname, projects), [location.pathname, projects])

  const activeProjectSection = routeState.section
  const activeProject = projects.find((project) => project.id === routeState.projectId) ?? projects[0]
  const activeEpic = activeProject.epics.find((epic) => epic.id === routeState.epicId) ?? activeProject.epics[0]
  const activeChat = activeEpic?.chats.find((chat) => chat.id === routeState.chatId) ?? activeEpic?.chats[0]
  const activeEpicId = activeEpic?.id ?? ''
  const activeChatId = activeChat?.id ?? ''

  useEffect(() => {
    if (isOverviewSection(activeProjectSection) && activeEpicId && activeChatId) {
      const path = buildChatPath(activeProject.id, activeEpicId, activeChatId)

      if (location.pathname !== path) {
        navigate(path, { replace: true })
      }
    }
  }, [
    activeChatId,
    activeEpicId,
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

  return (
    <main className="layout">
      <Sidebar
        projects={projects}
        setProjects={setProjects}
        activeProject={activeProject}
        activeProjectSection={activeProjectSection}
        activeEpicId={activeEpicId}
        activeChatId={activeChatId}
      />

      <AppContent
        activeProjectId={activeProject.id}
        activeProjectSection={activeProjectSection}
        activeEpicTitle={activeEpic?.title ?? ''}
        activeChatId={activeChatId}
        activeChatTitle={activeChat?.title ?? ''}
      />
    </main>
  )
}

export default App
