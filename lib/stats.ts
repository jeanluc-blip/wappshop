// Périodes de l'onglet Statistiques. « Aujourd'hui » commence à minuit, heure du Bénin (UTC+1, sans heure d'été).
export const STATS_UTC_OFFSET_HOURS = 1;

export const PERIODS = ["today", "7d", "30d"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  "7d": "7 jours",
  "30d": "30 jours",
};

export function parsePeriod(value: string | undefined): Period {
  return PERIODS.find((period) => period === value) ?? "7d";
}

/** Début de la période, en date ISO (UTC). */
export function periodStart(period: Period, now: Date = new Date()): Date {
  const offsetMs = STATS_UTC_OFFSET_HOURS * 3_600_000;
  // Minuit local du jour courant, exprimé en UTC.
  const local = new Date(now.getTime() + offsetMs);
  const startOfLocalDay = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offsetMs;
  if (period === "today") return new Date(startOfLocalDay);
  const days = period === "7d" ? 6 : 29; // jours complets précédents + aujourd'hui
  return new Date(startOfLocalDay - days * 86_400_000);
}
