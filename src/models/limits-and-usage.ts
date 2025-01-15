export interface LimitsAndUsage {
  usagePercent: {
    current: number;
    value: number;
  },
  nextResetSeconds: {
    current: number;
    value: number;
  },
  dayCount: {
    current: number;
    value: number;
  },
  /*... ?*/
}