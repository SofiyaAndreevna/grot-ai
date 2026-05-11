export const projectSections = ['Обзор проекта', 'Контекст проекта'] as const

export type ProjectSection = (typeof projectSections)[number]
