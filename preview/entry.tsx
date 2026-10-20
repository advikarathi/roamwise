// Static preview: the same app, with the agents running in the browser on demo data.
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "../app/globals.css";
import { createRoot } from "react-dom/client";
import { App } from "../components/App";

createRoot(document.getElementById("root")!).render(<App mode="local" />);
