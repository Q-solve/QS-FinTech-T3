import type { AnalyzeResponse, BenchmarkRow, FeatureDefinition } from "@workspace/api-client-react";
import type { ScenarioId } from "./demo-context";

export const MOCK_BENCHMARKS: BenchmarkRow[] = [
  { model: "QSVM", roc_auc: 0.984, precision: 0.91, recall: 0.88, f1: 0.895, status: "available", note: "Primary model · shared split" },
  { model: "Logistic Regression", roc_auc: 0.972, precision: 0.84, recall: 0.81, f1: 0.825, status: "available", note: "Classical baseline" },
  { model: "Random Forest", roc_auc: 0.981, precision: 0.9, recall: 0.85, f1: 0.874, status: "available", note: "Classical baseline" },
  { model: "XGBoost", roc_auc: 0.986, precision: 0.92, recall: 0.87, f1: 0.894, status: "available", note: "Classical baseline" },
  { model: "RBF-SVM", roc_auc: null, precision: null, recall: null, f1: null, status: "unavailable", note: "Not returned by benchmark job" },
];

export const SCENARIOS: Array<{
  id: ScenarioId;
  title: string;
  description: string;
  badge: string;
  values: Record<string, string>;
}> = [
  {
    id: "routine",
    title: "Routine payment",
    description: "A low-variance synthetic payment that demonstrates the lower-risk path.",
    badge: "Lower-risk signal",
    values: { amount: "850", oldbalanceOrg: "12000", newbalanceOrig: "11150", oldbalanceDest: "24000", newbalanceDest: "24850", transactionType: "PAYMENT" },
  },
  {
    id: "velocity",
    title: "Velocity spike",
    description: "An elevated transfer with substantial origin-balance movement for review.",
    badge: "Review recommended",
    values: { amount: "28500", oldbalanceOrg: "31000", newbalanceOrig: "2500", oldbalanceDest: "1800", newbalanceDest: "30300", transactionType: "TRANSFER" },
  },
  {
    id: "edge",
    title: "Edge-case cash out",
    description: "A boundary scenario for explaining why model context is not a verdict.",
    badge: "Inspect context",
    values: { amount: "120000", oldbalanceOrg: "120000", newbalanceOrig: "0", oldbalanceDest: "0", newbalanceDest: "120000", transactionType: "CASH_OUT" },
  },
];

export function scenarioValues(id: ScenarioId | null, schema: FeatureDefinition[]) {
  const source = SCENARIOS.find((scenario) => scenario.id === id)?.values ?? {};
  return Object.fromEntries(schema.map((field) => [field.key, source[field.key] ?? ""])) as Record<string, string>;
}

export function mockAnalyze(values: Record<string, string>, schema: FeatureDefinition[], mode: "mock" | "cached" = "mock"): AnalyzeResponse {
  const amount = Number(values.amount || 0);
  const before = Number(values.oldbalanceOrg || 0);
  const after = Number(values.newbalanceOrig || 0);
  const depletion = before > 0 ? Math.max(0, (before - after) / before) : 0;
  const score = Math.min(0.98, Math.max(0.04, 0.12 + depletion * 0.48 + (values.transactionType === "TRANSFER" || values.transactionType === "CASH_OUT" ? 0.18 : 0) + Math.min(0.26, amount / 100000)));
  return {
    fraud_score: Number(score.toFixed(3)),
    model_used: "QSVM · RBF kernel",
    execution_mode: mode,
    risk_band: score >= 0.75 ? "high-risk signal" : score >= 0.45 ? "review recommended" : "lower-risk signal",
    transaction: Object.fromEntries(schema.map((field) => [field.key, field.type === "number" ? Number(values[field.key]) : values[field.key]])),
    benchmark_table: MOCK_BENCHMARKS,
    metadata: {
      dataset: "Prepared synthetic rehearsal snapshot",
      feature_count: schema.length,
      evaluation_split: "demo snapshot",
      qubit_count: schema.length,
      feature_map: "shallow ZZ feature map",
      shots: 1024,
      quantum_backend: "Prepared local fixture",
    },
    signal_context: [
      depletion > 0.7 ? "Origin balance is substantially depleted" : "Origin balance movement is within the rehearsal baseline",
      amount > 25000 ? "Amount is elevated for this rehearsal scenario" : "Amount is within the rehearsal baseline",
      values.transactionType === "TRANSFER" || values.transactionType === "CASH_OUT" ? "Transaction type is commonly reviewed" : "Transaction type is not a primary review driver",
    ],
    request_id: `mock_${mode}_snapshot`,
    timestamp: new Date().toISOString(),
  };
}