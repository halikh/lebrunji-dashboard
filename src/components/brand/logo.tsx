/** The Lebrunji wordmark, as the old dashboard's sign-in page drew it. */
export function Logo({
  width,
  variant = "wide",
  priority = false,
  className,
}: {
  width: number;
  variant?: "stacked" | "wide";
  priority?: boolean;
  className?: string;
}) {
  const art = ART[variant];
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={art.src}
      alt="LebRunji"
      width={width}
      height={Math.round(width / art.aspect)}
      fetchPriority={priority ? "high" : undefined}
      draggable={false}
      className={className}
    />
  );
}

const ART = {
  stacked: { src: "/brand/lebrunji-logo-stacked.svg", aspect: 429 / 602 },
  wide: { src: "/brand/lebrunji-logo.svg", aspect: 686 / 496 },
} as const;
