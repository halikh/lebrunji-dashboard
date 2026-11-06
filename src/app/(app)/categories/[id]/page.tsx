import { redirect } from "next/navigation";

/** A category is edited in a sheet over the list; this is its address. */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/categories?edit=${encodeURIComponent(id)}`);
}
