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
import { Cockpit } from "./screens/Cockpit";
import { SignIn } from "./screens/SignIn";
import { useSession } from "./session";
import { Button, Navbar } from "./ui";

/** Screens in the top bar: the phone check-in, the wide cockpit, and hoshi's own TUI. */
const screens = [
  { to: "/", label: "Check-in" },
  { to: "/cockpit", label: "Cockpit" },
  { to: "/terminal", label: "Terminal" },
] as const;

/** Gate every screen on a reachable, compatible hoshi server and a signed-in session. */
const Root = () => {
  const token = useSession((s) => s.token);
  const signOut = useSession((s) => s.signOut);
  const matchRoute = useMatchRoute();
  const current = screens.find((screen) => matchRoute({ to: screen.to })) ?? screens[0];
  // The terminal fills the window; other screens scroll the page.
  const onTerminal = current.to === "/terminal";
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
        crumbs={[token ? current.label : "Sign in"]}
        right={
          <>
            <span className="hidden text-muted sm:inline">{server.data.version}</span>
            {token &&
              screens
                .filter((screen) => screen !== current)
                .map((screen) => (
                  <Link
                    key={screen.to}
                    to={screen.to}
                    className="flex min-h-11 items-center bg-key px-2"
                  >
                    {screen.label}
                  </Link>
                ))}
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

const cockpitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/cockpit",
  component: Cockpit,
});

const terminalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terminal",
  // xterm is large; only players who open the terminal download it.
  component: lazyRouteComponent(() => import("./screens/Terminal"), "Terminal"),
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, cockpitRoute, terminalRoute]),
  basepath: consoleRoot.pathname,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
