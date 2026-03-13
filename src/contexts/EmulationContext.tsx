import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface EmulationContextType {
  emulatedEmail: string | null;
  startEmulation: (email: string) => void;
  stopEmulation: () => void;
}

const EmulationContext = createContext<EmulationContextType | undefined>(undefined);

export function EmulationProvider({ children }: { children: ReactNode }) {
  const [emulatedEmail, setEmulatedEmail] = useState<string | null>(null);

  const startEmulation = useCallback((email: string) => {
    setEmulatedEmail(email.toLowerCase());
  }, []);

  const stopEmulation = useCallback(() => {
    setEmulatedEmail(null);
  }, []);

  return (
    <EmulationContext.Provider value={{ emulatedEmail, startEmulation, stopEmulation }}>
      {children}
    </EmulationContext.Provider>
  );
}

export function useEmulation() {
  const context = useContext(EmulationContext);
  if (context === undefined) {
    throw new Error("useEmulation must be used within an EmulationProvider");
  }
  return context;
}
