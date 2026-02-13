"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useAuftrag } from "@/context/auftrag-context";
import { createStepState } from "@/lib/auftrag-data";
import type { Auftrag, Projektstatus, WorkStepKey } from "@/lib/auftrag-types";
import { workStepLabels } from "@/lib/auftrag-types";

import { ChevronDown, ChevronUp, Home, Layers, Pause, Pencil, Play, Square } from "lucide-react";

function formatCommissionNr(nr: string): string {
  return nr.replace(/\D/g, "").padStart(6, "0").slice(0, 6);
}

function getBaseCommissionNr(nr: string): string {
  const beforeHyphen = nr.split("-")[0]?.trim() || nr;
  return formatCommissionNr(beforeHyphen);
}

function formatCommissionNrDisplay(nr: string): string {
  const base = getBaseCommissionNr(nr);
  const suffix = nr.includes("-") ? nr.substring(nr.indexOf("-")) : "";
  return base + suffix;
}

function formatMinuteSeconds(
  totalMinutes: number,
  startedAt?: number
): string {
  let minutes = totalMinutes;
  if (startedAt != null) {
    minutes += (Date.now() - startedAt) / 1000 / 60;
  }
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return `${m}'${s.toString().padStart(2, "0")}''`;
}

const FERTIGUNG_KEYS: WorkStepKey[] = [
  "scheren",
  "lasern",
  "kanten",
  "schweissen",
  "behandeln",
  "eckenGefeilt",
];

const WORKSHOP_STEP_SHORT: Record<WorkStepKey, string> = {
  scheren: "S",
  lasern: "L",
  kanten: "K",
  schweissen: "W",
  behandeln: "B",
  eckenGefeilt: "E",
};

const WORKSHOP_MITARBEITER = [
  "mifi",
  "kaku",
  "saro",
  "hema",
  "alex",
  "tbd",
] as const;

/** Werkstatt-relevante Projektstatus-Optionen */
const PROJEKTSTATUS_OPTIONS: { value: Projektstatus; label: string }[] = [
  { value: "offen", label: "Offen" },
  { value: "Bearbeitung in TB", label: "Bearbeitung in TB" },
  { value: "Ready für WS", label: "Ready für WS" },
  { value: "Bearbeitung in WS", label: "Bearbeitung in WS" },
  { value: "Ready für Transport", label: "Ready für Transport" },
  { value: "Transport geplant", label: "Transport geplant" },
  { value: "fertig", label: "Fertig" },
];

function isInBearbeitung(ps: Projektstatus): boolean {
  return ps === "Bearbeitung in TB" || ps === "Bearbeitung in WS";
}

