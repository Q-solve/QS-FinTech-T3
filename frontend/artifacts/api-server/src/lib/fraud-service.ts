import { type Transaction, type FeatureField, type BenchmarkEntry } from "./types";

export interface FraudScoreResult {
  fraud_score: number;
  model_used: string;
  execution_mode: "mock";
  risk_band: "high-risk signal" | "review recommended" | "lower-risk signal";
  transaction: Transaction;
  benchmark_table: BenchmarkEntry[];
  metadata: {
    feature_count: number;
    dataset: string;
    evaluation_split: string;
    qubit_count: number;
    feature_map: string;
    shots: number;
    quantum_backend: string;
    schema_version: string;
  };
  signal_context: string[];
  request_id: string;
  timestamp: string;
}

export function calculateFraudScore(
  transaction: Transaction,
  featureSchema: FeatureField[],
  benchmarkTable: BenchmarkEntry[],
): FraudScoreResult {
  const amount = typeof transaction.amount === "number" ? transaction.amount : 0;
  const originBefore =
    typeof transaction.oldbalanceOrg === "number" ? transaction.oldbalanceOrg : 0;
  const originAfter =
    typeof transaction.newbalanceOrig === "number" ? transaction.newbalanceOrig : 0;
  const type = transaction.transactionType;

  const depletion = originBefore > 0 ? Math.max(0, (originBefore - originAfter) / originBefore) : 0;
  const transferLift = type === "TRANSFER" || type === "CASH_OUT" ? 0.18 : 0;
  const amountLift = Math.min(0.26, amount / 100000);
  const score = Math.min(0.98, Math.max(0.04, 0.12 + depletion * 0.48 + transferLift + amountLift));

  const riskBand =
    score >= 0.75
      ? "high-risk signal"
      : score >= 0.45
        ? "review recommended"
        : "lower-risk signal";

  const signalContext = [
    depletion > 0.7
      ? "Origin balance is substantially depleted"
      : "Origin balance movement is within expected range",
    amount > 25000
      ? "Amount is elevated for this rehearsal scenario"
      : "Amount is within the rehearsal baseline",
    type === "TRANSFER" || type === "CASH_OUT"
      ? "Transaction type is commonly reviewed"
      : "Transaction type is not a primary review driver",
  ];

  return {
    fraud_score: Number(score.toFixed(3)),
    model_used: "QSVM · RBF kernel",
    execution_mode: "mock",
    risk_band: riskBand,
    transaction,
    benchmark_table: benchmarkTable,
    metadata: {
      feature_count: Object.keys(transaction).length,
      dataset: "PaySim-derived synthetic transactions",
      evaluation_split: "held-out synthetic test split",
      qubit_count: 6,
      feature_map: "shallow ZZ feature map",
      shots: 1024,
      quantum_backend: "Simulator rehearsal",
      schema_version: "fraud-busters-4-8-feature-v1",
    },
    signal_context: signalContext,
    request_id: `demo_${crypto.randomUUID().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
  };
}

export function validateTransaction(
  transaction: Record<string, unknown>,
  featureSchema: FeatureField[],
): { valid: boolean; errors: string[] } {
  const expectedKeys = new Set(featureSchema.map((field) => field.key));
  const submittedKeys = Object.keys(transaction);
  const unsupportedKeys = submittedKeys.filter((key) => !expectedKeys.has(key));
  const missingKeys = featureSchema
    .filter((field) => field.required && (transaction[field.key] == null || transaction[field.key] === ""))
    .map((field) => field.key);
  const invalidFields = featureSchema
    .filter((field) => {
      const value = transaction[field.key];
      if (value == null || value === "") return false;
      if (field.type === "number") {
        return (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          (field.min != null && value < field.min) ||
          (field.max != null && value > field.max)
        );
      }
      if (field.type === "select") {
        return typeof value !== "string" || !field.options?.some((option: { value: string }) => option.value === value);
      }
      return typeof value !== "string";
    })
    .map((field) => field.key);

  const errors: string[] = [];
  if (unsupportedKeys.length) errors.push(`Unsupported keys: ${unsupportedKeys.join(", ")}`);
  if (missingKeys.length) errors.push(`Missing required keys: ${missingKeys.join(", ")}`);
  if (invalidFields.length) errors.push(`Invalid fields: ${invalidFields.join(", ")}`);

  return { valid: errors.length === 0, errors };
}