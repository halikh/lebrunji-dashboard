import { redirect } from "next/navigation";

/** A category is edited in a sheet over the list; this is its address. */
export default function NewCategoryPage() {
  redirect("/categories?edit=new");
}
