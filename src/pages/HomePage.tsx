import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { TrendingUp, Users, Database } from 'lucide-react';

export function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary-600 to-primary-700 mb-6 shadow-large">
            <span className="text-white font-bold text-2xl">PI</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3 tracking-tight">
            Price Impact Simulator
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Explore pricing strategies and retention interventions to optimize your subscription business
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Price Simulation Card */}
          <Link to="/simulate" className="block group">
            <Card className="h-full transition-all duration-200 hover:shadow-large hover:scale-105">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center mb-4 group-hover:from-blue-100 group-hover:to-blue-200 transition-colors">
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Price Simulation</h3>
                <p className="text-sm text-slate-600">
                  Simulate the impact of price changes on churn and find optimal pricing strategies
                </p>
              </div>
            </Card>
          </Link>

          {/* Churn Simulation Card */}
          <Link to="/churn" className="block group">
            <Card className="h-full transition-all duration-200 hover:shadow-large hover:scale-105">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center mb-4 group-hover:from-emerald-100 group-hover:to-emerald-200 transition-colors">
                  <Users className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Churn Simulation</h3>
                <p className="text-sm text-slate-600">
                  Explore retention interventions and estimate recovered ARR from churn reduction
                </p>
              </div>
            </Card>
          </Link>

          {/* Data Card */}
          <Link to="/data" className="block group">
            <Card className="h-full transition-all duration-200 hover:shadow-large hover:scale-105">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center mb-4 group-hover:from-slate-100 group-hover:to-slate-200 transition-colors">
                  <Database className="w-8 h-8 text-slate-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">Data</h3>
                <p className="text-sm text-slate-600">
                  View merchants, plans, and historical events from the synthetic dataset
                </p>
              </div>
            </Card>
          </Link>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-slate-500">
            Select a tool above to get started
          </p>
        </div>
      </div>
    </div>
  );
}
