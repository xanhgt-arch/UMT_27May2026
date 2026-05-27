export const routePreloaders = {
  "/": () => import("@/pages/Home"),
  "/reports": () => import("@/pages/Reports"),
  "/sessions": () => import("@/pages/Sessions"),
  "/vdi": () => import("@/pages/VdiUsers"),
  "/domains": () => import("@/pages/Domains"),
  "*": () => import("@/pages/NotFound"),
}

type AppRoutePath = keyof typeof routePreloaders

const preloadedRoutes = new Set<AppRoutePath>()

function isAppRoutePath(path: string): path is AppRoutePath {
  return path in routePreloaders
}

export function preloadRoute(path: string) {
  if (!isAppRoutePath(path) || preloadedRoutes.has(path)) return

  preloadedRoutes.add(path)
  void routePreloaders[path]().catch(() => {
    preloadedRoutes.delete(path)
  })
}
