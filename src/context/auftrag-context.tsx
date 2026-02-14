"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import type {
  Auftrag,
  Projektstatus,
  WorkStepKey,
  WorkStepState,
} from "@/lib/auftrag-types";
import {
  canSetFertig,
  canSetReadyFürTransport,
  canSetTransportGeplant,
  createStepState,
  initialAuftraege,
  isFertigungsschritt,
} from "@/lib/auftrag-data";

type DateiStore = Map<number, { original?: Blob; ready?: Blob }>;

type AuftragContextValue = {
  auftraege: Auftrag[];
  setAuftraege: React.Dispatch<React.SetStateAction<Auftrag[]>>;
  updateAuftrag: (id: number, partial: Partial<Auftrag>) => void;
  /** Wie updateAuftrag, setzt aenderungenDurchPlanung wenn Projekt in Bearbeitung in WS */
  updateAuftragFromPlanung: (id: number, partial: Partial<Auftrag>) => void;
  dateiStore: DateiStore;
  setDateiStore: React.Dispatch<React.SetStateAction<DateiStore>>;
  addFileOriginal: (id: number, file: File) => void;
  addFileReady: (id: number, file: File) => void;
  updateProjektstatus: (id: number, status: Projektstatus) => void;
  toggleStep: (id: number, stepKey: WorkStepKey) => void;
  stepAction: (
    id: number,
    stepKey: WorkStepKey,
    action: "start" | "pause" | "stop",
    lead?: string
  ) => void;
};

const AuftragContext = createContext<AuftragContextValue | null>(null);

