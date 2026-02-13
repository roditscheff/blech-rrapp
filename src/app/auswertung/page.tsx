"use client";

import { Badge } from "@/components/ui/badge";
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
import { formatDateTimeCH } from "@/lib/utils";
import { createStepState } from "@/lib/auftrag-data";
import type { Auftrag, WorkStepKey } from "@/lib/auftrag-types";
import { workStepLabels } from "@/lib/auftrag-types";

const WORK_STEP_KEYS: WorkStepKey[] = [
  "tb",
  "scheren",
  "lasern",
  "kanten",
  "schweissen",
  "behandeln",
  "eckenGefeilt",
];

const WORK_STEP_SHORT: Record<WorkStepKey, string> = {
  tb: "TB",
  scheren: "S",
  lasern: "L",
  kanten: "K",
  schweissen: "W",
  behandeln: "B",
  eckenGefeilt: "E",
};

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

function formatMinutes(totalMinutes: number): string {
  const m = Math.floor(totalMinutes);
  const s = Math.round((totalMinutes - m) * 60);
  return `${m}'${s.toString().padStart(2, "0")}''`;
}

export default function AuswertungPage() {
  const { auftraege } = useAuftrag();

  const fertigeAuftraege = auftraege
    .filter((a) => a.projektstatus === "fertig")
    .sort((a, b) => {
      const da = new Date(a.deadline).getTime();
      const db = new Date(b.deadline).getTime();
      return db - da;
    });

  return (
    <div className="flex min-h-screen flex-col bg-background px-3 py-4 sm:px-6 sm:py-6">
      <Card className="mx-auto flex w-full max-w-[2000px] flex-1 flex-col gap-4">
        <CardHeader>
          <CardTitle className="text-2xl sm:text-3xl">
            Auswertung – Fertige Projekte
          </CardTitle>
          <CardDescription>
            Alle abgeschlossenen Aufträge mit Stammdaten und erfassten
            Arbeitszeiten pro Arbeitsschritt.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader className="bg-muted/60 sticky top-0 z-10 text-sm">
                <TableRow>
                  <TableHead className="min-w-[120px]">
                    Commission / PL
                  </TableHead>
                  <TableHead className="min-w-[180px]">
                    Projekt / Kunde
                  </TableHead>
                  <TableHead className="min-w-[140px]">Deadline</TableHead>
                  <TableHead className="min-w-[200px]">
                    Blech · Format
                  </TableHead>
                  <TableHead className="min-w-[140px]">Transport</TableHead>
                  <TableHead className="min-w-[90px]">Anz. / m²</TableHead>
                  <TableHead className="min-w-[120px]">Fertigung</TableHead>
                  {WORK_STEP_KEYS.map((key) => (
                    <TableHead
                      key={key}
                      className="min-w-[70px] text-center"
                      title={workStepLabels[key]}
                    >
                      {WORK_STEP_SHORT[key]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fertigeAuftraege.map((auftrag) => {
                  const steps =
                    auftrag.steps ?? createStepState(auftrag);
                  return (
                    <TableRow
                      key={auftrag.id}
                      className="text-base hover:bg-muted/60 bg-white"
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-0.5 text-sm">
                          <span>{formatCommissionNrDisplay(auftrag.commissionNr)}</span>
                          <span className="text-muted-foreground">
                            {auftrag.projektleiter}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-sm">
                          <span className="font-medium">
                            {auftrag.projektKurzname}
                          </span>
                          <span className="text-muted-foreground">
                            {auftrag.kundeName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span>{formatDateTimeCH(auftrag.deadline)}</span>
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              fix
                            </Badge>
                          </div>
                          {auftrag.fertigAm && (
                            <span className="text-muted-foreground text-xs">
                              Fertig: {formatDateTimeCH(auftrag.fertigAm)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {auftrag.blechTyp} · {auftrag.format}
                      </TableCell>
                      <TableCell className="text-sm">
                        {auftrag.transport}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {auftrag.anzahl} Stk. / {auftrag.flaechM2.toFixed(1)} m²
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-0.5">
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
                              className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] ${
                                active
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                              title={String(short)}
                            >
                              {short}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      {WORK_STEP_KEYS.map((key) => {
                        const step = steps[key];
                        const min =
                          step?.erforderlich
                            ? formatMinutes(step.totalMinutes)
                            : "–";
                        const whoInfo = step
                          ? [step.startedBy && `▶ ${step.startedBy}`, step.pausedBy && `⏸ ${step.pausedBy}`, step.stoppedBy && `⏹ ${step.stoppedBy}`]
                              .filter(Boolean)
                              .join(" · ")
                          : "";
                        return (
                          <TableCell
                            key={key}
                            className="text-center text-sm tabular-nums"
                            title={whoInfo ? `${workStepLabels[key]}: ${whoInfo}` : workStepLabels[key]}
                          >
                            {min}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
                {fertigeAuftraege.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7 + WORK_STEP_KEYS.length}
                      className="py-12 text-center"
                    >
                      <span className="text-muted-foreground">
                        Noch keine fertigen Aufträge.
                      </span>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
