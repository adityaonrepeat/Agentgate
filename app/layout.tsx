import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "AgentGate | AI approval inbox",
  description: "Payload-bound, single-use approvals for simulated AI actions.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
