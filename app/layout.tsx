import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roamwise",
  description: "Set a budget and a vibe. A crew of AI agents plans your flights, stay and things to do.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#e6f0ff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
