import { Router, type IRouter } from "express";
import { benchmarkTable, featureSchema, modelConfig } from "../lib/config";
import { validateTransactionMiddleware } from "../middlewares/validate-transaction";
import { calculateFraudScore, validateTransaction } from "../lib/fraud-service";
import {
  AnalyzeTransactionBody,
  AnalyzeTransactionResponse,
  GetBenchmarksResponse,
  GetModelConfigResponse,
  GetOverviewResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/model-config", (_req, res): void => {
  res.json(GetModelConfigResponse.parse(modelConfig));
});

router.get("/v1/benchmarks", (_req, res): void => {
  res.json(
    GetBenchmarksResponse.parse({
      benchmark_table: benchmarkTable,
      metadata: {
        evaluation_split: "held-out synthetic test split",
        dataset: "PaySim-derived synthetic transactions",
        feature_count: 6,
        qubit_count: 6,
        feature_map: "shallow ZZ feature map",
        shots: 1024,
        metric_note: "Illustrative rehearsal values on a shared split",
        execution_backend: "Simulator rehearsal",
        last_run: "2026-08-31T14:20:00.000Z",
      },
      execution_mode: "mock",
      timestamp: "2026-08-31T14:20:00.000Z",
    }),
  );
});

router.post(
  "/v1/analyze",
  validateTransactionMiddleware(featureSchema),
  (req, res): void => {
    const parsed = AnalyzeTransactionBody.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn({ issues: parsed.error.issues }, "Invalid analysis input");
      res.status(400).json({
        error: "The submitted transaction does not match the active feature schema.",
      });
      return;
    }

    const { transaction } = parsed.data;
    const { valid, errors } = validateTransaction(transaction, featureSchema);
    if (!valid) {
      req.log.warn({ errors }, "Analysis feature validation failed");
      res.status(400).json({
        error: "The submitted transaction does not match the active feature schema.",
        code: "INVALID_FEATURE_SCHEMA",
      });
      return;
    }

    const result = calculateFraudScore(transaction, featureSchema, benchmarkTable);
    req.log.info(
      { executionMode: result.execution_mode, model: result.model_used },
      "Transaction scored",
    );
    res.json(AnalyzeTransactionResponse.parse(result));
  },
);

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