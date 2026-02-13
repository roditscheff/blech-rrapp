export type Projektstatus =
  | "offen"
  | "Bearbeitung in TB"
  | "Ready für WS"
  | "Bearbeitung in WS"
  | "Transport geplant"
  | "Ready für Transport"
  | "fertig";

export type TransportOption =
  | "Kein Transport"
  | "Transport Zwingen-Birsfelden"
  | "Transport Birsfelden-Zwingen"
  | "Transport zu Kunde";

export type Projektleiter = "rero" | "niro" | "alja" | "tbd";

export type WorkStepKey =
  | "tb"
  | "scheren"
  | "lasern"
  | "kanten"
  | "schweissen"
  | "behandeln"
  | "eckenGefeilt";

export type WorkStepState = {
  erforderlich: boolean;
  isRunning: boolean;
  /** Pausiert: Timer gestoppt, kann mit Start fortgesetzt werden */
  isPaused?: boolean;
  startedAt?: number;
  totalMinutes: number;
  /** Lead-Mitarbeiter (4-Buchstaben-Kürzel, z.B. mifi, kaku) */
  lead?: string;
};

export type Auftrag = {
  id: number;
  commissionNr: string;
  projektleiter: Projektleiter;
  projektKurzname: string;
  kundeName: string;
  prio: number;
  projektstatus: Projektstatus;
  deadline: string;
  deadlineBestaetigt: boolean;
  blechTyp: string;
  format: string;
  transport: TransportOption;
  anzahl: number;
  flaechM2: number;
  hatOriginalDatei: boolean;
  originalDateiName?: string;
  hatReadyDatei: boolean;
  readyDateiName?: string;
  scheren: boolean;
  lasern: boolean;
  kanten: boolean;
  schweissen: boolean;
  behandeln: boolean;
  eckenGefeilt: boolean;
  steps?: Record<WorkStepKey, WorkStepState>;
  /** true wenn TB/Projektleiter Änderungen gemacht hat, während Projekt in Bearbeitung in WS war */
  aenderungenDurchPlanung?: boolean;
};

export const workStepLabels: Record<WorkStepKey, string> = {
  tb: "TB",
  scheren: "Scheren",
  lasern: "Lasern",
  kanten: "Kanten",
  schweissen: "Schweissen",
  behandeln: "Behandeln",
  eckenGefeilt: "Ecken gefeilt",
};
