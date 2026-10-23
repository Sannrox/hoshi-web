import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal as Xterm } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiRoot } from "../api/http";
import { socketUrl } from "../api/socket";
import { useSession, verifyToken } from "../session";
import { Button, Callout } from "../ui";
import { cspDocument } from "./cspDocument";
import { type LinkStatus, linkTerminal } from "./terminalLink";

// Slate roles from styles.css, so the terminal matches the TUI it draws.
const theme = { background: "#1c2127", foreground: "#f6f7f9", cursor: "#4c90f0" };

/** Whether the page's CSP lets a style attribute take effect. */
const inlineStylesApply = () => {
  const probe = document.createElement("span");
  probe.setAttribute("style", "color: red");
  return probe.style.color === "red";
};

/**
 * WebGL draws cells on a canvas, without the inline styles a strict CSP refuses
 * (see cspDocument.ts). Without it xterm's DOM renderer colours cells with
 * inline styles; where the CSP blocks those the TUI would lose its colours and
 * selection, so the terminal is not offered.
 */
const canDraw = () =>
  document.createElement("canvas").getContext("webgl2") !== null || inlineStylesApply();

type Status = LinkStatus | "undrawable";

const notes: Record<Status, string | undefined> = {
  connecting: "Connecting",
  attached: undefined,
  reconnecting: "Connection lost. Reattaching; keys typed now are not sent.",
  ended: "Session ended. The save is free.",
  refused: "hoshi refused the terminal. Another terminal session may hold the save.",
  undrawable: "This browser cannot draw the terminal: WebGL is off.",
};

/** One terminal session; "Start again" mounts a fresh one. */
const Session = ({ token, restart }: { token: string; restart: () => void }) => {
  const signOut = useSession((s) => s.signOut);
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>(() => (canDraw() ? "connecting" : "undrawable"));
  const drawable = status !== "undrawable";

  useEffect(() => {
    const element = host.current;
    if (!element || !drawable) {
      return undefined;
    }
    const term = new Xterm({
      theme,
      fontFamily: getComputedStyle(element).fontFamily,
      fontSize: 14,
      // The TUI draws on the alternate screen; no scrollback, so no scrollbar gutter.
      scrollback: 0,
      documentOverride: cspDocument(document),
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(element);
    const link = linkTerminal({
      url: socketUrl("v1/terminal", apiRoot),
      token,
      onOutput: (bytes) => term.write(bytes),
      onStatus: setStatus,
    });
    // Draw with WebGL, again after a lost context; where neither it nor the DOM
    // renderer can draw, leave the session so it does not hold the save.
    const draw = () => {
      const webgl = new WebglAddon();
      try {
        term.loadAddon(webgl);
        webgl.onContextLoss(() => {
          webgl.dispose();
          draw();
        });
      } catch {
        webgl.dispose();
        if (!inlineStylesApply()) {
          link.stop();
          setStatus("undrawable");
        }
      }
    };
    draw();
    const typed = term.onData((data) => link.input(data));
    const sized = term.onResize(({ cols, rows }) => link.resize(cols, rows));
    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(element);
    fit.fit();
    term.focus();
    return () => {
      observer.disconnect();
      typed.dispose();
      sized.dispose();
      link.stop();
      term.dispose();
    };
  }, [token, drawable]);

  // A browser cannot see why a socket was refused; a refused token ends the session.
  useEffect(() => {
    if (status !== "refused") {
      return;
    }
    verifyToken(token).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        signOut("refused");
      }
    });
  }, [status, token, signOut]);

  const note = notes[status];
  const over = status === "ended" || status === "refused" || status === "undrawable";
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2">
      {note && (
        <div className="flex min-h-11 items-center gap-2">
          <Callout intent={over ? "warning" : "neutral"}>{note}</Callout>
          {over && (
            <Button primary className="ml-auto min-h-11" onClick={restart}>
              Start again
            </Button>
          )}
        </div>
      )}
      <div ref={host} className={`min-h-0 flex-1 overflow-hidden ${over ? "opacity-50" : ""}`} />
    </div>
  );
};

/**
 * hoshi's own TUI in the browser, run by `hoshi serve` over `/v1/terminal`.
 * While it is attached, hoshi refuses game actions from other screens.
 */
export const Terminal = () => {
  const token = useSession((s) => s.token);
  const [attempt, setAttempt] = useState(0);
  return token ? (
    <Session key={attempt} token={token} restart={() => setAttempt((n) => n + 1)} />
  ) : null;
};
