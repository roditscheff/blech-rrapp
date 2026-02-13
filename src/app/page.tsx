import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 font-sans">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            MES Blechbearbeitung
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Wähle den passenden Bereich: Planung/Upload für Projektleiter und
            Technische Zeichner oder Werkstattansicht mit großen Start/Stopp-
            Buttons.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Planung &amp; Upload</CardTitle>
              <CardDescription>
                Auftragsliste für Projektleiter und Technische Zeichner mit
                Upload der Pläne und Priorisierung.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Bearbeite Stammdaten, Status, Prio und lade Dateien für &quot;
                ready for work&quot; hoch.
              </p>
              <Button asChild size="lg" className="h-14 text-base">
                <Link href="/planung">Zur Planungsansicht</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle>Werkstatt</CardTitle>
              <CardDescription>
                Tablet-optimierte Liste aller in Bearbeitung befindlichen
                Aufträge mit Start/Stopp-Buttons für jeden Arbeitsschritt.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Große Klickflächen für Scheren, Lasern, Kanten, Schweissen,
                Behandeln und Ecken gefeilt.
              </p>
              <Button asChild size="lg" className="h-14 text-base">
                <Link href="/werkstatt">Zur Werkstattansicht</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle>Auswertung</CardTitle>
              <CardDescription>
                Alle fertigen Projekte mit Stammdaten und erfassten Arbeitszeiten
                pro Arbeitsschritt (TB, Scheren, Lasern, Kanten, etc.).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Übersicht aller abgeschlossenen Aufträge in einer Zeile pro
                Projekt inkl. benötigter Zeit pro Arbeitsschritt.
              </p>
              <Button asChild size="lg" className="h-14 text-base">
                <Link href="/auswertung">Zur Auswertung</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <CardTitle>Benutzerverwaltung</CardTitle>
              <CardDescription>
                Benutzer registrieren, Rollen zuweisen und Password-Reset-Mails
                versenden.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Vorname, Nachname, E-Mail, Rolle (Admin, Projektleiter, TB,
                Werkstatt). Erstellen, Bearbeiten, Mail senden.
              </p>
              <Button asChild size="lg" className="h-14 text-base">
                <Link href="/benutzer">Zur Benutzerverwaltung</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
