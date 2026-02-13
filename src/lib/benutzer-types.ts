export type BenutzerRolle =
  | "Admin"
  | "Projektleiter"
  | "Technisches Büro"
  | "Werkstatt";

export type Benutzer = {
  id: number;
  vorname: string;
  nachname: string;
  email: string;
  rolle: BenutzerRolle;
};

export const BENUTZER_ROLLEN: { value: BenutzerRolle; label: string }[] = [
  { value: "Admin", label: "Admin" },
  { value: "Projektleiter", label: "Projektleiter" },
  { value: "Technisches Büro", label: "Technisches Büro" },
  { value: "Werkstatt", label: "Werkstatt" },
];
