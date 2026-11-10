import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Bot, Send, Sparkles, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import {
  IA_QUICK_SUGGESTIONS,
  askFleetAssistant,
  type IaChatMessage,
  type VehicleTelemetryInput,
} from '@/services/aiService'

interface IaAssistantChatProps {
  telemetries: VehicleTelemetryInput[]
  focusPlaca?: string
  ready: boolean
  welcome?: string
  storageKey?: string
}

function chatStorageKey(storageKey?: string) {
  return `frotamaq-ia-chat:${storageKey ?? 'frota'}`
}

function readStoredMessages(key: string): IaChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as IaChatMessage[]
    return Array.isArray(parsed) ? parsed.filter(item => item?.id && item.role && item.content) : []
  } catch {
    return []
  }
}

export function IaAssistantChat({ telemetries, focusPlaca, ready, welcome, storageKey }: IaAssistantChatProps) {
  const historyKey = chatStorageKey(storageKey)
  const [messages, setMessages] = useState<IaChatMessage[]>(() => readStoredMessages(historyKey))
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const welcomeRef = useRef(welcome)

  useEffect(() => {
    welcomeRef.current = welcome
  }, [welcome])

  useEffect(() => {
    setMessages(readStoredMessages(historyKey))
    setDraft('')
  }, [historyKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(historyKey, JSON.stringify(messages))
  }, [historyKey, messages])

  useEffect(() => {
    if (!ready || messages.length > 0) return
    const content = welcomeRef.current?.trim()
      || 'Olá! Sou o **Co-Piloto de IA** — assistente de consulta operacional (somente leitura). Pergunte sobre disponibilidade, preventiva, viagens ou ESG.'
    setMessages([{ id: newMessageId(), role: 'assistant', content }])
  }, [ready, messages.length])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, thinking])

  async function sendQuestion(question: string) {
    const text = question.trim()
    if (!text || thinking || !ready) return

    const history = messages
    const userMessage: IaChatMessage = { id: newMessageId(), role: 'user', content: text }
    setMessages(prev => [...prev, userMessage])
    setDraft('')
    setThinking(true)

    try {
      const reply = await askFleetAssistant(text, telemetries, history, { focusPlaca })
      setMessages(prev => [
        ...prev,
        {
          id: newMessageId(),
          role: 'assistant',
          content: reply.aviso ? `${reply.content}\n\n_${reply.aviso}_` : reply.content,
          fonte: reply.fonte,
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: newMessageId(),
          role: 'assistant',
          content: 'Não consegui responder agora. Os dados da frota continuam disponíveis — tente novamente em instantes.',
        },
      ])
    } finally {
      setThinking(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    sendQuestion(draft)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendQuestion(draft)
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-action" />
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Consultas rápidas</p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {IA_QUICK_SUGGESTIONS.map(suggestion => (
          <button
            key={suggestion}
            type="button"
            disabled={thinking || !ready}
            onClick={() => sendQuestion(suggestion)}
            className="rounded-full border border-border bg-surface-muted px-3 py-1.5 text-left text-xs font-medium text-fg transition-colors hover:border-action/40 hover:bg-action/10 hover:text-action disabled:cursor-not-allowed disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div
        ref={listRef}
        className="mb-3 max-h-72 space-y-3 overflow-y-auto rounded-xl border border-border bg-canvas/60 p-3"
        aria-live="polite"
      >
        {messages.map(message => (
          <ChatBubble key={message.id} message={message} />
        ))}
        {thinking && (
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-action/10 text-action">
              <Bot className="h-3.5 w-3.5" />
            </span>
            <div className="rounded-2xl rounded-tl-md border border-action/20 bg-action/5 px-3 py-2 text-sm text-action">
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-3.5 w-3.5" />
                Consultando a frota...
              </span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <label className="sr-only" htmlFor="ia-assistant-input">Pergunta para o Co-Piloto</label>
        <textarea
          id="ia-assistant-input"
          rows={2}
          value={draft}
          disabled={thinking || !ready}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Consulte a frota: disponibilidade, preventiva, viagens, ESG..."
          className="min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-fg-subtle focus:border-action focus:outline-none focus:ring-2 focus:ring-action/25 disabled:opacity-60"
        />
        <Button type="submit" disabled={thinking || !ready || !draft.trim()} className="shrink-0">
          <Send className="h-4 w-4" />
          Enviar
        </Button>
      </form>
    </div>
  )
}

function ChatBubble({ message }: { message: IaChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-action text-white' : 'bg-action/10 text-action'
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </span>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
          isUser
            ? 'rounded-tr-md bg-action text-white'
            : 'rounded-tl-md border border-border bg-surface text-fg'
        }`}
      >
        <LightMarkdown text={message.content} inverted={isUser} />
      </div>
    </div>
  )
}

function LightMarkdown({ text, inverted = false }: { text: string; inverted?: boolean }) {
  const blocks = text.trim().split(/\n{2,}/)
  const strongClass = inverted ? 'font-semibold text-white' : 'font-semibold text-fg'
  const mutedClass = inverted ? 'text-white/80' : 'text-fg-muted'

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        const lines = block.split('\n').map(line => line.trim()).filter(Boolean)
        const isList = lines.length > 0 && lines.every(line => /^[-*•]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
        if (isList) {
          return (
            <ul key={index} className="list-disc space-y-1 pl-4">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  {renderInline(line.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, ''), strongClass, mutedClass)}
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={index}>
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                {renderInline(line, strongClass, mutedClass)}
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function renderInline(text: string, strongClass: string, mutedClass: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean)
  return parts.map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/)
    if (bold) return <strong key={index} className={strongClass}>{bold[1]}</strong>
    const em = part.match(/^_([^_]+)_$/)
    if (em) return <em key={index} className={mutedClass}>{em[1]}</em>
    return <span key={index}>{part}</span>
  })
}

function newMessageId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
