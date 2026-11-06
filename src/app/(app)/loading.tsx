import { Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <div className="flex h-full items-center justify-center text-ink-4">
      <Spinner className="size-6" />
    </div>
  );
}
