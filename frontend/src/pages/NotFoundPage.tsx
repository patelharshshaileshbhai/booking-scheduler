import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="page-center error-screen">
      <h1>404</h1>
      <p>The page you are looking for does not exist.</p>
      <Link to="/dashboard">Go to dashboard</Link>
    </div>
  );
}