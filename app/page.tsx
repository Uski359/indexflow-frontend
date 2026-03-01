import { ArrowRight, CheckCircle2, FlaskConical, ShieldCheck, Target } from 'lucide-react';
import Link from 'next/link';

import ActivityChart from '@/components/ActivityChart';
import Card from '@/components/Card';
import ContributionLeaderboard from '@/components/ContributionLeaderboard';
import HealthStatus from '@/components/HealthStatus';
import HolderStat from '@/components/HolderStat';
import ProofTable from '@/components/ProofTable';
import StakingSummary from '@/components/StakingSummary';
import SupplyStat from '@/components/SupplyStat';
import ThroughputStat from '@/components/ThroughputStat';
import TransferTable from '@/components/TransferTable';
import PageHeader from '@/components/ui/PageHeader';
import SectionCard from '@/components/ui/SectionCard';
import { uiFlags } from '@/config/uiFlags';

const campaignHref = '/demo/campaign/airdrop_v1?window=last_30_days';
const launchYourCampaignHref = `${campaignHref}#launch-your-campaign`;

const campaignSteps = [
  'Choose the campaign and usage window.',
  'Run the scoring flow against mock wallets.',
  'Review filters, wallet detail, and commentary.'
] as const;

const DashboardPage = () => {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Demo"
        title="Demo-first operator flow"
        subtitle="Start with the guided demo, move into proof evaluation, then review campaign output. The overview metrics remain in the codebase, but they are hidden from the default experience."
        actions={
          <Link
            href={launchYourCampaignHref}
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            <span>Launch your campaign</span>
            <ArrowRight size={16} />
          </Link>
        }
      />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {uiFlags.showDemo ? (
          <SectionCard
            title="Demo"
            description="Configure your own campaign run and jump directly into results."
            eyebrow="Step 1"
            actions={
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <FlaskConical size={18} />
              </div>
            }
            className="h-full"
          >
            <p className="text-sm leading-6 text-slate-300">
              Start by choosing a campaign and usage window, then launch the workflow without
              exposing internal analytics panels on the home screen.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={launchYourCampaignHref}
                className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Launch your campaign
              </Link>
            </div>
          </SectionCard>
        ) : null}

        {uiFlags.showProof ? (
          <SectionCard
            title="Proof"
            description="Run wallet-level proof-of-usage checks with the primary CTA."
            eyebrow="Step 2"
            actions={
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <ShieldCheck size={18} />
              </div>
            }
            className="h-full"
          >
            <p className="text-sm leading-6 text-slate-300">
              Paste wallet inputs, tune filters, and export results from the dedicated proof
              workflow with fewer competing cards on screen.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/demo/proof"
                className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Run proof
              </Link>
              <Link
                href={campaignHref}
                className="inline-flex items-center rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/5"
              >
                View campaign
              </Link>
            </div>
          </SectionCard>
        ) : null}

        {uiFlags.showCampaign ? (
          <SectionCard
            title="Campaign"
            description="Review campaign status, then move through the next actions in order."
            eyebrow="Step 3"
            actions={
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Target size={18} />
              </div>
            }
            className="h-full"
          >
            <div className="space-y-3">
              <div className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                Ready for review
              </div>
              <div className="space-y-2 text-sm text-slate-300">
                {campaignSteps.map((step) => (
                  <div key={step} className="flex items-start gap-2">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-accent" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={campaignHref}
                className="inline-flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
              >
                Open campaign
              </Link>
            </div>
          </SectionCard>
        ) : null}
      </section>

      {uiFlags.showOverview ? (
        <>
          <PageHeader
            eyebrow="Overview"
            title="Protocol indexer"
            subtitle="Internal overview metrics remain available behind a single UI flag for future re-enable."
          />

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {uiFlags.showTotalSupply ? <SupplyStat /> : null}
            <HolderStat />
            <ThroughputStat />
            <Card title="Coverage" subtitle="Supported execution layers" className="h-full">
              <p className="text-sm text-slate-300">
                Monitor Sepolia, Polygon, Arbitrum, Base, and Optimism with a single toggle.
              </p>
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ActivityChart />
            </div>
            {uiFlags.showHealth ? <HealthStatus /> : null}
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-accent">Token Utility</p>
                <h2 className="text-xl font-semibold text-white">
                  Staking | Proof-of-Indexing | Share-to-Earn
                </h2>
                <p className="text-sm text-slate-300">
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

          <TransferTable
            limit={8}
            title="Latest Transfers"
            subtitle="Recent movement across the active chain"
          />
        </>
      ) : null}
    </div>
  );
};

export default DashboardPage;
