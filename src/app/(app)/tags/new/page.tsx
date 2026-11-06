import { redirect } from "next/navigation";

/** A tag is edited in a sheet over the list; this is its address. */
export default function NewTagPage() {
  redirect("/tags?edit=new");
}
