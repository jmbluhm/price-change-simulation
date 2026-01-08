import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

export function TopNav() {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200/80 shadow-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center shadow-medium group-hover:shadow-large transition-shadow">
                <span className="text-white font-bold text-sm">PI</span>
              </div>
              <span className="text-xl font-semibold text-slate-900 tracking-tight">
                Churn Reduction
              </span>
            </Link>
          </div>
          <div className="flex items-center space-x-1">
            <Link
              to="/simulate"
              className={clsx(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                location.pathname === '/simulate'
                  ? "bg-primary-50 text-primary-700 shadow-soft"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              Price Simulation
            </Link>
            <Link
              to="/churn"
              className={clsx(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                location.pathname === '/churn'
                  ? "bg-primary-50 text-primary-700 shadow-soft"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              Churn Simulation
            </Link>
            <Link
              to="/data"
              className={clsx(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                location.pathname === '/data'
                  ? "bg-primary-50 text-primary-700 shadow-soft"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              Data
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

