import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ApiError, apiRoot } from "../api/http";
import { useSession, verifyToken } from "../session";
import { Button, Callout, Dialog, Section } from "../ui";
import { watchLogin } from "./oidc";

const describe = (error: Error) => {
  if (error instanceof ApiError && error.status === 401) {
    return "Token refused.";
  }
  if (error instanceof ApiError && error.status === 429) {
    return "Too many attempts. Try again later.";
  }
  return error.message;
};

/** Sign in with a pasted bearer token, or through hoshi's identity login when the server has it on. */
export const SignIn = () => {
  const ended = useSession((s) => s.ended);
  const signIn = useSession((s) => s.signIn);
  const [token, setToken] = useState("");
  const [note, setNote] = useState<string>();
  const [watching, setWatching] = useState(false);
  const login = useRef<AbortController>(undefined);
  useEffect(() => () => login.current?.abort(), []);

  const verify = useMutation({
    mutationFn: (candidate: string) => verifyToken(candidate),
    onSuccess: (_, candidate) => signIn(candidate),
  });

  // One sign-in attempt at a time, so a late answer cannot replace or end a newer session.
  const busy = verify.isPending || watching;

  const identityLogin = async () => {
    setNote(undefined);
    const popup = window.open(new URL("v1/oidc/start", apiRoot), "hoshi-login", "popup");
    if (!popup) {
      setNote("The browser blocked the login window.");
      return;
    }
    login.current = new AbortController();
    setWatching(true);
    const result = await watchLogin(popup, login.current.signal);
    setWatching(false);
    if (result === "closed") {
      setNote("Login window closed. Paste the token it showed, if any.");
    } else if (result.kind === "refused") {
      setNote(`Identity login refused: ${result.message}.`);
    } else {
      signIn(result.token);
    }
  };

  return (
    <form
      className="max-w-md px-2"
      onSubmit={(event) => {
        event.preventDefault();
        verify.mutate(token.trim());
      }}
    >
      <Dialog
        title="Sign in"
        subtitle="token or identity login"
        buttons={
          <>
            <Button disabled={busy} onClick={() => void identityLogin()}>
              Identity login
            </Button>
            <Button primary type="submit" disabled={busy}>
              Sign in
            </Button>
          </>
        }
      >
        {ended === "refused" && (
          <Callout intent="danger">Session ended: the server refused the token.</Callout>
        )}
        {ended === "signed-out" && <Callout intent="neutral">Signed out.</Callout>}
        <label className="flex flex-col gap-1">
          <Section>Token</Section>
          <input
            type="password"
            autoComplete="off"
            required
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="border border-line bg-base px-1 focus:border-primary focus:outline-none"
          />
        </label>
        {verify.error && <Callout intent="danger">{describe(verify.error)}</Callout>}
        {note && <Callout intent="warning">{note}</Callout>}
      </Dialog>
    </form>
  );
};
