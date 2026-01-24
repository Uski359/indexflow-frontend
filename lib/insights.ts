import type { CoreOutputV1, InsightV1 } from './types';

export const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

export const roundTo2 = (value: number) => {
  return Math.round(value * 100) / 100;
};

export const computeInsightV1 = (output: CoreOutputV1): InsightV1 => {
  const { tx_count: tx, days_active: days, unique_contracts: uniq } = output.usage_summary;

  const tx_n = clamp(tx / 120, 0, 1);
  const days_n = clamp(days / 30, 0, 1);
  const uniq_n = clamp(uniq / 20, 0, 1);

  const activity = clamp(0.45 * days_n + 0.35 * tx_n + 0.2 * uniq_n, 0, 1);
  const farm_raw = clamp(
    0.55 * tx_n + 0.25 * (1 - uniq_n) + 0.2 * (1 - days_n),
    0,
    1
  );

  let behavior_tag: InsightV1['behavior_tag'];
  if (tx < 3 && days < 2) {
    behavior_tag = 'inactive';
  } else if (farm_raw >= 0.65 && uniq <= 2) {
    behavior_tag = 'suspected_farm';
  } else if (activity >= 0.7 && farm_raw < 0.55) {
    behavior_tag = 'organic';
  } else {
    behavior_tag = 'mixed';
  }

  const overall_score = Math.round(clamp(activity * 100 - farm_raw * 35, 0, 100));
  const farming_probability = roundTo2(farm_raw);

  return {
    overall_score,
    farming_probability,
    behavior_tag,
    insight_version: 'v1'
  };
};
