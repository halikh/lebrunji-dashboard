import { AccountScreen } from "@/features/account/account-screen";

export const metadata = { title: "Your account" };

/**
 * The operator's own sign-in. Its own route rather than a tab on Settings:
 * Settings is the shop's, and an operator's password belongs to one person.
 */
export default function AccountPage() {
  return <AccountScreen />;
}
