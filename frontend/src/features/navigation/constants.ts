export const projectSections = ['Обзор проекта', 'Контекст проекта', 'Настройки'] as const

export type ProjectSection = (typeof projectSections)[number]
