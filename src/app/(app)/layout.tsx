import type { ReactNode } from "react";

import { Providers } from "@/app/providers";
import { AppShell } from "@/components/shell/app-shell";

export default function SignedInLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
