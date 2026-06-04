import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePalette, type PaletteDef } from "@/components/palette-provider";
import { cn } from "@/lib/utils";

function PaletteOption({
  def,
  active,
  onSelect,
}: {
  def: PaletteDef;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:bg-muted",
        active && "border-border bg-muted/70",
      )}
      aria-pressed={active}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium leading-tight">{def.name}</div>
        <div className="truncate text-[11px] text-muted-foreground leading-tight">
          {def.description}
        </div>
        <div className="mt-1.5 flex items-center gap-0.5">
          {def.light.map((color, i) => (
            <span
              key={i}
              className="block h-3.5 w-4 first:rounded-l-sm last:rounded-r-sm"
              style={{ background: color }}
            />
          ))}
        </div>
      </div>
      <Check
        className={cn(
          "size-4 shrink-0 text-primary transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      />
    </button>
  );
}

export function PaletteSwitcher() {
  const { palette, setPalette, palettes } = usePalette();
  const current = palettes.find((p) => p.id === palette);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          aria-label={`Chart palette: ${current?.name ?? palette}. Click to change.`}
        >
          <Palette className="size-[18px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="px-2 pb-1 pt-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Chart palette
          </div>
          <p className="text-[11px] text-muted-foreground/80">
            Applies to every chart on every page.
          </p>
        </div>
        <div className="mt-1 space-y-0.5">
          {palettes.map((def) => (
            <PaletteOption
              key={def.id}
              def={def}
              active={def.id === palette}
              onSelect={() => setPalette(def.id)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
