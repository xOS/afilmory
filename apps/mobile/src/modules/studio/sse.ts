export interface SseMessage {
  data: string
  event: string | null
}

export interface SseParser {
  finish: () => void
  push: (chunk: string) => void
}

export function createSseParser(onMessage: (message: SseMessage) => void): SseParser {
  let buffer = ''

  const process = (flush: boolean) => {
    buffer = buffer.replaceAll('\r\n', '\n')
    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const raw = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      emit(raw, onMessage)
      boundary = buffer.indexOf('\n\n')
    }

    if (flush && buffer.trim()) {
      emit(buffer, onMessage)
      buffer = ''
    }
  }

  return {
    finish() {
      process(true)
    },
    push(chunk: string) {
      buffer += chunk
      process(false)
    },
  }
}

function emit(raw: string, onMessage: (message: SseMessage) => void) {
  let event: string | null = null
  const data: string[] = []

  for (const line of raw.split('\n')) {
    if (!line || line.startsWith(':')) {
      continue
    }
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
      continue
    }
    if (line.startsWith('data:')) {
      data.push(line.slice(5).trimStart())
    }
  }

  if (data.length > 0) {
    onMessage({ data: data.join('\n'), event })
  }
}
