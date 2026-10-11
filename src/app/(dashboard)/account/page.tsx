import { AccountScreen } from "@/features/account/account-screen";

/**
 * The operator's own sign-in.
 *
 * Its own route rather than a tab on Settings: Settings is the shop's — its
 * hours, its sound, the words customers read — and an operator's password
 * belongs to one person.
 */
export default function AccountPage() {
  return <AccountScreen />;
}
