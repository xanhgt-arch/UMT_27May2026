import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { AppLoadingScreen } from "@/components/AppLoadingScreen"
import type { DomainRecord, VdiUserRecord } from "./types"

type AdminCtx = {
  vdiUsers: VdiUserRecord[]
  upsertVdiUser: (record: VdiUserRecord) => void
  removeVdiUser: (id: string) => void

  domainRecords: DomainRecord[]
  upsertDomainRecord: (record: DomainRecord) => void
  removeDomainRecord: (id: string) => void
}

const Ctx = createContext<AdminCtx | null>(null)

const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined
const normalizedBackendUrl = backendUrl?.replace(/\/$/, "")

const VDI_DATA_URLS = [
  normalizedBackendUrl
    ? `${normalizedBackendUrl}/api/export/vdi-json`
    : undefined,
  "/api/export/vdi-json",
  "/static/vdi.json",
].filter((url): url is string => Boolean(url))

const DOMAIN_DATA_URLS = [
  normalizedBackendUrl
    ? `${normalizedBackendUrl}/api/export/domains-json`
    : undefined,
  "/api/export/domains-json",
  "/static/domains.json",
].filter((url): url is string => Boolean(url))

async function loadJsonWithFallback<T>(urls: readonly string[]): Promise<T> {
  let lastError: unknown

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = (await response.json()) as T
      if (!Array.isArray(data)) {
        throw new Error("Response was not an array")
      }

      return data
    } catch (error) {
      lastError = error
    }
  }

  throw new Error(
    `Failed to load admin data: ${
      lastError instanceof Error ? lastError.message : "Unknown error"
    }`,
  )
}

function nextId(prefix: string, existing: { id: string }[]): string {
  const max = existing
    .map((r) => parseInt(r.id.replace(`${prefix}-`, ""), 10))
    .filter((n) => Number.isFinite(n))
    .reduce((m, n) => Math.max(m, n), 0)
  return `${prefix}-${String(max + 1).padStart(3, "0")}`
}

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const [vdiUsers, setVdiUsers] = useState<VdiUserRecord[] | null>(null)
  const [domainRecords, setDomainRecords] = useState<DomainRecord[] | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false

    async function loadAdminData() {
      const [loadedVdiUsers, loadedDomainRecords] = await Promise.all([
        loadJsonWithFallback<VdiUserRecord[]>(VDI_DATA_URLS),
        loadJsonWithFallback<DomainRecord[]>(DOMAIN_DATA_URLS),
      ])

      if (!cancelled) {
        setVdiUsers(loadedVdiUsers)
        setDomainRecords(loadedDomainRecords)
      }
    }

    void loadAdminData()

    return () => {
      cancelled = true
    }
  }, [])

  const upsertVdiUser = useCallback((record: VdiUserRecord) => {
    setVdiUsers((prev) => {
      const records = prev ?? []
      const idx = records.findIndex((u) => u.id === record.id)
      if (idx === -1) return [{ ...record }, ...records]
      const copy = [...records]
      copy[idx] = { ...record }
      return copy
    })
  }, [])

  const removeVdiUser = useCallback((id: string) => {
    setVdiUsers((prev) => (prev ?? []).filter((u) => u.id !== id))
  }, [])

  const upsertDomainRecord = useCallback((record: DomainRecord) => {
    setDomainRecords((prev) => {
      const records = prev ?? []
      const idx = records.findIndex((d) => d.id === record.id)
      if (idx === -1) return [{ ...record }, ...records]
      const copy = [...records]
      copy[idx] = { ...record }
      return copy
    })
  }, [])

  const removeDomainRecord = useCallback((id: string) => {
    setDomainRecords((prev) => (prev ?? []).filter((d) => d.id !== id))
  }, [])

  const value = useMemo<AdminCtx>(
    () => ({
      vdiUsers: vdiUsers ?? [],
      upsertVdiUser,
      removeVdiUser,
      domainRecords: domainRecords ?? [],
      upsertDomainRecord,
      removeDomainRecord,
    }),
    [
      vdiUsers,
      upsertVdiUser,
      removeVdiUser,
      domainRecords,
      upsertDomainRecord,
      removeDomainRecord,
    ]
  )

  if (!vdiUsers || !domainRecords) {
    return <AppLoadingScreen label="Loading dashboard data" />
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAdminData(): AdminCtx {
  const ctx = useContext(Ctx)
  if (!ctx)
    throw new Error("useAdminData must be used inside <AdminDataProvider>")
  return ctx
}

export function newVdiId(records: { id: string }[]): string {
  return nextId("vdi", records)
}
export function newDomId(records: { id: string }[]): string {
  return nextId("dom", records)
}
