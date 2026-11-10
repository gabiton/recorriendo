import { GuestOnly } from "../components/session-provider";

// Access depends on the session request in the shared client provider.
export const instant = false;

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <GuestOnly>{children}</GuestOnly>;
}
