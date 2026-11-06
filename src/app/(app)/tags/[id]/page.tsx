import { redirect } from "next/navigation";

/** A tag is edited in a sheet over the list; this is its address. */
export default async function TagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/tags?edit=${encodeURIComponent(id)}`);
}
