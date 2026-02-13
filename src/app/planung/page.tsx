"use client";

import { Fragment, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { useAuftrag } from "@/context/auftrag-context";
import {
  canSetFertig,
  canSetReadyFürTransport,
  canSetTransportGeplant,
  createStepState,
} from "@/lib/auftrag-data";
import { formatDateTimeCH } from "@/lib/utils";
import type { WorkStepKey, WorkStepState } from "@/lib/auftrag-types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ChevronDown, ChevronUp, Copy, Layers, Pause, Play, Search, Square, Trash2 } from "lucide-react";

type Projektstatus =
  | "offen"
  | "Bearbeitung in TB"
  | "Ready für WS"
  | "Bearbeitung in WS"
  | "Transport geplant"
  | "Ready für Transport"
  | "fertig";

type TransportOption =
  | "Kein Transport"
  | "Transport Zwingen-Birsfelden"
  | "Transport Birsfelden-Zwingen"
  | "Transport zu Kunde";

type Projektleiter = "rero" | "niro" | "alja" | "tbd";

type Auftrag = {
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
  // Datei-Infos (nur im Frontend-State)
  hatOriginalDatei: boolean;
  originalDateiName?: string;
  hatReadyDatei: boolean;
  readyDateiName?: string;
  // geplante Fertigungsschritte
  scheren: boolean;
  lasern: boolean;
  kanten: boolean;
  schweissen: boolean;
  behandeln: boolean;
  eckenGefeilt: boolean;
  steps?: Record<WorkStepKey, WorkStepState>;
  fertigAm?: string;
};

type NewAuftrag = {
  commissionNr: string;
  projektleiter: Projektleiter;
  projektKurzname: string;
  kundeName: string;
  prio: number;
  projektstatus: Projektstatus;
  deadline: string;
  blechTyp: string;
  format: string;
  transport: TransportOption;
  anzahl: number;
  flaechM2: number;
  scheren: boolean;
  lasern: boolean;
  kanten: boolean;
  schweissen: boolean;
  behandeln: boolean;
  eckenGefeilt: boolean;
  deadlineBestaetigt: boolean;
};

const createEmptyNewAuftrag = (): NewAuftrag => {
  const now = new Date();
  const isoLocal = new Date(
    now.getTime() - now.getTimezoneOffset() * 60 * 1000,
  )
    .toISOString()
    .slice(0, 16);

  return {
    commissionNr: "",
    projektleiter: "tbd",
    projektKurzname: "",
    kundeName: "",
    prio: 1,
    projektstatus: "offen",
    deadline: isoLocal,
    blechTyp: "",
    format: "",
    transport: "Kein Transport",
    anzahl: 1,
    flaechM2: 0,
    scheren: false,
    lasern: false,
    kanten: false,
    schweissen: false,
    behandeln: false,
    eckenGefeilt: false,
    deadlineBestaetigt: false,
  };
};

const createDefaultFileState = () => ({
  hatOriginalDatei: false,
  originalDateiName: undefined as string | undefined,
  hatReadyDatei: false,
  readyDateiName: undefined as string | undefined,
});

const createDefaultSteps = (s: boolean, l: boolean, k: boolean, w: boolean, b: boolean, e: boolean) => ({
  scheren: s, lasern: l, kanten: k, schweissen: w, behandeln: b, eckenGefeilt: e,
});

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

/** Commission-Nr. immer 6-stellig mit führenden Nullen (nur Basis, ohne Suffix) */
function formatCommissionNr(nr: string): string {
  return nr.replace(/\D/g, "").padStart(6, "0").slice(0, 6);
}

/** Basis-Commission (6 Ziffern) für Gruppierung */
function getBaseCommissionNr(nr: string): string {
  const beforeHyphen = nr.split("-")[0]?.trim() || nr;
  return formatCommissionNr(beforeHyphen);
}

/** Anzeige inkl. Suffix (024016-1, 024016-2) */
function formatCommissionNrDisplay(nr: string): string {
  const base = getBaseCommissionNr(nr);
  const suffix = nr.includes("-") ? nr.substring(nr.indexOf("-")) : "";
  return base + suffix;
}

/** Commission mit Suffix bei Duplikaten: 024016-1, 024016-2 */
function computeCommissionNrWithSuffix(
  base: string,
  auftraege: Auftrag[],
  excludeId?: number
): string {
  const normalizedBase = formatCommissionNr(base);
  const sameBase = auftraege.filter(
    (a) => a.id !== excludeId && getBaseCommissionNr(a.commissionNr) === normalizedBase
  );
  const count = sameBase.length;
  return `${normalizedBase}-${count + 1}`;
}

/** "Ready für WS" nur wenn Pläne hochgeladen und alle Pflichtfelder ausgefüllt */
function canSetReadyFürWS(a: {
  hatReadyDatei: boolean;
  commissionNr: string;
  projektKurzname: string;
  kundeName: string;
  blechTyp: string;
  format: string;
  deadline: string;
  anzahl: number;
  scheren: boolean;
  lasern: boolean;
  kanten: boolean;
  schweissen: boolean;
  behandeln: boolean;
  eckenGefeilt: boolean;
}): boolean {
  if (!a.hatReadyDatei) return false;
  if (!a.commissionNr.trim()) return false;
  if (!a.projektKurzname.trim()) return false;
  if (!a.kundeName.trim()) return false;
  if (!a.blechTyp.trim()) return false;
  if (!a.format.trim()) return false;
  if (!a.deadline || Number.isNaN(new Date(a.deadline).getTime()))
    return false;
  if (a.anzahl < 1) return false;
  const hasStep =
    a.scheren ||
    a.lasern ||
    a.kanten ||
    a.schweissen ||
    a.behandeln ||
    a.eckenGefeilt;
  if (!hasStep) return false;
  return true;
}

const FERTIGUNG_OPTIONEN = [
  ["scheren", "Scheren"],
  ["lasern", "Lasern"],
  ["kanten", "Kanten"],
  ["schweissen", "Schweissen"],
  ["behandeln", "Behandeln"],
  ["eckenGefeilt", "Ecken gefeilt"],
] as const;

function getDeadlineDate(deadline: string): Date | null {
  const d = new Date(deadline);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekBounds(d: Date): { start: Date; end: Date } {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Montag = 1
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { start: mon, end: sun };
}

type SpaltenFilter = {
  commission: string;
  projektKunde: string;
  projektstatus: string;
  format: string;
  transport: string;
  deadlineBestaetigt: string;
  blech: string;
  fertigung: string;
  deadlineFilter: string;
  deadlineDatum: string;
};

const leereFilter: SpaltenFilter = {
  commission: "",
  projektKunde: "",
  projektstatus: "",
  format: "",
  transport: "",
  deadlineBestaetigt: "",
  blech: "",
  fertigung: "",
  deadlineFilter: "",
  deadlineDatum: "",
};

function filterAuftraege<T extends Auftrag>(
  liste: T[],
  f: SpaltenFilter
): T[] {
  return liste.filter((a) => {
    if (f.commission) {
      const nr = formatCommissionNr(a.commissionNr);
      const such = f.commission.replace(/\D/g, "");
      if (such && !nr.includes(such)) return false;
    }
    if (f.projektKunde) {
      const such = f.projektKunde.toLowerCase();
      if (
        !a.projektKurzname.toLowerCase().includes(such) &&
        !a.kundeName.toLowerCase().includes(such)
      )
        return false;
    }
    if (f.projektstatus && a.projektstatus !== f.projektstatus) return false;
    if (f.format && !a.format.toLowerCase().includes(f.format.toLowerCase()))
      return false;
    if (f.transport && a.transport !== f.transport) return false;
    if (f.deadlineBestaetigt) {
      const ja = f.deadlineBestaetigt === "ja";
      if (a.deadlineBestaetigt !== ja) return false;
    }
    if (f.blech && !a.blechTyp.toLowerCase().includes(f.blech.toLowerCase()))
      return false;
    if (f.fertigung) {
      const key = f.fertigung as (typeof FERTIGUNG_OPTIONEN)[number][0];
      if (!(a[key] as boolean)) return false;
    }
    if (f.deadlineFilter && f.deadlineFilter !== "alteste" && f.deadlineFilter !== "neueste") {
      const dl = getDeadlineDate(a.deadline);
      if (!dl) return false;
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const today = now;
      if (f.deadlineFilter === "heute") {
        if (!isSameDay(dl, today)) return false;
      } else if (f.deadlineFilter === "morgen") {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (!isSameDay(dl, tomorrow)) return false;
      } else if (f.deadlineFilter === "woche") {
        const { start, end } = getWeekBounds(now);
        if (dl < start || dl > end) return false;
      } else if (f.deadlineFilter === "datum" && f.deadlineDatum) {
        const target = new Date(f.deadlineDatum);
        target.setHours(0, 0, 0, 0);
        const dlNorm = new Date(dl);
        dlNorm.setHours(0, 0, 0, 0);
        if (dlNorm.getTime() !== target.getTime()) return false;
      }
    }
    return true;
  });
}

function sortByDeadlineFilter<T extends Auftrag>(
  liste: T[],
  deadlineFilter: string
): T[] {
  if (deadlineFilter !== "alteste" && deadlineFilter !== "neueste")
    return [...liste];
  return [...liste].sort((a, b) => {
    const da = getDeadlineDate(a.deadline)?.getTime() ?? 0;
    const db = getDeadlineDate(b.deadline)?.getTime() ?? 0;
    return deadlineFilter === "alteste" ? da - db : db - da;
  });
}

export default function PlanungPage() {
  const {
    auftraege,
    setAuftraege,
    setDateiStore,
    updateAuftrag,
    updateAuftragFromPlanung,
    dateiStore,
    addFileOriginal,
    addFileReady,
    stepAction,
  } = useAuftrag();
  const [formMode, setFormMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formAuftrag, setFormAuftrag] = useState<NewAuftrag>(() =>
    createEmptyNewAuftrag(),
  );
  const [filter, setFilter] = useState<SpaltenFilter>(leereFilter);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [, forceUpdate] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);

  const hasRunningTb = auftraege.some(
    (a) => a.steps?.tb?.isRunning
  );
  useEffect(() => {
    if (!hasRunningTb) return;
    const id = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [hasRunningTb]);

  const tab1Base = auftraege
    .filter((a) =>
      a.projektstatus === "Ready für WS" ||
      a.projektstatus === "Bearbeitung in WS"
    )
    .sort((a, b) => a.prio - b.prio);
  const transportBase = auftraege
    .filter((a) =>
      a.projektstatus === "Ready für Transport" ||
      a.projektstatus === "Transport geplant"
    )
    .sort((a, b) => a.prio - b.prio);
  const tab2Base = auftraege
    .filter((a) =>
      a.projektstatus === "offen" || a.projektstatus === "Bearbeitung in TB"
    )
    .sort((a, b) => a.prio - b.prio);
  const tab3Base = auftraege
    .filter((a) => a.projektstatus === "fertig")
    .sort((a, b) => a.prio - b.prio);

  const filterBySearch = <T extends Auftrag>(list: T[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.trim().toLowerCase();
    return list.filter(
      (a) =>
        a.commissionNr.toLowerCase().includes(q) ||
        a.projektKurzname.toLowerCase().includes(q) ||
        a.kundeName.toLowerCase().includes(q) ||
        a.projektleiter.toLowerCase().includes(q) ||
        a.blechTyp.toLowerCase().includes(q) ||
        a.format.toLowerCase().includes(q) ||
        a.transport.toLowerCase().includes(q)
    );
  };

  const tab1Auftraege = sortByDeadlineFilter(
    filterAuftraege(filterBySearch(tab1Base), filter),
    filter.deadlineFilter,
  );
  const transportAuftraege = sortByDeadlineFilter(
    filterAuftraege(filterBySearch(transportBase), filter),
    filter.deadlineFilter,
  );
  const tab2Auftraege = sortByDeadlineFilter(
    filterAuftraege(filterBySearch(tab2Base), filter),
    filter.deadlineFilter,
  );
  const tab3Auftraege = sortByDeadlineFilter(
    filterAuftraege(filterBySearch(tab3Base), filter),
    filter.deadlineFilter,
  );

  const handlePrioChange = (id: number, delta: 1 | -1) => {
    setAuftraege((prev) => {
      const updated = prev.map((a) => {
        if (a.id !== id) return a;
        const next = { ...a, prio: Math.max(1, a.prio + delta) };
        if (a.projektstatus === "Bearbeitung in WS") {
          next.aenderungenDurchPlanung = true;
        }
        return next;
      });

      // Nach Prio sortieren, damit sich die Zeile entsprechend verschiebt
      return [...updated].sort((a, b) => {
        if (a.prio === b.prio) {
          return a.id - b.id;
        }
        return a.prio - b.prio;
      });
    });
  };

  const handleOriginalFileChange = (
    id: number,
    fileList: FileList | null,
  ) => {
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    addFileOriginal(id, file);
    updateAuftragFromPlanung(id, {
      hatOriginalDatei: true,
      originalDateiName: file.name,
    });
  };

  const handleReadyFileChange = (id: number, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
    const auftrag = auftraege.find((a) => a.id === id);
    if (!auftrag) return;

    addFileReady(id, file);
    const mitDatei = { ...auftrag, hatReadyDatei: true };
    updateAuftragFromPlanung(id, {
      hatReadyDatei: true,
      readyDateiName: file.name,
      ...(canSetReadyFürWS(mitDatei) && { projektstatus: "Ready für WS" }),
    });
  };

  const handleDownloadOriginal = (id: number) => {
    const blob = dateiStore.get(id)?.original;
    const auftrag = auftraege.find((a) => a.id === id);
    if (!blob || !auftrag?.originalDateiName) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = auftrag.originalDateiName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadReady = (id: number) => {
    const blob = dateiStore.get(id)?.ready;
    const auftrag = auftraege.find((a) => a.id === id);
    if (!blob || !auftrag?.readyDateiName) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = auftrag.readyDateiName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getNextId = () =>
    auftraege.length === 0
      ? 1
      : Math.max(...auftraege.map((a) => a.id)) + 1;

  const handleOpenNewAuftrag = () => {
    setFormAuftrag(createEmptyNewAuftrag());
    setEditingId(null);
    setFormMode("create");
  };

  const handleOpenEditAuftrag = (auftrag: Auftrag) => {
    setFormAuftrag({
      commissionNr: auftrag.commissionNr,
      projektleiter: auftrag.projektleiter,
      projektKurzname: auftrag.projektKurzname,
      kundeName: auftrag.kundeName,
      prio: auftrag.prio,
      projektstatus: auftrag.projektstatus,
      deadline: auftrag.deadline,
      blechTyp: auftrag.blechTyp,
      anzahl: auftrag.anzahl,
      flaechM2: auftrag.flaechM2,
      format: auftrag.format,
      transport: auftrag.transport,
      scheren: auftrag.scheren,
      lasern: auftrag.lasern,
      kanten: auftrag.kanten,
      schweissen: auftrag.schweissen,
      behandeln: auftrag.behandeln,
      eckenGefeilt: auftrag.eckenGefeilt,
      deadlineBestaetigt: auftrag.deadlineBestaetigt,
    });
    setEditingId(auftrag.id);
    setFormMode("edit");
  };

  const hasUnsavedChanges = (a: Auftrag) => {
    return (
      formAuftrag.commissionNr !== a.commissionNr ||
      formAuftrag.projektleiter !== a.projektleiter ||
      formAuftrag.projektKurzname !== a.projektKurzname ||
      formAuftrag.kundeName !== a.kundeName ||
      formAuftrag.prio !== a.prio ||
      formAuftrag.projektstatus !== a.projektstatus ||
      formAuftrag.deadline !== a.deadline ||
      formAuftrag.blechTyp !== a.blechTyp ||
      formAuftrag.format !== a.format ||
      formAuftrag.transport !== a.transport ||
      formAuftrag.anzahl !== a.anzahl ||
      formAuftrag.flaechM2 !== a.flaechM2 ||
      formAuftrag.scheren !== a.scheren ||
      formAuftrag.lasern !== a.lasern ||
      formAuftrag.kanten !== a.kanten ||
      formAuftrag.schweissen !== a.schweissen ||
      formAuftrag.behandeln !== a.behandeln ||
      formAuftrag.eckenGefeilt !== a.eckenGefeilt ||
      formAuftrag.deadlineBestaetigt !== a.deadlineBestaetigt
    );
  };

  const showBitteSpeichern = () => {
    setNotification("Bitte speichern");
    setTimeout(() => setNotification(null), 3000);
  };

  const togglePlanungExpand = (auftrag: Auftrag) => {
    if (editingId === auftrag.id) {
      const a = auftraege.find((x) => x.id === auftrag.id);
      if (a && hasUnsavedChanges(a)) {
        showBitteSpeichern();
        return;
      }
      setFormMode("none");
      setEditingId(null);
    } else {
      handleOpenEditAuftrag(auftrag);
    }
  };

  const handleCopyAuftrag = (auftrag: Auftrag) => {
    const newId = getNextId();
    const { steps: _steps, ...auftragOhneSteps } = auftrag;
    const copy: Auftrag = {
      ...auftragOhneSteps,
      id: newId,
      hatOriginalDatei: false,
      originalDateiName: undefined,
      hatReadyDatei: false,
      readyDateiName: undefined,
      steps: undefined,
    };
    const base = getBaseCommissionNr(auftrag.commissionNr);
    copy.commissionNr = computeCommissionNrWithSuffix(base, [...auftraege, copy]);
    setAuftraege((prev) =>
      [...prev, copy].sort((a, b) => {
        if (a.prio === b.prio) return a.id - b.id;
        return a.prio - b.prio;
      }),
    );
    handleOpenEditAuftrag(copy);
  };

  const LOESCHBARE_STATI: Projektstatus[] = [
    "offen",
    "Bearbeitung in TB",
    "Ready für WS",
  ];

  const handleDeleteAuftrag = (auftrag: Auftrag) => {
    if (!LOESCHBARE_STATI.includes(auftrag.projektstatus)) return;
    const bestaetigt = window.confirm(
      `Soll das Projekt "${auftrag.projektKurzname}" (${formatCommissionNrDisplay(auftrag.commissionNr)}) unwiderruflich gelöscht werden?`
    );
    if (!bestaetigt) return;
    setAuftraege((prev) => prev.filter((a) => a.id !== auftrag.id));
    setDateiStore((prev) => {
      const next = new Map(prev);
      next.delete(auftrag.id);
      return next;
    });
    if (editingId === auftrag.id) {
      setFormMode("none");
      setEditingId(null);
    }
  };

  const handleCancelForm = () => {
    setFormMode("none");
    setEditingId(null);
  };

  const handleSaveAuftrag = () => {
    if (formMode === "create") {
      const base = formatCommissionNr(formAuftrag.commissionNr.trim());
      const commissionNr = computeCommissionNrWithSuffix(base, auftraege);
      const created: Auftrag = {
        id: getNextId(),
        commissionNr,
        projektleiter: formAuftrag.projektleiter,
        projektKurzname: formAuftrag.projektKurzname.trim(),
        kundeName: formAuftrag.kundeName.trim(),
        prio: formAuftrag.prio,
        projektstatus: formAuftrag.projektstatus,
        deadline: formAuftrag.deadline,
        deadlineBestaetigt: formAuftrag.deadlineBestaetigt,
        blechTyp: formAuftrag.blechTyp.trim(),
        format: formAuftrag.format.trim(),
        transport: formAuftrag.transport,
        anzahl: formAuftrag.anzahl,
        flaechM2: formAuftrag.flaechM2,
        hatOriginalDatei: false,
        originalDateiName: undefined,
        hatReadyDatei: false,
        readyDateiName: undefined,
        scheren: formAuftrag.scheren,
        lasern: formAuftrag.lasern,
        kanten: formAuftrag.kanten,
        schweissen: formAuftrag.schweissen,
        behandeln: formAuftrag.behandeln,
        eckenGefeilt: formAuftrag.eckenGefeilt,
      };

      setAuftraege((prev) =>
        [...prev, created].sort((a, b) => {
          if (a.prio === b.prio) {
            return a.id - b.id;
          }
          return a.prio - b.prio;
        }),
      );
    } else if (formMode === "edit" && editingId != null) {
      const existierend = auftraege.find((a) => a.id === editingId);
      const base = formatCommissionNr(formAuftrag.commissionNr.trim());
      const prevBase = existierend
        ? getBaseCommissionNr(existierend.commissionNr)
        : "";
      const commissionNr =
        base === prevBase
          ? existierend!.commissionNr
          : computeCommissionNrWithSuffix(base, auftraege, editingId);
      const nachUpdate = {
        ...existierend!,
        commissionNr,
        projektleiter: formAuftrag.projektleiter,
        projektKurzname: formAuftrag.projektKurzname.trim(),
        kundeName: formAuftrag.kundeName.trim(),
        prio: formAuftrag.prio,
        projektstatus: formAuftrag.projektstatus,
        deadline: formAuftrag.deadline,
        deadlineBestaetigt: formAuftrag.deadlineBestaetigt,
        blechTyp: formAuftrag.blechTyp.trim(),
        format: formAuftrag.format.trim(),
        transport: formAuftrag.transport,
        anzahl: formAuftrag.anzahl,
        flaechM2: formAuftrag.flaechM2,
        scheren: formAuftrag.scheren,
        lasern: formAuftrag.lasern,
        kanten: formAuftrag.kanten,
        schweissen: formAuftrag.schweissen,
        behandeln: formAuftrag.behandeln,
        eckenGefeilt: formAuftrag.eckenGefeilt,
      };
      const projektstatus =
        formAuftrag.projektstatus === "Ready für WS" &&
        !canSetReadyFürWS(nachUpdate)
          ? existierend!.projektstatus
          : formAuftrag.projektstatus;
      setAuftraege((prev) =>
        prev.map((a) => {
          if (a.id !== editingId) return a;
          const next = {
            ...a,
            commissionNr,
            projektKurzname: formAuftrag.projektKurzname.trim(),
            kundeName: formAuftrag.kundeName.trim(),
            prio: formAuftrag.prio,
            projektstatus,
            deadline: formAuftrag.deadline,
            deadlineBestaetigt: formAuftrag.deadlineBestaetigt,
            blechTyp: formAuftrag.blechTyp.trim(),
            format: formAuftrag.format.trim(),
            transport: formAuftrag.transport,
            anzahl: formAuftrag.anzahl,
            flaechM2: formAuftrag.flaechM2,
            scheren: formAuftrag.scheren,
            lasern: formAuftrag.lasern,
            kanten: formAuftrag.kanten,
            schweissen: formAuftrag.schweissen,
            behandeln: formAuftrag.behandeln,
            eckenGefeilt: formAuftrag.eckenGefeilt,
          };
          if (existierend!.projektstatus === "Bearbeitung in WS") {
            next.aenderungenDurchPlanung = true;
          }
          return next;
        }).sort((a, b) => {
          if (a.prio === b.prio) {
            return a.id - b.id;
          }
          return a.prio - b.prio;
        }),
      );
    }

    setFormMode("none");
    setEditingId(null);
  };

  const getRowClassName = (auftrag: Auftrag) => {
    const base = "text-base hover:bg-muted/60 bg-white";

    // Zeile nur orange, wenn 1 Tag vor Deadline und noch nicht fertig
    if (auftrag.projektstatus !== "fertig" && auftrag.deadline) {
      const deadlineDate = new Date(auftrag.deadline);
      if (!Number.isNaN(deadlineDate.getTime())) {
        const now = new Date();
        const diffMs = deadlineDate.getTime() - now.getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const isInNextDay = diffMs <= oneDayMs && diffMs >= 0;
        if (isInNextDay) {
          return `${base} bg-orange-100`;
        }
      }
    }

    return base;
  };

  const renderPlanungFormContent = () => (
    <div className="space-y-4 rounded-xl border bg-muted/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">
          {formMode === "create" ? "Neuer Auftrag" : "Auftrag bearbeiten"}
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCancelForm}>
            Abbrechen
          </Button>
          <Button onClick={handleSaveAuftrag}>Speichern</Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1 text-sm">
          <div className="font-medium">Commission-Nr. / Projektleiter</div>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              placeholder="6 Ziffern"
              maxLength={6}
              inputMode="numeric"
              value={formAuftrag.commissionNr}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setFormAuftrag((prev) => ({ ...prev, commissionNr: v }));
              }}
            />
            <select
              className="border-input bg-background h-10 min-w-[5rem] rounded-md border px-2 text-sm"
              value={formAuftrag.projektleiter}
              onChange={(e) =>
                setFormAuftrag((prev) => ({
                  ...prev,
                  projektleiter: e.target.value as Projektleiter,
                }))
              }
            >
              <option value="rero">rero</option>
              <option value="niro">niro</option>
              <option value="alja">alja</option>
              <option value="tbd">tbd</option>
            </select>
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="font-medium">Projekt Kurzname</div>
          <Input
            value={formAuftrag.projektKurzname}
            onChange={(e) =>
              setFormAuftrag((prev) => ({ ...prev, projektKurzname: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1 text-sm">
          <div className="font-medium">Kunde</div>
          <Input
            value={formAuftrag.kundeName}
            onChange={(e) =>
              setFormAuftrag((prev) => ({ ...prev, kundeName: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1 text-sm">
          <div className="font-medium">Prio</div>
          <Input
            type="number"
            min={1}
            value={formAuftrag.prio}
            onChange={(e) =>
              setFormAuftrag((prev) => ({
                ...prev,
                prio: Math.max(1, Number(e.target.value) || 1),
              }))
            }
          />
        </div>
        <div className="space-y-1 text-sm">
          <div className="font-medium">Deadline (Datum &amp; Zeit)</div>
          {formMode === "edit" &&
          editingId != null &&
          auftraege.find((a) => a.id === editingId)?.projektstatus === "fertig" ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {formatDateTimeCH(formAuftrag.deadline)}
              </span>
              <Badge variant="secondary" className="text-xs font-normal">
                fix
              </Badge>
            </div>
          ) : (
            <Input
              type="datetime-local"
              value={formAuftrag.deadline}
              onChange={(e) =>
                setFormAuftrag((prev) => ({ ...prev, deadline: e.target.value }))
              }
            />
          )}
        </div>
        <div className="space-y-1 text-sm">
          <div className="font-medium">Deadline bestätigt</div>
          <select
            className="border-input bg-background text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-10 rounded-md border px-2"
            value={formAuftrag.deadlineBestaetigt ? "ja" : "nein"}
            onChange={(e) =>
              setFormAuftrag((prev) => ({
                ...prev,
                deadlineBestaetigt: e.target.value === "ja",
              }))
            }
          >
            <option value="nein">nein</option>
            <option value="ja">ja</option>
          </select>
        </div>
        <div className="space-y-1 text-sm">
          <div className="font-medium">Projektstatus</div>
          {(() => {
            const editAuftrag =
              editingId != null ? auftraege.find((a) => a.id === editingId) : undefined;
            const hatReady =
              formMode === "edit" && editAuftrag ? editAuftrag.hatReadyDatei : false;
            const formData = { ...formAuftrag, hatReadyDatei: hatReady };
            const kannReady = canSetReadyFürWS(formData);
            const kannReadyTransport =
              editAuftrag != null ? canSetReadyFürTransport(editAuftrag) : false;
            const kannTransportGeplant = canSetTransportGeplant({
              projektstatus: formAuftrag.projektstatus,
            } as Auftrag);
            const kannFertig = canSetFertig({
              projektstatus: formAuftrag.projektstatus,
            } as Auftrag);
            return (
              <select
                className="border-input bg-background text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-10 rounded-md border px-2"
                value={formAuftrag.projektstatus}
                onChange={(e) => {
                  const v = e.target.value as Projektstatus;
                  if (v === "Ready für WS" && !kannReady) return;
                  if (v === "Ready für Transport" && !kannReadyTransport) return;
                  if (v === "Transport geplant" && !kannTransportGeplant) return;
                  if (v === "fertig" && !kannFertig) return;
                  setFormAuftrag((prev) => ({ ...prev, projektstatus: v }));
                }}
              >
                <option value="offen">offen</option>
                <option value="Bearbeitung in TB">Bearbeitung in TB</option>
                <option
                  value="Ready für WS"
                  disabled={!kannReady}
                  title={
                    !kannReady
                      ? "Nur möglich wenn Pläne Ready for Work hochgeladen und alle Felder ausgefüllt"
                      : undefined
                  }
                >
                  Ready für WS
                </option>
                <option value="Bearbeitung in WS">Bearbeitung in WS</option>
                <option
                  value="Ready für Transport"
                  disabled={!kannReadyTransport}
                  title={
                    !kannReadyTransport
                      ? "Nur möglich wenn alle Fertigungsschritte gestoppt sind und Mitarbeiter ausgefüllt"
                      : undefined
                  }
                >
                  Ready für Transport
                </option>
                <option
                  value="Transport geplant"
                  disabled={!kannTransportGeplant}
                  title={
                    !kannTransportGeplant
                      ? "Nur möglich wenn vorher Ready für Transport"
                      : undefined
                  }
                >
                  Transport geplant
                </option>
                <option
                  value="fertig"
                  disabled={!kannFertig}
                  title={
                    !kannFertig
                      ? "Nur möglich wenn vorher Transport geplant"
                      : undefined
                  }
                >
                  fertig
                </option>
              </select>
            );
          })()}
        </div>
        <div className="space-y-1 text-sm">
          <div className="font-medium">Blech-Typ</div>
          <Input
            value={formAuftrag.blechTyp}
            onChange={(e) =>
              setFormAuftrag((prev) => ({ ...prev, blechTyp: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1 text-sm">
          <div className="font-medium">Format</div>
          <Input
            value={formAuftrag.format}
            onChange={(e) =>
              setFormAuftrag((prev) => ({ ...prev, format: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1 text-sm">
          <div className="font-medium">Transport</div>
          <select
            className="border-input bg-background text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-10 rounded-md border px-2"
            value={formAuftrag.transport}
            onChange={(e) =>
              setFormAuftrag((prev) => ({
                ...prev,
                transport: e.target.value as TransportOption,
              }))
            }
          >
            <option value="Kein Transport">Kein Transport</option>
            <option value="Transport Zwingen-Birsfelden">
              Transport Zwingen-Birsfelden
            </option>
            <option value="Transport Birsfelden-Zwingen">
              Transport Birsfelden-Zwingen
            </option>
            <option value="Transport zu Kunde">Transport zu Kunde</option>
          </select>
        </div>
        <div className="space-y-1 text-sm">
          <div className="font-medium">Anzahl</div>
          <Input
            type="number"
            min={0}
            value={formAuftrag.anzahl}
            onChange={(e) =>
              setFormAuftrag((prev) => ({
                ...prev,
                anzahl: Number(e.target.value) || 0,
              }))
            }
          />
        </div>
        <div className="space-y-1 text-sm">
          <div className="font-medium">Fläche (m²)</div>
          <Input
            type="number"
            min={0}
            step="0.1"
            value={formAuftrag.flaechM2}
            onChange={(e) =>
              setFormAuftrag((prev) => ({
                ...prev,
                flaechM2: Number(e.target.value) || 0,
              }))
            }
          />
        </div>
        <div className="space-y-1 text-sm">
          <div className="font-medium">Fertigungsschritte</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(
              [
                ["S", "Scheren", "scheren"],
                ["L", "Lasern", "lasern"],
                ["K", "Kanten", "kanten"],
                ["W", "Schweissen", "schweissen"],
                ["B", "Behandeln", "behandeln"],
                ["E", "Ecken", "eckenGefeilt"],
              ] as const
            ).map(([short, label, stepKey]) => {
              const active = formAuftrag[stepKey as keyof NewAuftrag] as boolean;
              const editedAuftrag =
                formMode === "edit" && editingId != null
                  ? auftraege.find((a) => a.id === editingId)
                  : null;
              const steps = editedAuftrag
                ? editedAuftrag.steps ?? createStepState(editedAuftrag)
                : null;
              const step = steps?.[stepKey] ?? null;
              const completed =
                step &&
                step.totalMinutes > 0 &&
                !step.isRunning &&
                !step.isPaused;
              const inBearbeitung = step && (step.isRunning || step.isPaused);
              const badgeClass = !active
                ? "bg-muted text-muted-foreground"
                : completed
                  ? "border-green-600 bg-green-600 text-white"
                  : inBearbeitung
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "bg-primary text-primary-foreground";
              return (
                <button
                  key={stepKey}
                  type="button"
                  className={`flex h-7 items-center justify-center rounded-full border px-2 ${badgeClass}`}
                  onClick={() =>
                    setFormAuftrag((prev) => ({
                      ...prev,
                      [stepKey]: !(prev[stepKey as keyof NewAuftrag] as boolean),
                    }))
                  }
                  title={label}
                >
                  {short}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlanungRow = (auftrag: Auftrag, opts?: { hidePrio?: boolean }) => (
    <Fragment key={auftrag.id}>
      <TableRow
        className={`${getRowClassName(auftrag)} cursor-pointer`}
        onClick={() => togglePlanungExpand(auftrag)}
      >
      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-8 w-8 rounded-full border border-input text-sm"
          onClick={() => togglePlanungExpand(auftrag)}
          aria-label="Auftrag bearbeiten"
        >
          ✎
        </Button>
      </TableCell>
      {!opts?.hidePrio && (
        <TableCell className="w-12 p-1" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col items-center gap-0">
            <Button
              size="icon-sm"
              variant="ghost"
              className="h-6 w-6 shrink-0 rounded p-0 hover:bg-muted"
              onClick={() => handlePrioChange(auftrag.id, 1)}
              aria-label="Prio erhöhen"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <span className="text-center text-base font-semibold tabular-nums">
              {auftrag.prio}
            </span>
            <Button
              size="icon-sm"
              variant="ghost"
              className="h-6 w-6 shrink-0 rounded p-0 hover:bg-muted"
              onClick={() => handlePrioChange(auftrag.id, -1)}
              aria-label="Prio verringern"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      )}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-1">
          {auftrag.projektstatus === "fertig" ? (
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {formatDateTimeCH(auftrag.deadline)}
              </span>
              <Badge variant="secondary" className="text-xs font-normal">
                fix
              </Badge>
            </div>
          ) : (
            <Input
              type="datetime-local"
              className="h-11 text-sm"
              value={auftrag.deadline}
              onChange={(e) =>
                updateAuftragFromPlanung(auftrag.id, {
                  deadline: e.target.value,
                })
              }
            />
          )}
          {auftrag.deadlineBestaetigt && (
            <span
              className="text-green-600 text-sm"
              title="Deadline bestätigt"
            >
              ✓ bestätigt
            </span>
          )}
          {auftrag.projektstatus === "fertig" && auftrag.fertigAm && (
              <span className="text-muted-foreground text-xs">
                Fertig: {formatDateTimeCH(auftrag.fertigAm)}
              </span>
            )}
        </div>
      </TableCell>
      <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
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
                      setFilter((f) => ({ ...f, commission: base }));
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
          <span className="text-muted-foreground">
            {auftrag.projektleiter}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span className="font-medium">
            {auftrag.projektKurzname}
          </span>
          <span className="text-sm text-muted-foreground">
            {auftrag.kundeName}
          </span>
        </div>
      </TableCell>
      <TableCell
        onClick={(e) => e.stopPropagation()}
        className={
          auftrag.projektstatus === "fertig"
            ? "bg-green-100"
            : auftrag.projektstatus === "Ready für WS"
              ? "bg-green-100"
              : auftrag.projektstatus === "Ready für Transport" ||
                  auftrag.projektstatus === "Transport geplant"
                ? "bg-blue-100"
                : auftrag.projektstatus === "Bearbeitung in TB" ||
                    auftrag.projektstatus === "Bearbeitung in WS"
                  ? "bg-orange-100"
                  : ""
        }
      >
        <select
          className="border-input bg-background text-base shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] h-10 min-w-[8rem] rounded-md border px-2"
          value={auftrag.projektstatus}
          onChange={(e) => {
            const v = e.target.value as Projektstatus;
            if (
              v === "Ready für WS" &&
              !canSetReadyFürWS(auftrag)
            )
              return;
            if (
              v === "Ready für Transport" &&
              !canSetReadyFürTransport(auftrag)
            )
              return;
            if (
              v === "Transport geplant" &&
              !canSetTransportGeplant(auftrag)
            )
              return;
            if (v === "fertig" && !canSetFertig(auftrag)) return;
            updateAuftragFromPlanung(auftrag.id, {
              projektstatus: v,
            });
          }}
        >
          <option value="offen">offen</option>
          <option value="Bearbeitung in TB">Bearbeitung in TB</option>
          <option
            value="Ready für WS"
            disabled={!canSetReadyFürWS(auftrag)}
            title={
              !canSetReadyFürWS(auftrag)
                ? "Nur möglich wenn Pläne Ready for Work hochgeladen und alle Felder ausgefüllt"
                : undefined
            }
          >
            Ready für WS
          </option>
          <option value="Bearbeitung in WS">Bearbeitung in WS</option>
          <option
            value="Ready für Transport"
            disabled={!canSetReadyFürTransport(auftrag)}
            title={
              !canSetReadyFürTransport(auftrag)
                ? "Nur möglich wenn alle Fertigungsschritte gestoppt sind und Mitarbeiter ausgefüllt"
                : undefined
            }
          >
            Ready für Transport
          </option>
          <option
            value="Transport geplant"
            disabled={!canSetTransportGeplant(auftrag)}
            title={
              !canSetTransportGeplant(auftrag)
                ? "Nur möglich wenn vorher Ready für Transport"
                : undefined
            }
          >
            Transport geplant
          </option>
          <option
            value="fertig"
            disabled={!canSetFertig(auftrag)}
            title={
              !canSetFertig(auftrag)
                ? "Nur möglich wenn vorher Transport geplant"
                : undefined
            }
          >
            fertig
          </option>
        </select>
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
        <span>{auftrag.blechTyp}</span>
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
          {(
            [
              ["S", auftrag.scheren, "scheren"],
              ["L", auftrag.lasern, "lasern"],
              ["K", auftrag.kanten, "kanten"],
              ["W", auftrag.schweissen, "schweissen"],
              ["B", auftrag.behandeln, "behandeln"],
              ["E", auftrag.eckenGefeilt, "eckenGefeilt"],
            ] as const
          ).map(([short, active, stepKey]) => {
            const steps = auftrag.steps ?? createStepState(auftrag);
            const step = steps[stepKey];
            const completed =
              step &&
              step.totalMinutes > 0 &&
              !step.isRunning &&
              !step.isPaused;
            const inBearbeitung = step && (step.isRunning || step.isPaused);
            const badgeClass = !active
              ? "border-muted bg-muted/50 text-muted-foreground"
              : completed
                ? "border-green-600 bg-green-600 text-white"
                : inBearbeitung
                  ? "border-orange-500 bg-orange-500 text-white"
                  : "border-primary bg-primary text-primary-foreground";
            const whoInfo = step
              ? [step.startedBy && `▶ ${step.startedBy}`, step.pausedBy && `⏸ ${step.pausedBy}`, step.stoppedBy && `⏹ ${step.stoppedBy}`]
                  .filter(Boolean)
                  .join(" · ")
              : "";
            return (
              <span
                key={String(short)}
                title={whoInfo || undefined}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${badgeClass}`}
              >
                {short}
              </span>
            );
          })}
        </div>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-2">
          <Input
            type="file"
            className="h-11 cursor-pointer text-sm"
            onChange={(e) =>
              handleOriginalFileChange(
                auftrag.id,
                e.target.files,
              )
            }
          />
          <div className="flex flex-col gap-1">
            <Badge
              variant={
                auftrag.hatOriginalDatei
                  ? "default"
                  : "outline"
              }
              className="text-xs w-fit"
            >
              {auftrag.hatOriginalDatei
                ? auftrag.originalDateiName ??
                  "Original vorhanden"
                : "Keine Datei"}
            </Badge>
            {auftrag.hatOriginalDatei &&
              dateiStore.get(auftrag.id)?.original && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs w-fit"
                  onClick={() =>
                    handleDownloadOriginal(auftrag.id)
                  }
                >
                  ↓ Herunterladen
                </Button>
              )}
          </div>
        </div>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-2">
          <Input
            type="file"
            className="h-11 cursor-pointer text-sm"
            onChange={(e) =>
              handleReadyFileChange(auftrag.id, e.target.files)
            }
          />
          <div className="flex flex-col gap-1">
            <Badge
              variant={
                auftrag.hatReadyDatei ? "default" : "outline"
              }
              className="text-xs w-fit"
            >
              {auftrag.hatReadyDatei
                ? auftrag.readyDateiName ??
                  "ready for work vorhanden"
                : "Keine Datei"}
            </Badge>
            {auftrag.hatReadyDatei &&
              dateiStore.get(auftrag.id)?.ready && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs w-fit"
                  onClick={() =>
                    handleDownloadReady(auftrag.id)
                  }
                >
                  ↓ Herunterladen
                </Button>
              )}
          </div>
        </div>
      </TableCell>
      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-8 w-8 rounded-full border border-input text-sm"
          onClick={() => handleCopyAuftrag(auftrag)}
          aria-label="Auftrag kopieren"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </TableCell>
      <TableCell className="w-[160px] min-w-[160px]" onClick={(e) => e.stopPropagation()}>
        {(auftrag.projektstatus === "offen" ||
          auftrag.projektstatus === "Bearbeitung in TB") && (() => {
          const steps = auftrag.steps ?? createStepState(auftrag);
          const tb = steps.tb;
          if (!tb) return null;
          const isRunning = tb.isRunning ?? false;
          const isPaused = tb.isPaused ?? false;
          const isActive = isRunning || isPaused;
          return (
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant={isRunning ? "outline" : "default"}
                  className={`h-8 gap-1 text-xs ${
                    isRunning ? "" : "bg-green-600 hover:bg-green-700"
                  }`}
                  onClick={() =>
                    stepAction(auftrag.id, "tb", isRunning ? "pause" : "start")
                  }
                  aria-label={isRunning ? "TB pausieren" : "TB starten"}
                >
                  {isRunning ? (
                    <>
                      <Pause className="h-3.5 w-3.5" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      Start
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1 text-xs bg-red-600 hover:bg-red-700"
                  disabled={!isActive}
                  onClick={() => stepAction(auftrag.id, "tb", "stop")}
                  aria-label="TB stoppen"
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </Button>
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatMinuteSeconds(tb.totalMinutes, tb.startedAt)}
              </span>
            </div>
          );
        })()}
      </TableCell>
      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
        {LOESCHBARE_STATI.includes(auftrag.projektstatus) ? (
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-8 w-8 rounded-full border border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={() => handleDeleteAuftrag(auftrag)}
            aria-label="Auftrag löschen"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <span className="text-muted-foreground text-xs">–</span>
        )}
      </TableCell>
    </TableRow>
    {formMode === "edit" && editingId === auftrag.id && (
      <TableRow className="bg-muted/20 hover:bg-muted/20">
        <TableCell
          colSpan={opts?.hidePrio ? 17 : 18}
          className="p-0 align-top"
        >
          <div className="p-4">{renderPlanungFormContent()}</div>
        </TableCell>
      </TableRow>
    )}
    </Fragment>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background px-3 py-4 sm:px-6 sm:py-6">
      {notification && (
        <div
          className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-500 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 shadow-lg dark:border-amber-600 dark:bg-amber-900/90 dark:text-amber-100"
          role="alert"
        >
          {notification}
        </div>
      )}
      <Card className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-4">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl sm:text-3xl">
              Auftragsliste – Planung &amp; Upload
            </CardTitle>
            <CardDescription>
              Für Projektleiter und Technische Zeichner: Stammdaten pflegen,
              Prio setzen und Pläne &quot;ready for work&quot; hochladen.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              Demo-Daten – ohne Backend
            </Badge>
            <Button
              size="icon-lg"
              variant="outline"
              className="h-10 w-10 rounded-full text-xl"
              onClick={handleOpenNewAuftrag}
              aria-label="Neuen Auftrag anlegen"
            >
              +
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Diese Ansicht bildet die Rolle Projektleiter / Technischer
              Zeichner ab. Änderungen wirken sich nur lokal im Browser aus.
            </p>
          </div>

          {formMode === "create" && (
            <div className="mt-4">{renderPlanungFormContent()}</div>
          )}

          <div className="mt-4">
            <div className="relative max-w-md">
              <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                type="search"
                placeholder="Suchen (Commission, Projekt, Kunde, Blech…)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="mt-2 flex-1 overflow-hidden rounded-xl border bg-card">
            <div className="max-h-[70vh] flex flex-col gap-8 overflow-auto p-4">
              {/* Tabelle 1: Ready für WS · Bearbeitung in WS */}
              <section className="flex flex-col gap-3 rounded-lg border-2 border-green-200 bg-green-50/50 p-4 shadow-sm dark:border-green-800 dark:bg-green-950/20">
                <h2 className="border-l-4 border-green-600 pl-3 text-lg font-semibold dark:border-green-500">
                  Ready für WS · Bearbeitung in WS
                </h2>
                <Table className="text-base">
                  <TableHeader className="bg-muted/60 sticky top-0 z-10 text-sm">
                    <TableRow>
                      <TableHead className="w-10">Aktion</TableHead>
                      <TableHead className="w-12 min-w-[48px]">Prio</TableHead>
                      <TableHead className="min-w-[170px]">
                        Deadline (Datum &amp; Zeit)
                      </TableHead>
                      <TableHead className="min-w-[130px]">
                        Commission / Projektleiter
                      </TableHead>
                      <TableHead className="min-w-[180px]">
                        Projekt / Kunde
                      </TableHead>
                      <TableHead className="min-w-[140px]">
                        Projektstatus
                      </TableHead>
                      <TableHead className="min-w-[100px]">Format</TableHead>
                      <TableHead className="min-w-[140px]">Transport</TableHead>
                      <TableHead className="min-w-[90px]">
                        Deadline bestätigt
                      </TableHead>
                      <TableHead className="min-w-[140px]">Blech</TableHead>
                      <TableHead className="min-w-[110px]">
                        Anz. / m²
                      </TableHead>
                      <TableHead className="min-w-[150px]">
                        Fertigung
                      </TableHead>
                      <TableHead className="min-w-[200px]">
                        Pläne Original
                      </TableHead>
                      <TableHead className="min-w-[200px]">
                        Pläne &quot;ready for work&quot;
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="min-w-[160px]">TB Zeit</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1">
                        <div className="flex flex-col gap-1">
                          <select
                            className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                            value={
                              filter.deadlineFilter === "datum"
                                ? "datum"
                                : filter.deadlineFilter
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              setFilter((f) => ({
                                ...f,
                                deadlineFilter: v,
                                ...(v !== "datum" && { deadlineDatum: "" }),
                              }));
                            }}
                          >
                            <option value="">alle</option>
                            <option value="alteste">Älteste zuerst</option>
                            <option value="neueste">Neueste zuerst</option>
                            <option value="heute">Heute</option>
                            <option value="morgen">Morgen</option>
                            <option value="woche">Diese Woche</option>
                            <option value="datum">Datum eingeben</option>
                          </select>
                          {filter.deadlineFilter === "datum" && (
                            <Input
                              type="date"
                              className="h-8 text-sm"
                              value={filter.deadlineDatum}
                              onChange={(e) =>
                                setFilter((f) => ({
                                  ...f,
                                  deadlineDatum: e.target.value,
                                }))
                              }
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Filtern…"
                          className="h-8 text-sm"
                          value={filter.commission}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              commission: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Projekt/Kunde…"
                          className="h-8 text-sm"
                          value={filter.projektKunde}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              projektKunde: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.projektstatus}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              projektstatus: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          <option value="offen">offen</option>
                          <option value="Bearbeitung in TB">Bearbeitung in TB</option>
                          <option value="Ready für WS">Ready für WS</option>
                          <option value="Bearbeitung in WS">Bearbeitung in WS</option>
                          <option value="Ready für Transport">Ready für Transport</option>
                          <option value="fertig">fertig</option>
                        </select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Filtern…"
                          className="h-8 text-sm"
                          value={filter.format}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              format: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.transport}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              transport: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          <option value="Kein Transport">Kein Transport</option>
                          <option value="Transport Zwingen-Birsfelden">
                            Transport Zwingen-Birsfelden
                          </option>
                          <option value="Transport Birsfelden-Zwingen">
                            Transport Birsfelden-Zwingen
                          </option>
                          <option value="Transport zu Kunde">
                            Transport zu Kunde
                          </option>
                        </select>
                      </TableCell>
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.deadlineBestaetigt}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              deadlineBestaetigt: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          <option value="ja">ja</option>
                          <option value="nein">nein</option>
                        </select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Filtern…"
                          className="h-8 text-sm"
                          value={filter.blech}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              blech: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1" />
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.fertigung}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              fertigung: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          {FERTIGUNG_OPTIONEN.map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tab1Auftraege.map((a) => renderPlanungRow(a))}
                    {tab1Auftraege.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={18} className="py-6 text-center">
                          <span className="text-sm text-muted-foreground">
                            Keine Aufträge in dieser Kategorie.
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </section>

              {/* Tabelle Transport: Ready für Transport · Transport geplant */}
              <section className="flex flex-col gap-3 rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4 shadow-sm dark:border-blue-800 dark:bg-blue-950/20">
                <h2 className="border-l-4 border-blue-600 pl-3 text-lg font-semibold dark:border-blue-500">
                  Transport
                </h2>
                <Table className="text-base">
                  <TableHeader className="bg-muted/60 sticky top-0 z-10 text-sm">
                    <TableRow>
                      <TableHead className="w-10">Aktion</TableHead>
                      <TableHead className="w-12 min-w-[48px]">Prio</TableHead>
                      <TableHead className="min-w-[170px]">
                        Deadline (Datum &amp; Zeit)
                      </TableHead>
                      <TableHead className="min-w-[130px]">
                        Commission / Projektleiter
                      </TableHead>
                      <TableHead className="min-w-[180px]">
                        Projekt / Kunde
                      </TableHead>
                      <TableHead className="min-w-[140px]">
                        Projektstatus
                      </TableHead>
                      <TableHead className="min-w-[100px]">Format</TableHead>
                      <TableHead className="min-w-[140px]">Transport</TableHead>
                      <TableHead className="min-w-[90px]">
                        Deadline bestätigt
                      </TableHead>
                      <TableHead className="min-w-[140px]">Blech</TableHead>
                      <TableHead className="min-w-[110px]">
                        Anz. / m²
                      </TableHead>
                      <TableHead className="min-w-[150px]">
                        Fertigung
                      </TableHead>
                      <TableHead className="min-w-[200px]">
                        Pläne Original
                      </TableHead>
                      <TableHead className="min-w-[200px]">
                        Pläne &quot;ready for work&quot;
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="min-w-[160px]">TB Zeit</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1">
                        <div className="flex flex-col gap-1">
                          <select
                            className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                            value={
                              filter.deadlineFilter === "datum"
                                ? "datum"
                                : filter.deadlineFilter
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              setFilter((f) => ({
                                ...f,
                                deadlineFilter: v,
                                ...(v !== "datum" && { deadlineDatum: "" }),
                              }));
                            }}
                          >
                            <option value="">alle</option>
                            <option value="alteste">Älteste zuerst</option>
                            <option value="neueste">Neueste zuerst</option>
                            <option value="heute">Heute</option>
                            <option value="morgen">Morgen</option>
                            <option value="woche">Diese Woche</option>
                            <option value="datum">Datum eingeben</option>
                          </select>
                          {filter.deadlineFilter === "datum" && (
                            <Input
                              type="date"
                              className="h-8 text-sm"
                              value={filter.deadlineDatum}
                              onChange={(e) =>
                                setFilter((f) => ({
                                  ...f,
                                  deadlineDatum: e.target.value,
                                }))
                              }
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Filtern…"
                          className="h-8 text-sm"
                          value={filter.commission}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              commission: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Projekt/Kunde…"
                          className="h-8 text-sm"
                          value={filter.projektKunde}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              projektKunde: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.projektstatus}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              projektstatus: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          <option value="offen">offen</option>
                          <option value="Bearbeitung in TB">Bearbeitung in TB</option>
                          <option value="Ready für WS">Ready für WS</option>
                          <option value="Bearbeitung in WS">Bearbeitung in WS</option>
                          <option value="Ready für Transport">Ready für Transport</option>
                          <option value="Transport geplant">Transport geplant</option>
                          <option value="fertig">fertig</option>
                        </select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Filtern…"
                          className="h-8 text-sm"
                          value={filter.format}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              format: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.transport}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              transport: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          <option value="Kein Transport">Kein Transport</option>
                          <option value="Transport Zwingen-Birsfelden">
                            Transport Zwingen-Birsfelden
                          </option>
                          <option value="Transport Birsfelden-Zwingen">
                            Transport Birsfelden-Zwingen
                          </option>
                          <option value="Transport zu Kunde">
                            Transport zu Kunde
                          </option>
                        </select>
                      </TableCell>
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.deadlineBestaetigt}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              deadlineBestaetigt: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          <option value="ja">ja</option>
                          <option value="nein">nein</option>
                        </select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Filtern…"
                          className="h-8 text-sm"
                          value={filter.blech}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              blech: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1" />
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.fertigung}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              fertigung: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          {FERTIGUNG_OPTIONEN.map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transportAuftraege.map((a) => renderPlanungRow(a))}
                    {transportAuftraege.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={18} className="py-6 text-center">
                          <span className="text-sm text-muted-foreground">
                            Keine Aufträge in dieser Kategorie.
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </section>

              {/* Tabelle 2: Offen · Bearbeitung in TB */}
              <section className="flex flex-col gap-3 rounded-lg border-2 border-amber-200 bg-amber-50/50 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/20">
                <h2 className="border-l-4 border-amber-600 pl-3 text-lg font-semibold dark:border-amber-500">
                  Offen · Bearbeitung in TB
                </h2>
                <Table className="text-base">
                  <TableHeader className="bg-muted/60 sticky top-0 z-10 text-sm">
                    <TableRow>
                      <TableHead className="w-10">Aktion</TableHead>
                      <TableHead className="w-12 min-w-[48px]">Prio</TableHead>
                      <TableHead className="min-w-[170px]">
                        Deadline (Datum &amp; Zeit)
                      </TableHead>
                      <TableHead className="min-w-[130px]">
                        Commission / Projektleiter
                      </TableHead>
                      <TableHead className="min-w-[180px]">
                        Projekt / Kunde
                      </TableHead>
                      <TableHead className="min-w-[140px]">
                        Projektstatus
                      </TableHead>
                      <TableHead className="min-w-[100px]">Format</TableHead>
                      <TableHead className="min-w-[140px]">Transport</TableHead>
                      <TableHead className="min-w-[90px]">
                        Deadline bestätigt
                      </TableHead>
                      <TableHead className="min-w-[140px]">Blech</TableHead>
                      <TableHead className="min-w-[110px]">
                        Anz. / m²
                      </TableHead>
                      <TableHead className="min-w-[150px]">
                        Fertigung
                      </TableHead>
                      <TableHead className="min-w-[200px]">
                        Pläne Original
                      </TableHead>
                      <TableHead className="min-w-[200px]">
                        Pläne &quot;ready for work&quot;
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="min-w-[160px]">TB Zeit</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1">
                        <div className="flex flex-col gap-1">
                          <select
                            className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                            value={
                              filter.deadlineFilter === "datum"
                                ? "datum"
                                : filter.deadlineFilter
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              setFilter((f) => ({
                                ...f,
                                deadlineFilter: v,
                                ...(v !== "datum" && { deadlineDatum: "" }),
                              }));
                            }}
                          >
                            <option value="">alle</option>
                            <option value="alteste">Älteste zuerst</option>
                            <option value="neueste">Neueste zuerst</option>
                            <option value="heute">Heute</option>
                            <option value="morgen">Morgen</option>
                            <option value="woche">Diese Woche</option>
                            <option value="datum">Datum eingeben</option>
                          </select>
                          {filter.deadlineFilter === "datum" && (
                            <Input
                              type="date"
                              className="h-8 text-sm"
                              value={filter.deadlineDatum}
                              onChange={(e) =>
                                setFilter((f) => ({
                                  ...f,
                                  deadlineDatum: e.target.value,
                                }))
                              }
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Filtern…"
                          className="h-8 text-sm"
                          value={filter.commission}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              commission: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Projekt/Kunde…"
                          className="h-8 text-sm"
                          value={filter.projektKunde}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              projektKunde: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.projektstatus}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              projektstatus: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          <option value="offen">offen</option>
                          <option value="Bearbeitung in TB">Bearbeitung in TB</option>
                          <option value="Ready für WS">Ready für WS</option>
                          <option value="Bearbeitung in WS">Bearbeitung in WS</option>
                          <option value="Ready für Transport">Ready für Transport</option>
                          <option value="Transport geplant">Transport geplant</option>
                          <option value="fertig">fertig</option>
                        </select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Filtern…"
                          className="h-8 text-sm"
                          value={filter.format}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              format: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.transport}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              transport: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          <option value="Kein Transport">Kein Transport</option>
                          <option value="Transport Zwingen-Birsfelden">
                            Transport Zwingen-Birsfelden
                          </option>
                          <option value="Transport Birsfelden-Zwingen">
                            Transport Birsfelden-Zwingen
                          </option>
                          <option value="Transport zu Kunde">
                            Transport zu Kunde
                          </option>
                        </select>
                      </TableCell>
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.deadlineBestaetigt}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              deadlineBestaetigt: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          <option value="ja">ja</option>
                          <option value="nein">nein</option>
                        </select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Filtern…"
                          className="h-8 text-sm"
                          value={filter.blech}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              blech: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1" />
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.fertigung}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              fertigung: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          {FERTIGUNG_OPTIONEN.map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tab2Auftraege.map((a) => renderPlanungRow(a))}
                    {tab2Auftraege.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={18} className="py-6 text-center">
                          <span className="text-sm text-muted-foreground">
                            Keine Aufträge in diesem Bereich.
                          </span>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </section>

              {/* Tabelle 3: Fertig */}
              <section className="flex flex-col gap-3 rounded-lg border-2 border-slate-200 bg-slate-50/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
                <h2 className="border-l-4 border-slate-600 pl-3 text-lg font-semibold dark:border-slate-400">
                  Fertig
                </h2>
                <Table className="text-base">
                  <TableHeader className="bg-muted/60 sticky top-0 z-10 text-sm">
                    <TableRow>
                      <TableHead className="w-10">Aktion</TableHead>
                      <TableHead className="min-w-[170px]">
                        Deadline (Datum &amp; Zeit)
                      </TableHead>
                      <TableHead className="min-w-[130px]">
                        Commission / Projektleiter
                      </TableHead>
                      <TableHead className="min-w-[180px]">
                        Projekt / Kunde
                      </TableHead>
                      <TableHead className="min-w-[140px]">
                        Projektstatus
                      </TableHead>
                      <TableHead className="min-w-[100px]">Format</TableHead>
                      <TableHead className="min-w-[140px]">Transport</TableHead>
                      <TableHead className="min-w-[90px]">
                        Deadline bestätigt
                      </TableHead>
                      <TableHead className="min-w-[140px]">Blech</TableHead>
                      <TableHead className="min-w-[110px]">
                        Anz. / m²
                      </TableHead>
                      <TableHead className="min-w-[150px]">
                        Fertigung
                      </TableHead>
                      <TableHead className="min-w-[200px]">
                        Pläne Original
                      </TableHead>
                      <TableHead className="min-w-[200px]">
                        Pläne &quot;ready for work&quot;
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="min-w-[160px]">TB Zeit</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                    <TableRow className="bg-muted/30">
                      <TableCell className="p-1" />
                      <TableCell className="p-1">
                        <div className="flex flex-col gap-1">
                          <select
                            className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                            value={
                              filter.deadlineFilter === "datum"
                                ? "datum"
                                : filter.deadlineFilter
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              setFilter((f) => ({
                                ...f,
                                deadlineFilter: v,
                                ...(v !== "datum" && { deadlineDatum: "" }),
                              }));
                            }}
                          >
                            <option value="">alle</option>
                            <option value="alteste">Älteste zuerst</option>
                            <option value="neueste">Neueste zuerst</option>
                            <option value="heute">Heute</option>
                            <option value="morgen">Morgen</option>
                            <option value="woche">Diese Woche</option>
                            <option value="datum">Datum eingeben</option>
                          </select>
                          {filter.deadlineFilter === "datum" && (
                            <Input
                              type="date"
                              className="h-8 text-sm"
                              value={filter.deadlineDatum}
                              onChange={(e) =>
                                setFilter((f) => ({
                                  ...f,
                                  deadlineDatum: e.target.value,
                                }))
                              }
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Filtern…"
                          className="h-8 text-sm"
                          value={filter.commission}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              commission: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Projekt/Kunde…"
                          className="h-8 text-sm"
                          value={filter.projektKunde}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              projektKunde: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.projektstatus}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              projektstatus: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          <option value="offen">offen</option>
                          <option value="Bearbeitung in TB">Bearbeitung in TB</option>
                          <option value="Ready für WS">Ready für WS</option>
                          <option value="Bearbeitung in WS">Bearbeitung in WS</option>
                          <option value="Ready für Transport">Ready für Transport</option>
                          <option value="Transport geplant">Transport geplant</option>
                          <option value="fertig">fertig</option>
                        </select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Filtern…"
                          className="h-8 text-sm"
                          value={filter.format}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              format: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.transport}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              transport: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          <option value="Kein Transport">Kein Transport</option>
                          <option value="Transport Zwingen-Birsfelden">
                            Transport Zwingen-Birsfelden
                          </option>
                          <option value="Transport Birsfelden-Zwingen">
                            Transport Birsfelden-Zwingen
                          </option>
                          <option value="Transport zu Kunde">
                            Transport zu Kunde
                          </option>
                        </select>
                      </TableCell>
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.deadlineBestaetigt}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              deadlineBestaetigt: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          <option value="ja">ja</option>
                          <option value="nein">nein</option>
                        </select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          placeholder="Filtern…"
                          className="h-8 text-sm"
                          value={filter.blech}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              blech: e.target.value,
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell className="p-1" />
                      <TableCell className="p-1">
                        <select
                          className="border-input bg-background h-8 w-full rounded border px-2 text-sm"
                          value={filter.fertigung}
                          onChange={(e) =>
                            setFilter((f) => ({
                              ...f,
                              fertigung: e.target.value,
                            }))
                          }
                        >
                          <option value="">alle</option>
                          {FERTIGUNG_OPTIONEN.map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                      <TableCell className="p-1" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tab3Auftraege.map((a) => renderPlanungRow(a, { hidePrio: true }))}
                    {tab3Auftraege.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={17} className="py-6 text-center">
                          <span className="text-sm text-muted-foreground">
                            Noch keine fertigen Aufträge.
                          </span>
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

