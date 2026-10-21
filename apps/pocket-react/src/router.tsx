// The routes: the root layout around every view, each view loaded on demand.
import { createBrowserRouter } from "react-router";
import { Layout } from "./routes/Layout.tsx";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: Layout,
      // While the first view's code loads, the console's frame already shows.
      HydrateFallback: Layout,
      children: [
        { index: true, lazy: () => import("./routes/Studio.tsx") },
        { path: "songs", lazy: () => import("./routes/Songs.tsx") },
        { path: "sfx", lazy: () => import("./routes/Sfx.tsx") },
        { path: "creatures", lazy: () => import("./routes/Creatures.tsx") },
        { path: "learn", lazy: () => import("./routes/Learn.tsx") },
        { path: "learn/composing", lazy: () => import("./routes/Composing.tsx") },
        { path: "*", lazy: () => import("./routes/NotFound.tsx") },
      ],
    },
  ],
  // Below the base path the build is served from; "/" maps to it with its trailing slash.
  { basename: import.meta.env.BASE_URL },
);
