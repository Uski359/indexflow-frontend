export type FeatureKey =
  | 'overview'
  | 'proof'
  | 'dashboardLegacy'
  | 'transfers'
  | 'health'
  | 'demoLanding'
  | 'demoCampaign'
  | 'addressDetail'
  | 'proofAlias';

type RouteMatchMode = 'exact' | 'prefix';

export type FeatureRoute = {
  key: FeatureKey;
  href: `/${string}`;
  label: string;
  description: string;
  showInNav: boolean;
  matchMode: RouteMatchMode;
};

export const featureToggles: Record<FeatureKey, boolean> = {
  overview: true,
  proof: true,
  dashboardLegacy: false,
  transfers: false,
  health: false,
  demoLanding: false,
  demoCampaign: false,
  addressDetail: false,
  proofAlias: false
};

const routeRegistry: FeatureRoute[] = [
  {
    key: 'overview',
    href: '/',
    label: 'Overview',
    description: 'Protocol and indexer summary',
    showInNav: true,
    matchMode: 'exact'
  },
  {
    key: 'proof',
    href: '/demo/proof',
    label: 'Proof',
    description: 'Proof-of-usage evaluation workspace',
    showInNav: true,
    matchMode: 'exact'
  },
  {
    key: 'dashboardLegacy',
    href: '/dashboard',
    label: 'Dashboard',
    description: 'Legacy dashboard alias kept behind the scenes',
    showInNav: false,
    matchMode: 'exact'
  },
  {
    key: 'transfers',
    href: '/transfers',
    label: 'Transfers',
    description: 'Advanced transfer firehose',
    showInNav: false,
    matchMode: 'exact'
  },
  {
    key: 'health',
    href: '/health',
    label: 'Health',
    description: 'Internal indexer health monitoring',
    showInNav: false,
    matchMode: 'exact'
  },
  {
    key: 'demoLanding',
    href: '/demo',
    label: 'Demo',
    description: 'Internal demo launcher',
    showInNav: false,
    matchMode: 'exact'
  },
  {
    key: 'demoCampaign',
    href: '/demo/campaign',
    label: 'Campaign',
    description: 'Legacy campaign detail view',
    showInNav: false,
    matchMode: 'prefix'
  },
  {
    key: 'addressDetail',
    href: '/address',
    label: 'Address',
    description: 'Wallet drilldown page',
    showInNav: false,
    matchMode: 'prefix'
  },
  {
    key: 'proofAlias',
    href: '/proof-of-usage',
    label: 'Proof Alias',
    description: 'Legacy proof redirect',
    showInNav: false,
    matchMode: 'exact'
  }
];

const isEnabled = (key: FeatureKey): boolean => featureToggles[key];

export const visibleRoutes = routeRegistry.filter((route) => isEnabled(route.key));
export const hiddenRoutes = routeRegistry.filter((route) => !isEnabled(route.key));
export const visibleNavRoutes = visibleRoutes.filter((route) => route.showInNav);
export const primaryCtaRoute: FeatureRoute =
  visibleRoutes.find((route) => route.key === 'proof') ?? routeRegistry[0];

export const developerRouteAccessQueryKey = 'dev';

export const isRouteActive = (pathname: string | null, route: FeatureRoute): boolean => {
  if (!pathname) {
    return false;
  }

  if (route.matchMode === 'prefix') {
    return pathname === route.href || pathname.startsWith(`${route.href}/`);
  }

  return pathname === route.href;
};

export const isHiddenRoutePath = (pathname: string): boolean =>
  hiddenRoutes.some((route) => isRouteActive(pathname, route));

export const canAccessHiddenRoutes = (searchParams: URLSearchParams): boolean => {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  return (
    process.env.ENABLE_HIDDEN_ROUTES === 'true' &&
    searchParams.get(developerRouteAccessQueryKey) === '1'
  );
};
