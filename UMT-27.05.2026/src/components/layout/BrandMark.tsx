/**
 * Cooper Standard CS swoosh mark — official PNG asset.
 *
 * The asset lives in `public/cooper-mark.png` (transparent background,
 * 512×341, RGBA) so it ships unmodified and renders crisply at every
 * call-site size (18 → 80px). object-contain keeps the swoosh proportional
 * inside the consumer's square bounding box without distorting it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/cooper-mark.png"
      alt="Cooper Standard"
      draggable={false}
      className={[
        "select-none object-contain",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
