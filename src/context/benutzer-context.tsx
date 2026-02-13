"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import type { Benutzer } from "@/lib/benutzer-types";

type BenutzerContextValue = {
  benutzer: Benutzer[];
  setBenutzer: React.Dispatch<React.SetStateAction<Benutzer[]>>;
  addBenutzer: (b: Omit<Benutzer, "id">) => void;
  updateBenutzer: (id: number, partial: Partial<Benutzer>) => void;
  removeBenutzer: (id: number) => void;
};

const BenutzerContext = createContext<BenutzerContextValue | null>(null);

const initialBenutzer: Benutzer[] = [
  {
    id: 1,
    vorname: "Max",
    nachname: "Muster",
    email: "max.muster@example.ch",
    rolle: "Admin",
  },
  {
    id: 2,
    vorname: "Anna",
    nachname: "Beispiel",
    email: "anna.beispiel@example.ch",
    rolle: "Projektleiter",
  },
];

export function BenutzerProvider({ children }: { children: ReactNode }) {
  const [benutzer, setBenutzer] = useState<Benutzer[]>(initialBenutzer);

  const addBenutzer = useCallback((b: Omit<Benutzer, "id">) => {
    setBenutzer((prev) => {
      const nextId =
        prev.length === 0 ? 1 : Math.max(...prev.map((x) => x.id)) + 1;
      return [...prev, { ...b, id: nextId }];
    });
  }, []);

  const updateBenutzer = useCallback((id: number, partial: Partial<Benutzer>) => {
    setBenutzer((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...partial } : b))
    );
  }, []);

  const removeBenutzer = useCallback((id: number) => {
    setBenutzer((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return (
    <BenutzerContext.Provider
      value={{
        benutzer,
        setBenutzer,
        addBenutzer,
        updateBenutzer,
        removeBenutzer,
      }}
    >
      {children}
    </BenutzerContext.Provider>
  );
}

export function useBenutzer() {
  const ctx = useContext(BenutzerContext);
  if (!ctx) throw new Error("useBenutzer must be used within BenutzerProvider");
  return ctx;
}
