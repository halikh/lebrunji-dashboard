import { DriverProfile } from "@/features/drivers/driver-profile";

/**
 * One driver's page.
 *
 * `params` is a promise in Next 16, so the id is awaited here and the screen
 * takes a plain string — a client component cannot await one.
 */
export default async function DriverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DriverProfile id={id} />;
}
