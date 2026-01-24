export const scoreClass = (score: number) => {
  if (score >= 70) {
    return 'bg-emerald-500/20 text-emerald-200';
  }
  if (score >= 30) {
    return 'bg-amber-500/20 text-amber-200';
  }
  return 'bg-rose-500/20 text-rose-200';
};

export const farmRiskClass = (farmPercent: number) => {
  if (farmPercent >= 70) {
    return 'bg-rose-500/20 text-rose-200';
  }
  if (farmPercent >= 40) {
    return 'bg-amber-500/20 text-amber-200';
  }
  return 'bg-emerald-500/20 text-emerald-200';
};
