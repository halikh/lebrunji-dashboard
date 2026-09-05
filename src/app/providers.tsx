"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { UnsavedChangesProvider } from "@/components/unsaved-changes";
import { ToastProvider } from "@/components/ui/toast";
import { createQueryClient } from "@/lib/query";

/**
 * Everything the signed-in screens need in scope.
 *
 * The query client is made inside `useState` rather than at module scope. A
 * module-level client is one client for the whole *server process*, shared
 * between everyone who requests a page — so one operator's orders can be served
 * out of another's cache. Per-mount is the only correct shape here, and the
 * initialiser form means it survives re-renders without being rebuilt.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {/* Outside the screens and inside the toaster: it guards every link in
            the shell, and a form that saves on its way out should still be able
            to raise a toast. */}
        <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
