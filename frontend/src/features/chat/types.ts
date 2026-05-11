export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  sources?: string[]
}

export type EpicChat = {
  id: string
  title: string
}

export type Epic = {
  id: string
  title: string
  chats: EpicChat[]
}

export type Project = {
  id: string
  title: string
  description: string
  epics: Epic[]
}

export type ChatMode = 'analyst' | 'developer'