export default function WerkstattPage() {
  const {
    auftraege,
    dateiStore,
    updateAuftrag,
    updateProjektstatus,
    stepAction,
  } = useAuftrag();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [, forceUpdate] = useState(0);
  const [commissionFilter, setCommissionFilter] = useState<string>("");

  const hasRunningStep = auftraege.some(
    (a) =>
      a.steps &&
      Object.values(a.steps).some((s) => s.isRunning)
  );

  useEffect(() => {
    if (!hasRunningStep) return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [hasRunningStep]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getRowClassName = (auftrag: Auftrag) => {
    const base = "text-base hover:bg-muted/60 bg-white cursor-pointer";
    if (auftrag.projektstatus !== "fertig" && auftrag.deadline) {
      const d = new Date(auftrag.deadline);
      if (!Number.isNaN(d.getTime())) {
        const diffMs = d.getTime() - Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (diffMs <= oneDayMs && diffMs >= 0) {
          return `${base} bg-orange-100`;
        }
      }
    }
    return base;
  };

  const handleDownloadOriginal = (id: number) => {
    const blob = dateiStore.get(id)?.original;
    const a = auftraege.find((x) => x.id === id);
    if (!blob || !a?.originalDateiName) return;
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = a.originalDateiName;
    el.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadReady = (id: number) => {
    const blob = dateiStore.get(id)?.ready;
    const a = auftraege.find((x) => x.id === id);
    if (!blob || !a?.readyDateiName) return;
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = a.readyDateiName;
    el.click();
    URL.revokeObjectURL(url);
  };

  const filterByCommission = <T extends { commissionNr: string }>(list: T[]) =>
    commissionFilter
      ? list.filter(
          (a) => getBaseCommissionNr(a.commissionNr) === commissionFilter
        )
      : list;

  const tab1 = filterByCommission(
    auftraege
      .filter((a) =>
        a.projektstatus === "Ready für WS" ||
        a.projektstatus === "Bearbeitung in WS"
      )
      .sort((a, b) => a.prio - b.prio)
  );
  const transport = filterByCommission(
    auftraege
      .filter((a) =>
        a.projektstatus === "Ready für Transport" ||
        a.projektstatus === "Transport geplant"
      )
      .sort((a, b) => a.prio - b.prio)
  );
  const tab2 = filterByCommission(
    auftraege
      .filter((a) =>
        a.projektstatus === "offen" || a.projektstatus === "Bearbeitung in TB"
      )
      .sort((a, b) => a.prio - b.prio)
  );
  const tab3 = filterByCommission(
    auftraege
      .filter((a) => a.projektstatus === "fertig")
      .sort((a, b) => a.prio - b.prio)
  );

  const renderExpandedContent = (auftrag: Auftrag) => {
    const steps = auftrag.steps ?? createStepState(auftrag);
    const benoetigteSchritte = FERTIGUNG_KEYS.filter((k) => steps[k]?.erforderlich);
    const canDownloadReady =
      auftrag.hatReadyDatei && dateiStore.get(auftrag.id)?.ready;

    return (
      <div className="space-y-6 rounded-lg border border-muted-foreground/20 bg-muted/30 p-4 text-base">
        {/* Read-only Stammdaten (wie Erfassung) */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Commission / Projektleiter</div>
            <div className="font-medium">
              {formatCommissionNr(auftrag.commissionNr)} · {auftrag.projektleiter}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Projekt / Kunde</div>
            <div className="font-medium">{auftrag.projektKurzname}</div>
            <div className="text-muted-foreground text-sm">{auftrag.kundeName}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Prio</div>
            <div className="font-medium">{auftrag.prio}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Deadline</div>
            <div>{auftrag.deadline}</div>
            {auftrag.deadlineBestaetigt && (
              <span className="text-green-600 text-sm">✓ bestätigt</span>
            )}
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Blech · Format · Transport</div>
            <div>{auftrag.blechTyp} · {auftrag.format} · {auftrag.transport}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Anzahl / m²</div>
            <div>{auftrag.anzahl} Stk. · {auftrag.flaechM2.toFixed(1)} m²</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Fertigung</div>
            <div className="flex flex-wrap gap-1">
              {[
                ["S", auftrag.scheren],
                ["L", auftrag.lasern],
                ["K", auftrag.kanten],
                ["W", auftrag.schweissen],
                ["B", auftrag.behandeln],
                ["E", auftrag.eckenGefeilt],
              ].map(([short, active]) => (
                <span
                  key={String(short)}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {short}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-sm">Pläne Original</div>
            {auftrag.hatOriginalDatei ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-sm">
                  {auftrag.originalDateiName ?? "Original"}
                </Badge>
                {dateiStore.get(auftrag.id)?.original && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadOriginal(auftrag.id);
                    }}
                  >
                    ↓ Herunterladen
                  </Button>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">–</span>
            )}
          </div>
        </div>

        {/* Bearbeitbar: Projektstatus – 3 große Buttons */}
        <div className="space-y-2">
          <div className="text-muted-foreground text-sm font-medium">
            Projektstatus
          </div>
          <div className="flex flex-wrap gap-3">
            {PROJEKTSTATUS_OPTIONS.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                size="lg"
                variant={auftrag.projektstatus === value ? "default" : "outline"}
                className="min-h-12 min-w-[10rem] text-base"
                onClick={(e) => {
                  e.stopPropagation();
                  updateProjektstatus(auftrag.id, value);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Bearbeitbar: Pläne Ready – großer Download-Button */}
        <div className="space-y-2">
          <div className="text-muted-foreground text-sm font-medium">
            Pläne Ready to Work
          </div>
          {canDownloadReady ? (
            <Button
              type="button"
              size="lg"
              className="min-h-14 min-w-full bg-green-600 text-lg hover:bg-green-700"
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadReady(auftrag.id);
              }}
            >
              ↓ Pläne herunterladen
            </Button>
          ) : (
            <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-center">
              Keine Pläne zum Herunterladen
            </div>
          )}
        </div>

        {/* Bearbeitbar: Arbeitsschritte – Start/Pause/Stop Buttons + Lead-Dropdown */}
        <div className="space-y-2">
          <div className="text-muted-foreground text-sm font-medium">
            Arbeitsschritte
          </div>
          <div className="flex flex-wrap gap-4">
            {benoetigteSchritte.map((key) => {
              const step = steps[key];
              if (!step) return null;
              const isRunning = step.isRunning;
              const isPaused = step.isPaused ?? false;
              const isActive = isRunning || isPaused;
              return (
                <div key={key} className="flex flex-col items-center gap-1">
                  <div className="text-muted-foreground text-xs font-medium">
                    {workStepLabels[key]}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="lg"
                        variant={isRunning ? "outline" : "default"}
                        className={`min-h-14 min-w-[7rem] text-base ${
                          isRunning
                            ? ""
                            : "bg-green-600 hover:bg-green-700"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          stepAction(
                            auftrag.id,
                            key,
                            isRunning ? "pause" : "start"
                          );
                        }}
                      >
                        {isRunning ? (
                          <>
                            <Pause className="mr-1 h-4 w-4" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="mr-1 h-4 w-4" />
                            Start
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="lg"
                        variant="destructive"
                        className="min-h-14 min-w-[6rem] text-base bg-red-600 hover:bg-red-700"
                        disabled={!isActive}
                        onClick={(e) => {
                          e.stopPropagation();
                          stepAction(auftrag.id, key, "stop");
                        }}
                      >
                        <Square className="mr-1 h-4 w-4" />
                        Stop
                      </Button>
                    </div>
                    <select
                      className="border-input bg-background h-9 w-20 rounded border px-1.5 text-xs"
                      value={step.lead ?? ""}
                      onChange={(e) => {
                        e.stopPropagation();
                        const value = e.target.value || undefined;
                        updateAuftrag(auftrag.id, {
                          steps: {
                            ...steps,
                            [key]: { ...step, lead: value },
                          },
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      title="Lead für diesen Schritt"
                    >
                      <option value="">–</option>
                      {WORKSHOP_MITARBEITER.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-muted-foreground text-sm">
                    {formatMinuteSeconds(step.totalMinutes, step.startedAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderRow = (auftrag: Auftrag, opts?: { hidePrio?: boolean }) => {
    const isExpanded = expandedId === auftrag.id;
    const steps = auftrag.steps ?? createStepState(auftrag);
    const benoetigteSchritte = FERTIGUNG_KEYS.filter((k) => steps[k]?.erforderlich);

    return (
      <Fragment key={auftrag.id}>
        <TableRow
          className={getRowClassName(auftrag)}
          onClick={() => toggleExpand(auftrag.id)}
        >
          <TableCell
            className="w-14"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex items-center justify-center rounded p-2 hover:bg-muted"
              onClick={() => toggleExpand(auftrag.id)}
              aria-label="Auftrag aufklappen"
            >
              <Pencil className="text-muted-foreground h-5 w-5" />
            </button>
          </TableCell>
          {!opts?.hidePrio && (
            <TableCell>
              <span className="rounded-full bg-muted px-3 py-2 text-center text-lg font-semibold">
                {auftrag.prio}
              </span>
            </TableCell>
          )}
          <TableCell>
            <div className="flex flex-col gap-0.5 text-sm">
              <span className="whitespace-nowrap">{auftrag.deadline}</span>
              {auftrag.deadlineBestaetigt && (
                <span className="text-green-600 text-xs">✓ bestätigt</span>
              )}
            </div>
          </TableCell>
          <TableCell className="font-medium">
            <div className="flex flex-col gap-0.5 text-sm">
              <div className="flex items-center gap-1.5">
                <span>{formatCommissionNrDisplay(auftrag.commissionNr)}</span>
                {(() => {
                  const base = getBaseCommissionNr(auftrag.commissionNr);
                  const count = auftraege.filter(
                    (a) => getBaseCommissionNr(a.commissionNr) === base
                  ).length;
                  if (count > 1) {
                    return (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCommissionFilter((prev) =>
                            prev === base ? "" : base
                          );
                        }}
                        className="flex items-center rounded p-0.5 hover:bg-muted"
                        title={`${count} Projekte zu dieser Commission – Filter anwenden`}
                        aria-label={`${count} Projekte, Filter anwenden`}
                      >
                        <Layers className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        <span className="text-muted-foreground ml-0.5 text-[10px] font-medium">
                          {count}
                        </span>
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground">
                <span>{auftrag.projektleiter}</span>
                {(() => {
                  const stepLeads = FERTIGUNG_KEYS.filter((k) => {
                    const s = steps[k];
                    return s?.lead;
                  }).map((k) => `${WORKSHOP_STEP_SHORT[k]}:${steps[k]!.lead}`);
                  if (stepLeads.length === 0) return null;
                  return (
                    <span className="text-xs">
                      · {stepLeads.join(" ")}
                    </span>
                  );
                })()}
              </div>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{auftrag.projektKurzname}</span>
              <span className="text-muted-foreground text-sm">
                {auftrag.kundeName}
              </span>
            </div>
          </TableCell>
          <TableCell
            className={
              auftrag.projektstatus === "fertig"
                ? "bg-green-100 dark:bg-green-900/30"
                : auftrag.projektstatus === "Ready für WS"
                  ? "bg-green-100 dark:bg-green-900/30"
                  : auftrag.projektstatus === "Ready für Transport" ||
                    auftrag.projektstatus === "Transport geplant"
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : isInBearbeitung(auftrag.projektstatus)
                      ? "bg-orange-100 dark:bg-orange-900/30"
                      : ""
            }
          >
            <span className="text-sm">{auftrag.projektstatus}</span>
          </TableCell>
          <TableCell>
            <span className="text-sm">{auftrag.format}</span>
          </TableCell>
          <TableCell>
            <span className="text-sm">{auftrag.transport}</span>
          </TableCell>
          <TableCell>
            <span className="text-sm">
              {auftrag.deadlineBestaetigt ? "ja" : "nein"}
            </span>
          </TableCell>
          <TableCell>
            <span className="text-sm">{auftrag.blechTyp}</span>
          </TableCell>
          <TableCell>
            <div className="flex flex-col text-sm">
              <span>{auftrag.anzahl} Stk.</span>
              <span className="text-muted-foreground">
                {auftrag.flaechM2.toFixed(1)} m²
              </span>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-nowrap items-center gap-1 text-[10px]">
              {[
                ["S", auftrag.scheren],
                ["L", auftrag.lasern],
                ["K", auftrag.kanten],
                ["W", auftrag.schweissen],
                ["B", auftrag.behandeln],
                ["E", auftrag.eckenGefeilt],
              ].map(([short, active]) => (
                <span
                  key={String(short)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {short}
                </span>
              ))}
            </div>
          </TableCell>
          <TableCell>
            {auftrag.hatOriginalDatei ? (
              <Badge variant="secondary" className="text-xs w-fit">
                {auftrag.originalDateiName ?? "Original"}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm">–</span>
            )}
          </TableCell>
          <TableCell>
            {auftrag.hatReadyDatei ? (
              <Badge variant="secondary" className="text-xs w-fit">
                {auftrag.readyDateiName ?? "ready"}
              </Badge>
            ) : (
              <span className="text-muted-foreground text-sm">–</span>
            )}
          </TableCell>
          <TableCell>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
              {benoetigteSchritte.map((key) => {
                const step = steps[key];
                if (!step) return null;
                const short = { scheren: "S", lasern: "L", kanten: "K", schweissen: "W", behandeln: "B", eckenGefeilt: "E" }[key];
                return (
                  <span key={key} className="text-muted-foreground whitespace-nowrap">
                    {short} {formatMinuteSeconds(step.totalMinutes, step.startedAt)}
                  </span>
                );
              })}
              {benoetigteSchritte.length === 0 && (
                <span className="text-muted-foreground">–</span>
              )}
            </div>
          </TableCell>
          <TableCell className="w-10">
            <button
              type="button"
              className="flex items-center justify-center rounded p-1 hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(auftrag.id);
              }}
              aria-label={isExpanded ? "Zuklappen" : "Aufklappen"}
            >
              {isExpanded ? (
                <ChevronUp className="text-muted-foreground h-5 w-5" />
              ) : (
                <ChevronDown className="text-muted-foreground h-5 w-5" />
              )}
            </button>
          </TableCell>
        </TableRow>
        {isExpanded && (
          <TableRow className="bg-muted/20 hover:bg-muted/20">
            <TableCell colSpan={opts?.hidePrio ? 15 : 16} className="p-0">
              {renderExpandedContent(auftrag)}
            </TableCell>
          </TableRow>
        )}
      </Fragment>
    );
  };

  const tableHeader = (
    <TableRow className="bg-muted/60 text-sm">
      <TableHead className="w-14"></TableHead>
      <TableHead className="min-w-[80px]">Prio</TableHead>
      <TableHead className="min-w-[170px]">Deadline</TableHead>
      <TableHead className="min-w-[130px]">Commission / Projektleiter</TableHead>
      <TableHead className="min-w-[180px]">Projekt / Kunde</TableHead>
      <TableHead className="min-w-[140px]">Projektstatus</TableHead>
      <TableHead className="min-w-[100px]">Format</TableHead>
      <TableHead className="min-w-[140px]">Transport</TableHead>
      <TableHead className="min-w-[90px]">Deadline bestätigt</TableHead>
      <TableHead className="min-w-[140px]">Blech</TableHead>
      <TableHead className="min-w-[110px]">Anz. / m²</TableHead>
      <TableHead className="min-w-[150px]">Fertigung</TableHead>
      <TableHead className="min-w-[160px]">Pläne Original</TableHead>
      <TableHead className="min-w-[160px]">Pläne ready</TableHead>
      <TableHead className="min-w-[200px]">Arbeitsschritte</TableHead>
      <TableHead className="w-10"></TableHead>
    </TableRow>
  );

  const tableHeaderFertig = (
    <TableRow className="bg-muted/60 text-sm">
      <TableHead className="w-14"></TableHead>
      <TableHead className="min-w-[170px]">Deadline</TableHead>
      <TableHead className="min-w-[130px]">Commission / Projektleiter</TableHead>
      <TableHead className="min-w-[180px]">Projekt / Kunde</TableHead>
      <TableHead className="min-w-[140px]">Projektstatus</TableHead>
      <TableHead className="min-w-[100px]">Format</TableHead>
      <TableHead className="min-w-[140px]">Transport</TableHead>
      <TableHead className="min-w-[90px]">Deadline bestätigt</TableHead>
      <TableHead className="min-w-[140px]">Blech</TableHead>
      <TableHead className="min-w-[110px]">Anz. / m²</TableHead>
      <TableHead className="min-w-[150px]">Fertigung</TableHead>
      <TableHead className="min-w-[160px]">Pläne Original</TableHead>
      <TableHead className="min-w-[160px]">Pläne ready</TableHead>
      <TableHead className="min-w-[200px]">Arbeitsschritte</TableHead>
      <TableHead className="w-10"></TableHead>
    </TableRow>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-[1800px] items-center gap-2 pb-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Home
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/planung">Planung</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/auswertung">Auswertung</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/benutzer">Benutzer</Link>
        </Button>
      </div>
      <Card className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-4">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl sm:text-3xl">
              Auftragsliste – Werkstatt
            </CardTitle>
            <CardDescription>
              Alle Spalten wie Planung, nur Einsicht. Zeile oder Stift-Icon
              antippen zum Aufklappen – Bearbeitung nur dort.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          {commissionFilter && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                Filter: Commission {commissionFilter}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setCommissionFilter("")}
              >
                Filter löschen
              </Button>
            </div>
          )}
          <div className="mt-4 flex-1 overflow-hidden rounded-xl border bg-card">
            <div className="max-h-[85vh] flex flex-col gap-8 overflow-auto p-4">
              {/* Tabelle 1: Ready für WS · Bearbeitung in WS */}
              <section className="flex flex-col gap-3 rounded-lg border-2 border-green-200 bg-green-50/50 p-4 shadow-sm dark:border-green-800 dark:bg-green-950/20">
                <h2 className="border-l-4 border-green-600 pl-3 text-lg font-semibold dark:border-green-500">
                  Ready für WS · Bearbeitung in WS
                </h2>
                <Table className="text-base">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    {tableHeader}
                  </TableHeader>
                  <TableBody>
                    {tab1.map(renderRow)}
                    {tab1.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={16} className="py-8 text-center text-muted-foreground">
                          Keine Aufträge in dieser Kategorie.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </section>

              {/* Tabelle Transport */}
              <section className="flex flex-col gap-3 rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4 shadow-sm dark:border-blue-800 dark:bg-blue-950/20">
                <h2 className="border-l-4 border-blue-600 pl-3 text-lg font-semibold dark:border-blue-500">
                  Transport
                </h2>
                <Table className="text-base">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    {tableHeader}
                  </TableHeader>
                  <TableBody>
                    {transport.map(renderRow)}
                    {transport.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={16} className="py-8 text-center text-muted-foreground">
                          Keine Aufträge in dieser Kategorie.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </section>

              {/* Tabelle 2: In Bearbeitung */}
              <section className="flex flex-col gap-3 rounded-lg border-2 border-amber-200 bg-amber-50/50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/20">
                <h2 className="border-l-4 border-amber-600 pl-3 text-lg font-semibold dark:border-amber-500">
                  Offen · Bearbeitung in TB
                </h2>
                <Table className="text-base">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    {tableHeader}
                  </TableHeader>
                  <TableBody>
                    {tab2.map(renderRow)}
                    {tab2.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={16} className="py-8 text-center text-muted-foreground">
                          Keine Aufträge in Bearbeitung.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </section>

              {/* Tabelle 3: Fertig */}
              <section className="flex flex-col gap-3 rounded-lg border-2 border-slate-200 bg-slate-50/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                <h2 className="border-l-4 border-slate-600 pl-3 text-lg font-semibold dark:border-slate-400">
                  Fertige Aufträge
                </h2>
                <Table className="text-base">
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    {tableHeaderFertig}
                  </TableHeader>
                  <TableBody>
                    {tab3.map((a) => renderRow(a, { hidePrio: true }))}
                    {tab3.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={15} className="py-8 text-center text-muted-foreground">
                          Noch keine fertigen Aufträge.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </section>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
