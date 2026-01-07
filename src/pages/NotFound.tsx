import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function NotFound() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 mb-6">
            <span className="text-5xl font-bold text-slate-400">404</span>
          </div>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-3 tracking-tight">Page Not Found</h1>
        <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <Button>Go Home</Button>
        </Link>
      </div>
    </div>
  );
}