export function AuftragProvider({ children }: { children: ReactNode }) {
  const [auftraege, setAuftraege] = useState<Auftrag[]>(initialAuftraege);
  const [dateiStore, setDateiStore] = useState<DateiStore>(new Map());

  const updateAuftrag = useCallback((id: number, partial: Partial<Auftrag>) => {
    setAuftraege((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        if (
          partial.projektstatus === "Ready für Transport" &&
          !canSetReadyFürTransport(a)
        ) {
          return a;
        }
        if (
          partial.projektstatus === "Transport geplant" &&
          !canSetTransportGeplant(a)
        ) {
          return a;
        }
        if (partial.projektstatus === "fertig" && !canSetFertig(a)) {
          return a;
        }
        const next = { ...a, ...partial };
        if (partial.projektstatus === "fertig") {
          next.fertigAm = new Date().toISOString();
        }
        if (a.projektstatus === "fertig" && "deadline" in partial) {
          next.deadline = a.deadline;
        }
        if ("projektstatus" in partial && a.steps?.tb) {
          const status = next.projektstatus;
          const tbErforderlich =
            status === "offen" || status === "Bearbeitung in TB";
          next.steps = {
            ...a.steps,
            tb: { ...a.steps.tb, erforderlich: tbErforderlich },
          };
        }
        return next;
      }),
    );
  }, []);

  const updateAuftragFromPlanung = useCallback(
    (id: number, partial: Partial<Auftrag>) => {
      setAuftraege((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          if (
            partial.projektstatus === "Ready für Transport" &&
            !canSetReadyFürTransport(a)
          ) {
            return a;
          }
          if (
            partial.projektstatus === "Transport geplant" &&
            !canSetTransportGeplant(a)
          ) {
            return a;
          }
        if (partial.projektstatus === "fertig" && !canSetFertig(a)) {
          return a;
        }
        const next = { ...a, ...partial };
        if (partial.projektstatus === "fertig") {
          next.fertigAm = new Date().toISOString();
        }
        if (a.projektstatus === "fertig" && "deadline" in partial) {
          next.deadline = a.deadline;
        }
        if (a.projektstatus === "Bearbeitung in WS") {
            next.aenderungenDurchPlanung = true;
          }
          if ("projektstatus" in partial && a.steps?.tb) {
            const status = next.projektstatus;
            const tbErforderlich =
              status === "offen" || status === "Bearbeitung in TB";
            next.steps = {
              ...a.steps,
              tb: { ...a.steps.tb, erforderlich: tbErforderlich },
            };
          }
          return next;
        }),
      );
    },
    [],
  );

  const addFileOriginal = useCallback((id: number, file: File) => {
    setDateiStore((prev) => {
      const next = new Map(prev);
      const entry = next.get(id) ?? {};
      entry.original = file;
      next.set(id, { ...entry });
      return next;
    });
  }, []);

  const addFileReady = useCallback((id: number, file: File) => {
    setDateiStore((prev) => {
      const next = new Map(prev);
      const entry = next.get(id) ?? {};
      entry.ready = file;
      next.set(id, { ...entry });
      return next;
    });
  }, []);

  const updateProjektstatus = useCallback((id: number, status: Projektstatus) => {
    setAuftraege((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        if (
          status === "Ready für Transport" &&
          !canSetReadyFürTransport(a)
        ) {
          return a;
        }
        if (
          status === "Transport geplant" &&
          !canSetTransportGeplant(a)
        ) {
          return a;
        }
        if (status === "fertig" && !canSetFertig(a)) {
          return a;
        }
        const next = { ...a, projektstatus: status };
        if (status === "fertig") {
          next.fertigAm = new Date().toISOString();
        }
        const tbErforderlich =
          status === "offen" || status === "Bearbeitung in TB";
        if (a.steps?.tb) {
          next.steps = {
            ...a.steps,
            tb: { ...a.steps.tb, erforderlich: tbErforderlich },
          };
        }
        return next;
      }),
    );
  }, []);

  const toggleStep = useCallback((id: number, stepKey: WorkStepKey) => {
    setAuftraege((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const steps = a.steps ?? createStepState(a);
        const current = steps[stepKey];
        if (!current) return a;
        if (!current.isRunning && !current.isPaused && !current.erforderlich)
          return a;

        if (!current.isRunning) {
          return {
            ...a,
            steps: {
              ...steps,
              [stepKey]: {
                ...current,
                isRunning: true,
                isPaused: false,
                startedAt: Date.now(),
              },
            },
          };
        }

        const startedAt = current.startedAt ?? Date.now();
        const diffMinutes = (Date.now() - startedAt) / 1000 / 60;
        return {
          ...a,
          steps: {
            ...steps,
            [stepKey]: {
              ...current,
              isRunning: false,
              isPaused: false,
              startedAt: undefined,
              totalMinutes: Math.max(0, current.totalMinutes + diffMinutes),
            },
          },
        };
      }),
    );
  }, []);

  const stepAction = useCallback(
    (
      id: number,
      stepKey: WorkStepKey,
      action: "start" | "pause" | "stop",
      lead?: string
    ) => {
      setAuftraege((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a;
          const steps = a.steps ?? createStepState(a);
          const current = steps[stepKey];
          if (!current) return a;
          if (
            isFertigungsschritt(stepKey) &&
            !lead?.trim()
          ) {
            return a;
          }

          const addElapsed = () => {
            if (!current.startedAt) return current.totalMinutes;
            const diff = (Date.now() - current.startedAt) / 1000 / 60;
            return Math.max(0, current.totalMinutes + diff);
          };

          if (action === "start") {
            if (!current.erforderlich && !current.isPaused) return a;
            return {
              ...a,
              steps: {
                ...steps,
                [stepKey]: {
                  ...current,
                  isRunning: true,
                  isPaused: false,
                  startedAt: Date.now(),
                  startedBy: lead ?? current.lead ?? current.startedBy,
                },
              },
            };
          }

          if (action === "pause") {
            if (!current.isRunning) return a;
            return {
              ...a,
              steps: {
                ...steps,
                [stepKey]: {
                  ...current,
                  isRunning: false,
                  isPaused: true,
                  startedAt: undefined,
                  totalMinutes: addElapsed(),
                  pausedBy: lead ?? current.lead ?? current.pausedBy,
                },
              },
            };
          }

          if (action === "stop") {
            if (!current.isRunning && !current.isPaused) return a;
            return {
              ...a,
              steps: {
                ...steps,
                [stepKey]: {
                  ...current,
                  isRunning: false,
                  isPaused: false,
                  startedAt: undefined,
                  totalMinutes: addElapsed(),
                  stoppedBy: lead ?? current.lead ?? current.stoppedBy,
                },
              },
            };
          }

          return a;
        })
      );
    },
    []
  );

  return (
    <AuftragContext.Provider
      value={{
        auftraege,
        setAuftraege,
        updateAuftrag,
        updateAuftragFromPlanung,
        dateiStore,
        setDateiStore,
        addFileOriginal,
        addFileReady,
        updateProjektstatus,
        toggleStep,
        stepAction,
      }}
    >
      {children}
    </AuftragContext.Provider>
  );
}

export function useAuftrag() {
  const ctx = useContext(AuftragContext);
  if (!ctx) throw new Error("useAuftrag must be used within AuftragProvider");
  return ctx;
}
