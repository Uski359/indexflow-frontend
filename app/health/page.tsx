import Card from '@/components/Card';
import HealthStatus from '@/components/HealthStatus';

const HealthPage = () => {
  return (
    <div className="space-y-6">
      <Card title="Realtime Monitor" subtitle="Indexer heartbeat">
        <p className="text-sm text-gray-300">
          Track the latest indexed block height and the freshness of the pipeline. This view
          updates every few seconds and respects the active chain selection.
        </p>
      </Card>

      <HealthStatus />
    </div>
  );
};

export default HealthPage;
