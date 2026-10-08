/** Re-mounts on every auth route change so each form slides in. */
export default function AuthTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
