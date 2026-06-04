import { BrandMark } from "./BrandMark";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="group flex items-center gap-2.5">
        <BrandMark className="size-9 shrink-0 transition-transform duration-200 group-hover:scale-[1.04]" />
        <div className="leading-tight">
          {/* Two-tone wordmark: "Cooper" in royal blue, "Standard" in
              brand gold — same chromatic split as the swoosh in the mark. */}
          <div className="text-[14px] font-semibold tracking-tight">
            <span className="text-[#0E4DA1] dark:text-primary">Cooper</span>
            <span className="text-[color:oklch(0.62_0.13_82)] dark:text-[color:oklch(0.83_0.16_88)]">
              Standard
            </span>
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Usage Monitor
          </div>
        </div>
      </div>
    </div>
  );
}
