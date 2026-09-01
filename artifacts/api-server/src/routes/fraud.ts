import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  AnalyzeTransactionBody,
  AnalyzeTransactionResponse,
  GetBenchmarksResponse,
  GetModelConfigResponse,
  GetOverviewResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const benchmarkTable = [
  {
    model: "QSVM",
    roc_auc: 0.984,
    precision: 0.91,
    recall: 0.88,
    f1: 0.895,
    status: "available" as const,
    note: "Primary model on the shared evaluation split",
  },
  {
    model: "XGBoost",
    roc_auc: 0.986,
    precision: 0.92,
    recall: 0.87,
    f1: 0.894,
    status: "available" as const,
    note: "Classical baseline",
  },
  {
    model: "Random Forest",
    roc_auc: 0.981,
    precision: 0.9,
    recall: 0.85,
    f1: 0.874,
    status: "available" as const,
    note: "Classical baseline",
  },
  {
    model: "Logistic Regression",
    roc_auc: 0.972,
    precision: 0.84,
    recall: 0.81,
    f1: 0.825,
    status: "available" as const,
    note: "Classical baseline",
  },
  {
    model: "RBF-SVM",
    roc_auc: null,
    precision: null,
    recall: null,
    f1: null,
    status: "unavailable" as const,
    note: "Not returned by the benchmark job",
  },
];

const featureSchema = [
  {
    key: "amount",
    label: "Transaction amount",
    type: "number" as const,
    unit: "KES",
    required: true,
    min: 0,
    max: 500000,
    placeholder: "e.g. 18500",
    description: "Synthetic amount in Kenyan shillings",
  },
  {
    key: "oldbalanceOrg",
    label: "Origin balance before",
    type: "number" as const,
    unit: "KES",
    required: true,
    min: 0,
    max: 5000000,
    placeholder: "e.g. 22000",
    description: "Balance before the transaction",
  },
  {
    key: "newbalanceOrig",
    label: "Origin balance after",
    type: "number" as const,
    unit: "KES",
    required: true,
    min: 0,
    max: 5000000,
    placeholder: "e.g. 3500",
    description: "Balance after the transaction",
  },
  {
    key: "oldbalanceDest",
    label: "Destination balance before",
    type: "number" as const,
    unit: "KES",
    required: true,
    min: 0,
    max: 5000000,
    placeholder: "e.g. 1400",
    description: "Destination balance before the transaction",
  },
  {
    key: "newbalanceDest",
    label: "Destination balance after",
    type: "number" as const,
    unit: "KES",
    required: true,
    min: 0,
    max: 5000000,
    placeholder: "e.g. 19900",
    description: "Destination balance after the transaction",
  },
  {
    key: "transactionType",
    label: "Transaction type",
    type: "select" as const,
    unit: null,
    required: true,
    min: null,
    max: null,
    placeholder: null,
    description: "Synthetic transaction category",
    options: [
      { label: "Cash out", value: "CASH_OUT" },
      { label: "Transfer", value: "TRANSFER" },
      { label: "Payment", value: "PAYMENT" },
      { label: "Cash in", value: "CASH_IN" },
    ],
  },
];

const modelConfig = {
  primary_model: "QSVM · RBF kernel",
  supported_models: ["QSVM", "Logistic Regression", "Random Forest", "XGBoost", "RBF-SVM"],
  feature_schema: featureSchema,
  threshold_config: {
    review_recommended: 0.45,
    high_risk_signal: 0.75,
    note: "Thresholds are demo guidance, not enforcement policy",
  },
  metadata: {
    dataset: "PaySim-derived synthetic transactions",
    schema_version: "fraud-busters-4-8-feature-v1",
    quantum_backend: "Simulator rehearsal",
  },
};

router.get("/v1/model-config", (_req, res): void => {
  res.json(GetModelConfigResponse.parse(modelConfig));
});

router.get("/v1/benchmarks", (_req, res): void => {
  res.json(
    GetBenchmarksResponse.parse({
      benchmark_table: benchmarkTable,
      metadata: {
        evaluation_split: "held-out synthetic test split",
        metric_note: "Metrics are illustrative rehearsal values",
        last_run: "2026-08-31T14:20:00.000Z",
      },
      execution_mode: "mock",
      timestamp: "2026-08-31T14:20:00.000Z",
    }),
  );
});

router.post("/v1/analyze", (req, res): void => {
  const parsed = AnalyzeTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ issues: parsed.error.issues }, "Invalid analysis input");
    res.status(400).json({ error: "The submitted transaction does not match the active feature schema." });
    return;
  }

  const transaction = parsed.data.transaction;
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
  const riskBand = score >= 0.75 ? "high-risk signal" : score >= 0.45 ? "review recommended" : "lower-risk signal";
  const signalContext = [
    depletion > 0.7 ? "Origin balance is substantially depleted" : "Origin balance movement is within expected range",
    amount > 25000 ? "Amount is elevated for this rehearsal scenario" : "Amount is within the rehearsal baseline",
    type === "TRANSFER" || type === "CASH_OUT" ? "Transaction type is commonly reviewed" : "Transaction type is not a primary review driver",
  ];

  const response = {
    fraud_score: Number(score.toFixed(3)),
    model_used: "QSVM · RBF kernel",
    execution_mode: "mock" as const,
    risk_band: riskBand,
    transaction,
    benchmark_table: benchmarkTable,
    metadata: {
      feature_count: Object.keys(transaction).length,
      quantum_backend: "Simulator rehearsal",
      schema_version: "fraud-busters-4-8-feature-v1",
    },
    signal_context: signalContext,
    request_id: `demo_${randomUUID().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
  };

  req.log.info({ executionMode: response.execution_mode, model: response.model_used }, "Transaction scored");
  res.json(AnalyzeTransactionResponse.parse(response));
});

router.get("/v1/overview", (_req, res): void => {
  res.json(
    GetOverviewResponse.parse({
      system_status: "simulator",
      execution_mode: "mock",
      primary_model: "QSVM · RBF kernel",
      last_benchmark: "2026-08-31T14:20:00.000Z",
      metadata: {
        service_label: "Fraud Busters Command Center",
        environment: "synthetic rehearsal",
        supported_models: 5,
      },
    }),
  );
});

export default router;