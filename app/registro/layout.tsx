import { GuestOnly } from "../components/session-provider";

export const instant = false;

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <GuestOnly>{children}</GuestOnly>;
}
