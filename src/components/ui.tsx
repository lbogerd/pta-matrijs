import { type ReactNode } from "react";
import { LoaderCircle, X, ArrowRight } from "lucide-react";
export const statuses: Record<string, string> = {
  draft: "Concept",
  "peer-reviewed": "Collegiaal gecontroleerd",
  reviewing: "Commissiebeoordeling",
  withdrawn: "Ingetrokken",
  reviewed: "Collegiaal gecontroleerd",
  submitted: "Ingediend",
  released: "Vrijgegeven",
  revoked: "Ingetrokken",
  returned: "Teruggestuurd",
  approved: "Vrijgegeven",
};
export function Badge({
  status,
  children,
}: {
  status?: string;
  children?: ReactNode;
}) {
  return (
    <span className={`badge badge-${status || "neutral"}`}>
      {children || statuses[status || ""] || status}
    </span>
  );
}
export function Button({
  children,
  variant = "",
  loading = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: string;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`button ${variant} ${props.className || ""}`}
    >
      {loading && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol">↗</div>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-shade" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Sluiten"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <div className="alert error" role="alert">
      {message}
    </div>
  ) : null;
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="header-actions">{children}</div>
    </header>
  );
}
export function Card({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<any> {
  const res = await fetch("/api" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      data.error?.message ||
        data.error ||
        data.message ||
        "De actie kon niet worden uitgevoerd.",
    );
  return data;
}
export function date(value?: string) {
  return value
    ? new Date(value).toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
}
