import Card from '@/components/Card';
import TransferTable from '@/components/TransferTable';

type AddressPageProps = {
  params: { addr: string };
};

const shorten = (value: string) =>
  value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;

const AddressPage = ({ params }: AddressPageProps) => {
  const address = decodeURIComponent(params.addr);

  return (
    <div className="space-y-6">
      <Card
        title="Wallet Overview"
        subtitle="Incoming and outgoing transfers"
        actions={<div className="rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">{address}</div>}
      >
        <p className="text-sm text-gray-300">
          Activity for <span className="font-mono text-white">{shorten(address)}</span> on the
          selected chain.
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
