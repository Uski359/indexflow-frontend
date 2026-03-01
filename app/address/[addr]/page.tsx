import Card from '@/components/Card';
import TransferTable from '@/components/TransferTable';
import PageHeader from '@/components/ui/PageHeader';

type AddressPageProps = {
  params: { addr: string };
};

const shorten = (value: string) =>
  value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;

const AddressPage = ({ params }: AddressPageProps) => {
  const address = decodeURIComponent(params.addr);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Wallet"
        title="Wallet activity"
        subtitle={`Incoming and outgoing transfers for ${shorten(address)} on the active chain.`}
        actions={
          <div className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            {address}
          </div>
        }
      />

      <Card title="Wallet Overview" subtitle="Transfer scope">
        <p className="text-sm text-slate-300">
          This drilldown is still available behind the scenes for future user re-enable.
        </p>
      </Card>

      <TransferTable
        address={address}
        title="Recent Transfers"
        subtitle="Filtered by wallet address"
      />
    </div>
  );
};

export default AddressPage;
