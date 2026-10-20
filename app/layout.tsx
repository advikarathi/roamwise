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

// Travelpayouts "Drive" (partner 588162): verifies the site with the Travelpayouts affiliate program,
// which unlocks the flight data API, and can turn outbound travel links into affiliate links.
// It's the snippet Travelpayouts provides, rendered in <head> so their checker finds it in the HTML.
const TRAVELPAYOUTS_DRIVE = `(function () {
  var script = document.createElement("script");
  script.async = 1;
  script.setAttribute("data-cmp-ab", "2");
  script.src = "https://emrldco.com/NTg4MTYy.js?t=588162";
  document.head.appendChild(script);
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script data-cmp-ab="2" dangerouslySetInnerHTML={{ __html: TRAVELPAYOUTS_DRIVE }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
