import { useQuery } from "@tanstack/react-query";
import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { checkServer, consoleRoot } from "./api/http";
import { SignIn } from "./screens/SignIn";
import { useSession } from "./session";
import { Button, Navbar } from "./ui";

/** Gate every screen on a reachable, compatible hoshi server and a signed-in session. */
const Root = () => {
  const token = useSession((s) => s.token);
  const signOut = useSession((s) => s.signOut);
  const server = useQuery({
    queryKey: ["server"],
    queryFn: () => checkServer(),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  if (!server.data) {
    return <p>{server.error ? `Could not load: ${server.error.message}` : "Connecting"}</p>;
  }
  if (server.data.kind !== "ready") {
    return <p>hoshi {server.data.version} is too old for this client.</p>;
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar
        crumbs={[token ? "Home" : "Sign in"]}
        right={
          <>
            <span className="text-muted">{server.data.version}</span>
            {token && <Button onClick={() => signOut()}>Sign out</Button>}
          </>
        }
      />
      <main className="p-2">{token ? <Outlet /> : <SignIn />}</main>
    </div>
  );
};

const rootRoute = createRootRoute({ component: Root });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <p>Signed in.</p>,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute]),
  basepath: consoleRoot.pathname,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
