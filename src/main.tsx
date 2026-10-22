import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApiError } from "./api/http";
import { router } from "./router";
import { useSession } from "./session";
import "./styles.css";

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

// Signing out drops every cached response that was fetched with the old token.
useSession.subscribe((session, previous) => {
  if (previous.token && !session.token) {
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "server" });
  }
});

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
