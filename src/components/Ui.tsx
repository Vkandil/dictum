import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Check, LoaderCircle } from "lucide-react";

export function Button({ children, variant = "primary", busy, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; busy?: boolean }) {
  return <button className={`button ${variant}`} disabled={busy || props.disabled} {...props}>{busy ? <LoaderCircle className="spin" size={16} /> : null}{children}</button>;
}

export function Card({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <section className={`card ${className}`} {...props}>{children}</section>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input className="input" {...props} />; }
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) { return <select className="input" {...props} />; }

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return <div className={`toggle-row ${disabled ? "disabled" : ""}`}>
    <div><div className="toggle-label">{label}</div>{description ? <div className="toggle-description">{description}</div> : null}</div>
    <button type="button" role="switch" aria-checked={checked} className={`switch ${checked ? "on" : ""}`} onClick={() => !disabled && onChange(!checked)} disabled={disabled}><span /></button>
  </div>;
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" }) {
  return <span className={`pill ${tone}`}>{tone === "success" ? <Check size={12} /> : null}{children}</span>;
}

export function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{body}</p></div>;
}
