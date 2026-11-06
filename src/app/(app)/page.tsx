import { redirect } from "next/navigation";

/** Signing in lands on the live queue — orders come first. */
export default function Home() {
  redirect("/orders");
}
