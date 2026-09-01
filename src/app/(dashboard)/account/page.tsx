import { AccountScreen } from "@/features/account/account-screen";

/**
 * The operator's own sign-in.
 *
 * Its own route rather than a tab on Settings: Settings is the app's *prose* —
 * the help screen, the legal documents, the order timeline — and an operator's
 * password is not content the product shows anybody.
 */
export default function AccountPage() {
  return <AccountScreen />;
}
