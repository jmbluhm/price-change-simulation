# Price Change Simulator

A React + TypeScript application for simulating the impact of price changes on ARR (Annual Recurring Revenue) and churn rates. The simulator uses historical price change events to predict churn and revenue impacts.

## Features

- **Merchant-Scoped Simulations**: Always simulates within a single merchant context
- **Global Benchmark Blending**: Optional blending of merchant-specific and global benchmark data with evidence-based weighting
- **Price Shock Adjustments**: Non-linear adjustments for extreme price increases (>25%) to prevent unrealistic retention assumptions
- **Extreme Change Warnings**: Modal warnings for extreme price changes (≥50% increase or ≤-30% decrease) with user acknowledgment
- **Data Visualization**: Interactive charts showing ARR impact breakdown and churn comparisons
- **Evidence-Based Predictions**: Uses weighted historical events to predict churn lift

## Tech Stack

- **React 19** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **React Router** for navigation

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Deployment to Vercel

This project is configured for easy deployment to Vercel:

1. **Connect Repository**: Import the GitHub repository in your Vercel dashboard
2. **Build Settings**: Vercel will auto-detect Vite settings:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
3. **Deploy**: Click deploy and Vercel will handle the rest

### Environment Variables

No environment variables are required for this project.

## Project Structure

```
src/
  components/     # Reusable UI components
  data/            # Data generation and types
  lib/             # Core simulation logic and utilities
  pages/           # Page components (Simulate, Data, NotFound)
```

## Key Components

- **SimulatePage**: Main simulation interface with inputs and results
- **Modal**: Reusable modal component for warnings
- **simulate.ts**: Core simulation engine with price shock adjustments
- **generate.ts**: Sample data generation for testing

## License

Private project
