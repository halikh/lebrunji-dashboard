import { t, type TranslationKey } from "@/i18n/translations";

/**
 * A section that exists in the rail and does not exist yet.
 *
 * The alternative — leaving these out of the rail until they are built — makes
 * the shape of the finished product invisible, and every new section then
 * arrives as a surprise change to the navigation. Showing them empty is
 * honest, and it is the layout the real screen will land into.
 *
 * It names the phase rather than saying "coming soon". "Soon" tells the
 * operator nothing about whether to wait five minutes or go and use the SQL
 * editor; a phase number is at least a thing that can be looked up and asked
 * about.
 */
export function NotBuilt({
  sectionKey,
  phase,
}: {
  sectionKey: TranslationKey;
  phase: number;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-sm px-xxl py-huge text-center">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-text-faint">
        {t(sectionKey)}
      </p>
      <h2 className="text-[18px]">{t("shell.notBuiltTitle")}</h2>
      <p className="max-w-[380px] text-[14px] text-text-soft">
        {/* The phase number goes *through* the string rather than being
            appended to it. Appending reads fine in English and is unbuildable
            in a language that puts the number somewhere else in the sentence. */}
        {t("shell.notBuiltBody", { phase })}
      </p>
    </div>
  );
}
