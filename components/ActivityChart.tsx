'use client';

import { useMemo } from 'react';
import type { TooltipItem } from 'chart.js';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Activity } from 'lucide-react';

import { useStats } from '@/hooks/useStats';

import Card from './Card';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const ActivityChart = () => {
  const { activity, isLoading, error } = useStats();

  const series = useMemo(() => activity?.series ?? [], [activity]);
  const hasData = series.length > 0;
  const transferCount24h =
    activity?.transferCount24h ?? series.reduce((acc, point) => acc + point.count, 0);
  const volume24h = activity?.volume24h ?? 0;

  const chartData = {
    labels: series.map((point) =>
      new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit' })
    ),
    datasets: [
      {
        label: 'Transfers',
        data: series.map((point) => point.count),
        fill: true,
        borderColor: '#7C3AED',
        backgroundColor: 'rgba(124, 58, 237, 0.12)',
        pointRadius: 3,
        tension: 0.35
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        intersect: false,
        callbacks: {
          label: (context: TooltipItem<'line'>) => `${context.parsed.y} transfers`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#9CA3AF' },
        grid: { display: false }
      },
      y: {
        ticks: { color: '#9CA3AF' },
        grid: { color: 'rgba(31,31,42,0.6)' }
      }
    }
  };

  return (
    <Card
      title="Activity"
      subtitle="Transfer volume (last 24h)"
      actions={
        <div className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">
          <Activity size={14} />
          <span>
            {error ? 'Error' : isLoading ? '...' : `${transferCount24h.toLocaleString()} tx`}
          </span>
        </div>
      }
      className="h-full"
    >
      {error ? (
        <p className="text-sm text-red-300">Failed to load activity data.</p>
      ) : isLoading && !hasData ? (
        <p className="text-sm text-gray-400">Loading activity...</p>
      ) : !hasData ? (
        <p className="text-sm text-gray-400">No recent activity found.</p>
      ) : (
        <div className="h-64">
          <p className="mb-2 text-sm text-gray-400">
            24h volume: {volume24h.toLocaleString()}
          </p>
          <Line options={options} data={chartData} />
        </div>
      )}
    </Card>
  );
};

export default ActivityChart;
