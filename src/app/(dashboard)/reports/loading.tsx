import { PageLoader } from "@/components/ui/loader";

/**
 * What fills the pane while this route is being fetched.
 *
 * Next renders this from the moment a navigation starts until the page is
 * ready, which is what stops a click on the rail doing nothing visible on a
 * cold cache. It is per-route rather than one at the layout, so the rail and
 * the header stay put and only the pane changes — a whole-screen spinner would
 * take away the navigation the operator is still using.
 *
 * The spinner holds itself back for 200ms — see `PageLoader`.
 */
export default function Loading() {
  return <PageLoader />;
}
