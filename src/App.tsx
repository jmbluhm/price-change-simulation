import { Routes, Route } from 'react-router-dom';
import { TopNav } from './components/TopNav';
import { HomePage } from './pages/HomePage';
import { DataPage } from './pages/DataPage';
import { SimulatePage } from './pages/SimulatePage';
import { ChurnSimulationPage } from './pages/ChurnSimulationPage';
import { NotFound } from './pages/NotFound';

function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />
      <main className="pb-12">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/simulate" element={<SimulatePage />} />
          <Route path="/churn" element={<ChurnSimulationPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
