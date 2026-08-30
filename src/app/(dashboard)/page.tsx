import { EmptyState } from '@/components/ui/empty-state';

/**
 * The order queue.
 *
 * Empty until Phase 3. It is the dashboard's home because the operator lives
 * here: statistics are something you go and look at, orders are something that
 * happens to you.
 */
export default function OrdersPage() {
  return (
    <EmptyState
      titleKey="orders.emptyTitle"
      bodyKey="orders.emptyBody"
      mood="waiting"
    />
  );
}
