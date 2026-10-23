import { useQuery } from "@tanstack/react-query";
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Link,
  Outlet,
  useMatchRoute,
} from "@tanstack/react-router";
import { checkServer, consoleRoot } from "./api/http";
import { CheckIn, OfflineCheckIn } from "./screens/CheckIn";
import { SignIn } from "./screens/SignIn";
import { useSession } from "./session";
import { Button, Navbar } from "./ui";

/** Gate every screen on a reachable, compatible hoshi server and a signed-in session. */
const Root = () => {
  const token = useSession((s) => s.token);
  const signOut = useSession((s) => s.signOut);
  // The terminal fills the window; other screens scroll the page.
  const onTerminal = Boolean(useMatchRoute()({ to: "/terminal" }));
  const server = useQuery({
    queryKey: ["server"],
    queryFn: () => checkServer(),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    // Unreachable: keep trying, so the client leaves the offline view on its own.
    refetchInterval: (query) => (query.state.error ? 10_000 : false),
  });
  if (!server.data) {
    return server.error ? <OfflineCheckIn error={server.error} /> : <p>Connecting</p>;
  }
  if (server.data.kind !== "ready") {
    return <p>hoshi {server.data.version} is too old for this client.</p>;
  }
  return (
    <div className={`flex flex-col ${onTerminal ? "h-dvh" : "min-h-dvh"}`}>
      <Navbar
        crumbs={[token ? (onTerminal ? "Terminal" : "Check-in") : "Sign in"]}
        right={
          <>
            <span className="text-muted">{server.data.version}</span>
            {token && (
              <Link
                to={onTerminal ? "/" : "/terminal"}
                className="flex min-h-11 items-center bg-key px-2"
              >
                {onTerminal ? "Check-in" : "Terminal"}
              </Link>
            )}
            {token && (
              <Button className="min-h-11" onClick={() => signOut()}>
                Sign out
              </Button>
            )}
          </>
        }
      />
      <main className={`py-2 ${onTerminal ? "flex min-h-0 flex-1 flex-col" : ""}`}>
        {token ? <Outlet /> : <SignIn />}
      </main>
    </div>
  );
};

const rootRoute = createRootRoute({ component: Root });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: CheckIn,
});

const terminalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terminal",
  // xterm is large; only players who open the terminal download it.
  component: lazyRouteComponent(() => import("./screens/Terminal"), "Terminal"),
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, terminalRoute]),
  basepath: consoleRoot.pathname,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
