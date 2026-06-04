import { NavLink } from "react-router-dom";
import {
  Home,
  Network,
  Users,
} from "lucide-react";
import { Logo } from "./Logo";
import { BrandMark } from "./BrandMark";
import { ParticleBackground } from "./ParticleBackground";
import { Separator } from "@/components/ui/separator";
import { preloadRoute } from "@/lib/route-preload";

type Item = {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
};

const NAV_PRIMARY: Item[] = [
  { to: "/",         icon: Home,       label: "Home",       description: "Headline overview" },
];

const NAV_ADMIN: Item[] = [
  { to: "/vdi",     icon: Users,   label: "VDI users", description: "Manage virtual desktop users" },
  { to: "/domains", icon: Network, label: "Domains",   description: "Map domains to corporate groups" },
];

function linkClasses(isActive: boolean) {
  return [
    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
    isActive
      ? "bg-accent text-accent-foreground font-medium"
      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-accent-foreground",
  ].join(" ");
}

function Item({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) => linkClasses(isActive)}
      onFocus={() => preloadRoute(item.to)}
      onMouseEnter={() => preloadRoute(item.to)}
    >
      {({ isActive }) => (
        <>
          {/* Gold rail on the active row — picks up the warm half of the
              CS swoosh and gives the navigation a strong brand anchor. */}
          {isActive ? (
            <span
              aria-hidden
              className="pointer-events-none absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-[oklch(0.83_0.16_88)]"
            />
          ) : null}
          <Icon
            className={[
              "size-[18px] shrink-0 transition-colors",
              // Inactive items lift toward blue on hover; active items keep blue.
              // The gold rail does the warm half of the swoosh on its own.
              isActive
                ? "text-primary"
                : "text-muted-foreground group-hover:text-[#0E4DA1] dark:group-hover:text-primary",
            ].join(" ")}
          />
          <span
            className={[
              "truncate transition-colors",
              isActive
                ? "text-primary"
                : "group-hover:text-[#0E4DA1] dark:group-hover:text-primary",
            ].join(" ")}
          >
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  return (
    <aside
      className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-border bg-sidebar/82 backdrop-blur-md md:flex"
      aria-label="Primary"
    >
      {/* Vertical brand gradient acting as the sidebar's right border -
          echoes the horizontal hairline at the top of the viewport so
          the chrome reads as one continuous frame in CS colors. */}
      <span
        aria-hidden
        className="brand-hairline-v pointer-events-none absolute top-0 right-0 bottom-0 z-20 w-[3px]"
      />

      {/* Denser, smaller drift bounded to the sidebar column. */}
      <ParticleBackground variant="sidebar" />

      {/* All sidebar content lifts above the particle field. */}
      <div className="relative z-10 flex h-full flex-col overflow-y-auto">
        <div className="px-5 pt-6 pb-4">
          <Logo />
        </div>

        <nav className="flex flex-col gap-1 px-3" aria-label="Main pages">
        <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Workspace
        </div>
        {NAV_PRIMARY.map((item) => (
          <Item key={item.to} item={item} />
        ))}
      </nav>

      <Separator className="my-4" />

      <nav className="flex flex-col gap-1 px-3" aria-label="Administration">
        <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Administration
        </div>
        {NAV_ADMIN.map((item) => (
          <Item key={item.to} item={item} />
        ))}
      </nav>

      <div className="mt-auto p-4">
        {/* Brand sign-off — large, faded CS mark watermark with version line.
            Anchors the sidebar in the same brand language as the header chip
            and the top-of-viewport hairline. */}
        <div className="relative mt-3 overflow-hidden rounded-xl border border-border bg-card/60 px-4 py-3">
          <BrandMark
            aria-hidden
            className="pointer-events-none absolute -right-3 -bottom-3 size-20 opacity-[0.10]"
          />
          <div className="relative flex items-center gap-2">
            <BrandMark className="size-5 shrink-0" />
            <div className="leading-tight">
              <div className="text-[11px] font-semibold tracking-tight">
                <span className="text-[#0E4DA1] dark:text-primary">Cooper</span>{" "}
                <span className="text-[color:oklch(0.62_0.13_82)] dark:text-[color:oklch(0.83_0.16_88)]">
                  Standard
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                UMT v1.0 · Internal
              </div>
            </div>
          </div>
          <div className="brand-hairline relative mt-3 h-[2px] rounded-full opacity-80" />
        </div>
      </div>
      </div>
    </aside>
  );
}
