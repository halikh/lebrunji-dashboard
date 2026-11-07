"use client";

import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { t } from "@/i18n/translations";
import {
  CHATGPT_URL,
  imagePrompt,
  isCutoutKind,
  takesHeadline,
  type ImagePromptKind,
} from "@/lib/image-prompts";

import { Button, buttonClass } from "./button";
import { cx } from "./cx";
import { Input } from "./form";

/**
 * "Make it with ChatGPT" — the house prompt for a required picture, ready to
 * copy, under its uploader.
 *
 * Closed by default: most of the time the picture already exists, and the
 * panel is one line until somebody needs it. Opened, it shows the whole
 * prompt rather than hiding it behind the button, so what is being asked for
 * can be read before it is pasted.
 *
 * The subject follows the form's English name until it is typed over here —
 * "Dairy" may be the aisle's name and "milk, eggs and cheese" a better thing
 * to draw. Kept as an override rather than copied into state, so a name typed
 * after the panel opened still reaches it.
 *
 * The style is not editable here, on purpose: see `lib/image-prompts.ts`.
 */
export function ImagePrompt({
  kind,
  subject,
  className,
}: {
  kind: ImagePromptKind;
  /** The thing's English name as the form has it now. */
  subject: string;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [ownSubject, setOwnSubject] = useState<string | null>(null);
  const [headline, setHeadline] = useState("");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const what = ownSubject ?? subject;
  const prompt = imagePrompt(kind, what, headline);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard refused (insecure context or denied) — the text below is
      // still there to select by hand.
    }
  }

  return (
    <div
      className={cx(
        "rounded-lg border border-line bg-subtle/60 text-[13px]",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-body`}
        onClick={() => setOpen((was) => !was)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start font-medium text-ink-2 hover:bg-hover/60"
      >
        <Sparkles className="size-4 shrink-0 text-accent" />
        <span className="flex-1">{t("imagePrompt.title")}</span>
        <ChevronRight
          className={cx(
            "size-4 shrink-0 text-ink-4 transition-transform",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div
          id={`${id}-body`}
          className="flex flex-col gap-3 border-t border-line px-3 pt-3 pb-3.5"
        >
          <p className="text-[12.5px] leading-snug text-ink-3">
            {t(`imagePrompt.intro.${kind}`)}
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium text-ink-2">
              {t(
                takesHeadline(kind)
                  ? "imagePrompt.idea"
                  : "imagePrompt.subject",
              )}
            </span>
            <Input
              value={what}
              onChange={(event) => setOwnSubject(event.target.value)}
              placeholder={t(
                takesHeadline(kind)
                  ? "imagePrompt.ideaPlaceholder"
                  : "imagePrompt.subjectPlaceholder",
              )}
            />
          </label>

          {takesHeadline(kind) && (
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium text-ink-2">
                {t("imagePrompt.headline")}
              </span>
              <Input
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
                placeholder={t("imagePrompt.headlinePlaceholder")}
              />
            </label>
          )}

          <pre
            aria-label={t("imagePrompt.promptLabel")}
            className="max-h-56 overflow-auto rounded-md border border-line bg-surface px-3 py-2.5 font-sans text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-2 select-all"
          >
            {prompt}
          </pre>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" onClick={copy}>
              {copied ? <Check /> : <Copy />}
              {copied ? t("common.copied") : t("imagePrompt.copy")}
            </Button>
            <a
              href={CHATGPT_URL}
              target="_blank"
              rel="noreferrer noopener"
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              <ExternalLink />
              {t("imagePrompt.open")}
            </a>
          </div>

          <ol className="list-decimal space-y-0.5 ps-4 text-[12px] leading-snug text-ink-3">
            <li>{t("imagePrompt.step1")}</li>
            <li>{t("imagePrompt.step2")}</li>
            {isCutoutKind(kind) && <li>{t("imagePrompt.stepCutout")}</li>}
            {takesHeadline(kind) && <li>{t("imagePrompt.stepArabic")}</li>}
          </ol>
        </div>
      )}
    </div>
  );
}
