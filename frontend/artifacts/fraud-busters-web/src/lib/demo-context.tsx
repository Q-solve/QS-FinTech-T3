import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AnalyzeResponse } from "@workspace/api-client-react";

export type DemoMode = "live" | "mock" | "cached";
export type ScenarioId = "routine" | "velocity" | "edge";

type DemoContextValue = {
  mode: DemoMode;
  setMode: (mode: DemoMode) => void;
  scenario: ScenarioId | null;
  setScenario: (scenario: ScenarioId | null) => void;
  latestAnalysis?: AnalyzeResponse;
  lastValues: Record<string, string>;
  setLatestAnalysis: (result: AnalyzeResponse, values: Record<string, string>) => void;
  clearLatestAnalysis: () => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DemoMode>("live");
  const [scenario, setScenario] = useState<ScenarioId | null>(null);
  const [latestAnalysis, setLatestAnalysisState] = useState<AnalyzeResponse>();
  const [lastValues, setLastValues] = useState<Record<string, string>>({});

  const value = useMemo<DemoContextValue>(() => ({
    mode,
    setMode,
    scenario,
    setScenario,
    latestAnalysis,
    lastValues,
    setLatestAnalysis: (result, values) => {
      setLatestAnalysisState(result);
      setLastValues(values);
    },
    clearLatestAnalysis: () => {
      setLatestAnalysisState(undefined);
      setLastValues({});
    },
  }), [mode, scenario, latestAnalysis, lastValues]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemoContext() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemoContext must be used within DemoProvider");
  return context;
}