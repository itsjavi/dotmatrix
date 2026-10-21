import "@fontsource/silkscreen/400.css";
import "@fontsource-variable/space-grotesk/index.css";
import "./global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { position } from "./audio/player.ts";
import { router } from "./router.tsx";
import { currentSong } from "./state/studio.ts";

// A small handle for the e2e tests and the curious.
Object.assign(globalThis, { dotmatrix: { position, song: currentSong } });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
