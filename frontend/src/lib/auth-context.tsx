import { createContext, useContext, useEffect, useMemo, useState } from "react"

type CurrentUser = {
  identityName: string
  userId: string
  isAuthenticated: boolean
  isAdmin: boolean
  role: string
}

type AuthCtx = {
  user: CurrentUser | null
  loading: boolean
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadCurrentUser() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          headers: { Accept: "application/json" },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as CurrentUser
        if (!cancelled) setUser(data)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadCurrentUser()

    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthCtx>(() => ({ user, loading }), [user, loading])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
