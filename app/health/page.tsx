import Card from '@/components/Card';
import HealthStatus from '@/components/HealthStatus';
import PageHeader from '@/components/ui/PageHeader';

const HealthPage = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Health"
        title="Indexer heartbeat"
        subtitle="This internal view stays in the codebase for future re-enable. It is now gated from normal production navigation."
      />

      <Card title="Realtime Monitor" subtitle="Indexer heartbeat">
        <p className="text-sm text-slate-300">
          Track the latest indexed block height and the freshness of the pipeline. This view
          updates every few seconds and respects the active chain selection.
        </p>
      </Card>

      <HealthStatus />
    </div>
  );
};

export default HealthPage;
