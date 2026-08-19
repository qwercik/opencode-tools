import { writeFileSync, renameSync, existsSync, readFileSync } from "fs"

const DATA = "/tmp/opencode-cost.json"
const TMP = "/tmp/opencode-cost.json.tmp"

type Entry = { cost: number; parentID?: string | null }

const sessions = new Map<string, Entry>()

function load() {
  try {
    if (!existsSync(DATA)) return
    const raw = JSON.parse(readFileSync(DATA, "utf-8"))
    if (raw?.sessions) {
      for (const [id, info] of Object.entries(raw.sessions)) {
        sessions.set(id, info as Entry)
      }
    }
  } catch { /* ok */ }
}

function save() {
  const obj: Record<string, Entry> = {}
  for (const [id, info] of sessions) obj[id] = info
  const payload = JSON.stringify({ sessions: obj, updatedAt: new Date().toISOString() })
  writeFileSync(TMP, payload, "utf-8")
  renameSync(TMP, DATA)
}

load()

export default async () => {
  return {
    event: (input: unknown) => {
      const evt = input as Record<string, unknown>
      const props = evt?.properties as Record<string, unknown> | undefined
      let sessionID: string | null = null
      let cost: number | null = null
      let parentID: string | null | undefined

      if (evt?.type === "session.usage.updated" && props) {
        sessionID = props.sessionID as string
        cost = props.cost as number
      } else if (typeof evt?.sessionID === "string" && typeof evt?.cost === "number") {
        sessionID = evt.sessionID as string
        cost = evt.cost as number
        parentID = evt.parentID as string | null | undefined
      }

      if (sessionID && typeof cost === "number" && cost >= 0) {
        const prev = sessions.get(sessionID)
        if (!prev || cost !== prev.cost) {
          sessions.set(sessionID, {
            cost,
            parentID: parentID ?? prev?.parentID ?? null,
          })
          save()
        }
      }
    },
  }
}