type ContextSourceType = 'github'

type CreateContextSourcePayload = {
  projectId: string
  type: ContextSourceType
  name: string
  url: string
}

type ContextSourceDto = {
  id: string
  projectId: string
  type: ContextSourceType
  name: string
  url: string
  createdAt: string
  updatedAt: string
}

type ApiErrorResponse = {
  error?: string
}

const readErrorMessage = async (response: Response) => {
  try {
    const payload = (await response.json()) as ApiErrorResponse
    if (payload.error) {
      return payload.error
    }
  } catch {
    // Ignore JSON parsing error and use generic message.
  }

  return `Request failed with status ${response.status}`
}

export const createContextSource = async (payload: CreateContextSourcePayload): Promise<ContextSourceDto> => {
  const response = await fetch('/api/context-sources', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const data = (await response.json()) as { contextSource: ContextSourceDto }
  return data.contextSource
}

export const fetchContextSources = async (projectId: string): Promise<ContextSourceDto[]> => {
  const response = await fetch(`/api/context-sources?projectId=${encodeURIComponent(projectId)}`)

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  const data = (await response.json()) as { contextSources: ContextSourceDto[] }
  return data.contextSources
}

export const deleteContextSource = async (id: string): Promise<void> => {
  const response = await fetch(`/api/context-sources/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
}
