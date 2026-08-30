import { Wordmark } from '@/components/brand/wordmark';
import { SignOutButton } from '@/components/sign-out-button';
import { getSignedInUser } from '@/lib/supabase/server';

/**
 * Placeholder.
 *
 * This becomes the order queue — the dashboard opens on live orders rather than
 * on a statistics page, because statistics are something you go and look at and
 * orders are something that happens to you. For now it proves the session
 * reaches the server, and carries sign-out until the shell exists to hold it.
 */
export default async function HomePage() {
  const user = await getSignedInUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-lg border-b border-border bg-surface px-xxl py-lg">
        <Wordmark scale={0.5} />
        <div className="flex items-center gap-lg">
          <span className="text-[14px] text-text-soft">{user?.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex-1 p-xxl" />
    </div>
  );
}
