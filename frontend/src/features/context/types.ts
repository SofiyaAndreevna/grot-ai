export const contextTypes = [
  'Описание',
  'GitHub',
  // 'Файлы',
  // 'Ссылки',
  // 'Jira',
  // 'Confluence',
  // 'Figma',
  // 'Базы данных',
  // 'Инструкции ИИ',
] as const

export type ContextType = (typeof contextTypes)[number]

export type UploadedContextFile = {
  id: string
  name: string
  size: number
  type: string
}

export type ContextRecord = {
  id: string
  title: string
  content: string
  updatedAt: string
  files?: UploadedContextFile[]
}
