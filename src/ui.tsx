import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Web versions of the hoshi TUI widgets (crates/hoshi-tui/src/ui), drawn with
 * the Slate roles from `styles.css`.
 */

/** Top bar: `◆ hoshi │ crumbs`, with `right` flush right. */
export const Navbar = ({ crumbs, right }: { crumbs: string[]; right?: ReactNode }) => (
  <header className="flex items-center gap-2 bg-raised px-2 py-1">
    <span className="font-bold text-primary">◆ hoshi</span>
    <span className="text-line">│</span>
    {crumbs.map((crumb, i) => (
      <span key={crumb} className={i === crumbs.length - 1 ? "font-bold" : "text-muted"}>
        {i > 0 && <span className="text-label"> / </span>}
        {crumb}
      </span>
    ))}
    <span className="ml-auto flex items-center gap-2">{right}</span>
  </header>
);

/** Window: header bar with `▦ title  subtitle`, raised body, footer bar with right-aligned buttons. */
export const Dialog = ({
  title,
  subtitle,
  buttons,
  children,
}: {
  title: string;
  subtitle?: string;
  buttons: ReactNode;
  children: ReactNode;
}) => (
  <section className="flex flex-col bg-raised">
    <div className="flex gap-3 bg-header px-2 py-1">
      <span>
        <span className="text-primary">▦ </span>
        <span className="font-bold">{title}</span>
      </span>
      {subtitle && <span className="text-muted">{subtitle}</span>}
    </div>
    <div className="flex flex-col gap-2 p-2">{children}</div>
    <div className="flex justify-end gap-2 bg-header px-2 py-1">{buttons}</div>
  </section>
);

/** Filled button: primary in the primary fill, others on the keycap grey. */
export const Button = ({
  primary,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) => (
  <button
    type="button"
    className={`px-2 disabled:opacity-50 ${primary ? "bg-primary-fill font-bold text-white" : "bg-key"} ${className ?? ""}`}
    {...props}
  />
);

/** Uppercase muted label that opens a block, such as `TOKEN`. */
export const Section = ({ children }: { children: ReactNode }) => (
  <span className="text-label uppercase">{children}</span>
);

const intents = {
  neutral: "text-muted",
  danger: "text-danger",
  warning: "text-warning",
  success: "text-success",
  primary: "text-primary",
};

/** Alert with an intent-coloured `▌` bar. */
export const Callout = ({
  intent,
  children,
}: {
  intent: keyof typeof intents;
  children: ReactNode;
}) => (
  <p role={intent === "danger" ? "alert" : "status"} className={intents[intent]}>
    ▌ {children}
  </p>
);
