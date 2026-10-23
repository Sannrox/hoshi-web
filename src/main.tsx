import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApiError } from "./api/http";
import { clearState } from "./lastState";
import { router } from "./router";
import { useSession } from "./session";
import "./styles.css";
import { worker } from "./worker";

const root = document.getElementById("root");
if (!root) {
  throw new Error("missing #root");
}

// A 401 on any call made while signed in means hoshi no longer accepts the token.
const endOnRefusal = (error: Error) => {
  if (error instanceof ApiError && error.status === 401 && useSession.getState().token) {
    useSession.getState().signOut("refused");
  }
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: endOnRefusal }),
  mutationCache: new MutationCache({ onError: endOnRefusal }),
  defaultOptions: { mutations: { networkMode: "always", retry: false } },
});

// Signing out drops every cached response that was fetched with the old token,
// and the offline copy of the game state.
useSession.subscribe((session, previous) => {
  if (previous.token && !session.token) {
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "server" });
    clearState();
  }
});

// A tapped notification in an open window: switch screens in place (see sw.js).
void worker.then((registration) => {
  if (!registration) {
    return;
  }
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent<unknown>) => {
    const { data } = event;
    if (typeof data === "object" && data !== null && "type" in data && data.type === "hoshi-open") {
      void router.navigate({ to: "view" in data && data.view === "cockpit" ? "/cockpit" : "/" });
    }
  });
});

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
