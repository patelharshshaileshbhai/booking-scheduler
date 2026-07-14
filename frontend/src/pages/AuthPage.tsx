import type { ReactNode } from 'react';

type AuthPageProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export default function AuthPage({ title, subtitle, children }: AuthPageProps) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Scheduling system</p>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}