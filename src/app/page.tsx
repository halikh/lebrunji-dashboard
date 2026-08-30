import { Wordmark } from '@/components/brand/wordmark';
import { getSignedInUser } from '@/lib/supabase/server';

/**
 * Placeholder.
 *
 * This becomes the order queue — the dashboard opens on live orders rather than
 * on a statistics page, because statistics are something you go and look at and
 * orders are something that happens to you. For now it only proves the session
 * reaches the server.
 */
export default async function HomePage() {
  const user = await getSignedInUser();

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-xxl p-xxl">
      <Wordmark />
      <p className="text-[14px] text-text-soft">{user?.email}</p>
    </main>
  );
}
