import type { ReactNode } from 'react';

type ShellProps = {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function Shell({ title, subtitle, actions, children }: ShellProps) {
  return (
    <div className="shell">
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Techerudite practical round</p>
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>
        {actions ? <div className="hero-actions">{actions}</div> : null}
      </header>
      <main className="content-grid">{children}</main>
    </div>
  );
}