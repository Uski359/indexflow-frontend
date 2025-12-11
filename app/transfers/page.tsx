import TransferTable from '@/components/TransferTable';

const TransfersPage = () => {
  return (
    <div className="space-y-6">
      <TransferTable
        title="All Transfers"
        subtitle="Most recent transactions across the selected chain"
      />
    </div>
  );
};

export default TransfersPage;
