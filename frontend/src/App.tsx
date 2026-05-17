import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import './App.css'
import { AppContent } from '@/features/app-content'
import { fetchProjects, updateProject } from '@/features/chat'
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
  const [projects, setProjects] = useState<Project[]>([])
  const [isProjectsLoading, setIsProjectsLoading] = useState(true)
  const routeState = useMemo(
    () => (projects.length > 0 ? resolveRouteState(location.pathname, projects) : null),
    [location.pathname, projects],
  )

  useEffect(() => {
    let isCancelled = false

    const loadProjects = async () => {
      try {
        const loadedProjects = await fetchProjects()
        if (!isCancelled) {
          setProjects(loadedProjects)
        }
      } catch (error) {
        console.error('Failed to load projects', error)
      } finally {
        if (!isCancelled) {
          setIsProjectsLoading(false)
        }
      }
    }

    void loadProjects()

    return () => {
      isCancelled = true
    }
  }, [])

  const activeProjectSection = routeState?.section ?? 'Обзор проекта'
  const activeProject = routeState ? projects.find((project) => project.id === routeState.projectId) ?? projects[0] : null
  const activeEpic = activeProject ? activeProject.epics.find((epic) => epic.id === routeState?.epicId) ?? activeProject.epics[0] : null
  const activeChat = activeEpic?.chats.find((chat) => chat.id === routeState?.chatId) ?? activeEpic?.chats[0]
  const activeEpicId = activeEpic?.id ?? ''
  const activeChatId = activeChat?.id ?? ''

  const handleProjectRename = async (projectId: string, nextProjectTitle: string) => {
    const renamedProject = await updateProject(projectId, nextProjectTitle)

    setProjects((previousProjects) =>
      previousProjects.map((project) =>
        project.id === projectId
          ? {
              ...project,
              title: renamedProject.title,
            }
          : project,
      ),
    )
  }

  useEffect(() => {
    if (!activeProject) {
      return
    }

    if (isOverviewSection(activeProjectSection) && activeEpicId && activeChatId) {
      const path = buildChatPath(activeProject.id, activeEpicId, activeChatId)

      if (location.pathname !== path) {
        navigate(path, { replace: true })
      }
    }
  }, [
    activeChatId,
    activeEpicId,
    activeProject,
    activeProjectSection,
    location.pathname,
    navigate,
  ])

  useEffect(() => {
    if (!activeProject) {
      return
    }

    const targetContextPath = buildContextPath(activeProject.id)
    if (isContextSection(activeProjectSection) && location.pathname !== targetContextPath) {
      navigate(targetContextPath, { replace: true })
    }
  }, [activeProject, activeProjectSection, location.pathname, navigate])

  if (isProjectsLoading) {
    return <main className="layout">Загрузка проектов...</main>
  }

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
        activeProjectId={activeProject?.id ?? ''}
        activeProjectTitle={activeProject?.title ?? ''}
        activeProjectSection={activeProjectSection}
        activeEpicTitle={activeEpic?.title ?? ''}
        activeChatId={activeChatId}
        activeChatTitle={activeChat?.title ?? ''}
        onRenameProject={handleProjectRename}
      />
    </main>
  )
}

export default App
