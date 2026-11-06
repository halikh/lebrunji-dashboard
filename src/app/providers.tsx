"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { TooltipProvider } from "@/components/ui";
import { ToastProvider } from "@/components/ui/toast";
import { UnsavedChangesProvider } from "@/components/unsaved-changes";
import { createQueryClient } from "@/lib/query";

/**
 * The query client lives in `useState`, not at module scope: a module-level
 * client is shared by everyone the server renders for.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={300}>
        <ToastProvider>
          <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
        </ToastProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
