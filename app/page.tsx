import ActivityChart from '@/components/ActivityChart';
import Card from '@/components/Card';
import HealthStatus from '@/components/HealthStatus';
import HolderStat from '@/components/HolderStat';
import ContributionLeaderboard from '@/components/ContributionLeaderboard';
import ProofTable from '@/components/ProofTable';
import StakingSummary from '@/components/StakingSummary';
import SupplyStat from '@/components/SupplyStat';
import ThroughputStat from '@/components/ThroughputStat';
import TransferTable from '@/components/TransferTable';

const DashboardPage = () => {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SupplyStat />
        <HolderStat />
        <ThroughputStat />
        <Card title="IndexFlow" subtitle="Multi-chain coverage" className="h-full">
          <p className="text-sm text-gray-300">
            Monitor Sepolia, Polygon, Arbitrum, Base, and Optimism with a single toggle.
          </p>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ActivityChart />
        </div>
        <HealthStatus />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-accent">Token Utility</p>
            <h2 className="text-xl font-semibold text-white">
              Staking - Proof-of-Indexing - Share-to-Earn
            </h2>
            <p className="text-sm text-gray-400">
              Live protocol signals flowing from the utility contracts.
            </p>
          </div>
        </div>

        <StakingSummary />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ProofTable />
          </div>
          <ContributionLeaderboard />
        </div>
      </section>

      <TransferTable limit={10} title="Latest Transfers" />
    </div>
  );
};

export default DashboardPage;
