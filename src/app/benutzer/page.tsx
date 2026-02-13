"use client";

import Link from "next/link";
import { useState } from "react";

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

import { useBenutzer } from "@/context/benutzer-context";
import {
  BENUTZER_ROLLEN,
  type Benutzer,
  type BenutzerRolle,
} from "@/lib/benutzer-types";

import { Badge } from "@/components/ui/badge";
import { Home, Mail, Pencil, Trash2, UserPlus } from "lucide-react";

export default function BenutzerPage() {
  const { benutzer, addBenutzer, updateBenutzer, removeBenutzer } =
    useBenutzer();
  const [formMode, setFormMode] = useState<"none" | "create" | "edit">("none");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    vorname: "",
    nachname: "",
    email: "",
    rolle: "Werkstatt" as BenutzerRolle,
  });
  const [mailSentMessage, setMailSentMessage] = useState<number | null>(null);

  const handleOpenCreate = () => {
    setForm({
      vorname: "",
      nachname: "",
      email: "",
      rolle: "Werkstatt",
    });
    setEditingId(null);
    setFormMode("create");
  };

  const handleOpenEdit = (b: Benutzer) => {
    setForm({
      vorname: b.vorname,
      nachname: b.nachname,
      email: b.email,
      rolle: b.rolle,
    });
    setEditingId(b.id);
    setFormMode("edit");
  };

  const handleCancel = () => {
    setFormMode("none");
    setEditingId(null);
  };

  const handleSave = () => {
    if (formMode === "create") {
      addBenutzer(form);
      setFormMode("none");
      // Mail wird nach Erfassung versendet (Demo: simuliert)
      setMailSentMessage(-1);
      setTimeout(() => setMailSentMessage(null), 5000);
    } else if (formMode === "edit" && editingId != null) {
      updateBenutzer(editingId, form);
      setFormMode("none");
      setEditingId(null);
    }
  };

  const handleSendPasswordResetMail = (id: number) => {
    setMailSentMessage(id);
    setTimeout(() => setMailSentMessage(null), 5000);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-2 pb-3">
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
          <Link href="/werkstatt">Werkstatt</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/auswertung">Auswertung</Link>
        </Button>
      </div>

      <Card className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-4">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl sm:text-3xl">
              Benutzerverwaltung
            </CardTitle>
            <CardDescription>
              Benutzer anlegen, bearbeiten und Password-Reset-Mails versenden.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              Demo – ohne Backend
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={handleOpenCreate}
            >
            <UserPlus className="h-4 w-4" />
              Neuer Benutzer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          {mailSentMessage !== null && (
            <div
              className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                mailSentMessage === -1
                  ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200"
                  : "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200"
              }`}
            >
              {mailSentMessage === -1
                ? "Benutzer erstellt. Password-Reset-Mail wurde versendet (Demo: ohne Backend)."
                : "Password-Reset-Mail wurde versendet (Demo: ohne Backend)."}
            </div>
          )}

          {(formMode === "create" || formMode === "edit") && (
            <div className="mb-6 space-y-4 rounded-xl border bg-muted/40 p-4">
              <h2 className="text-lg font-semibold">
                {formMode === "create" ? "Neuer Benutzer" : "Benutzer bearbeiten"}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1 text-sm">
                  <div className="font-medium">Vorname</div>
                  <Input
                    value={form.vorname}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, vorname: e.target.value }))
                    }
                    placeholder="Vorname"
                  />
                </div>
                <div className="space-y-1 text-sm">
                  <div className="font-medium">Nachname</div>
                  <Input
                    value={form.nachname}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, nachname: e.target.value }))
                    }
                    placeholder="Nachname"
                  />
                </div>
                <div className="space-y-1 text-sm">
                  <div className="font-medium">E-Mail-Adresse</div>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="email@beispiel.ch"
                  />
                </div>
                <div className="space-y-1 text-sm">
                  <div className="font-medium">Rolle</div>
                  <select
                    className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                    value={form.rolle}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        rolle: e.target.value as BenutzerRolle,
                      }))
                    }
                  >
                    {BENUTZER_ROLLEN.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancel}>
                  Abbrechen
                </Button>
                <Button onClick={handleSave}>Speichern</Button>
              </div>
            </div>
          )}

          <div className="overflow-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vorname</TableHead>
                  <TableHead>Nachname</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead className="w-[180px]">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {benutzer.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.vorname}</TableCell>
                    <TableCell>{b.nachname}</TableCell>
                    <TableCell>{b.email}</TableCell>
                    <TableCell>{b.rolle}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => handleOpenEdit(b)}
                          aria-label="Bearbeiten"
                        >
                          <Pencil className="h-4 w-4" />
                          Bearbeiten
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1"
                          onClick={() => handleSendPasswordResetMail(b.id)}
                          aria-label="Password-Reset-Mail senden"
                          title="Password-Reset-Mail senden"
                        >
                          <Mail className="h-4 w-4" />
                          Mail
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive"
                          onClick={() => removeBenutzer(b.id)}
                          aria-label="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {benutzer.length === 0 && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Noch keine Benutzer. Klicken Sie auf &quot;Neuer Benutzer&quot;.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
