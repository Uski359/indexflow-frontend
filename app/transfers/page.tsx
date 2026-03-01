import TransferTable from '@/components/TransferTable';
import PageHeader from '@/components/ui/PageHeader';

const TransfersPage = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Transfers"
        title="Transfer activity"
        subtitle="The detailed transfer firehose remains implemented but is hidden from the primary navigation and blocked in production by default."
      />

      <TransferTable
        title="All Transfers"
        subtitle="Most recent transactions across the selected chain"
      />
    </div>
  );
};

export default TransfersPage;
