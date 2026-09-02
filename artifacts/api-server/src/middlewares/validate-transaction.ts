import { type Request, type Response, type NextFunction } from "express";
import { type FeatureField } from "./types";

export interface ValidationError {
  field: string;
  message: string;
}

export function validateTransactionMiddleware(
  featureSchema: FeatureField[],
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const transaction = req.body?.transaction;
    if (!transaction || typeof transaction !== "object") {
      res.status(400).json({
        error: "Request body must contain a transaction object.",
        code: "INVALID_REQUEST",
      });
      return;
    }

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
          return typeof value !== "string" || !field.options?.some((option) => option.value === value);
        }
        return typeof value !== "string";
      })
      .map((field) => field.key);

    if (unsupportedKeys.length || missingKeys.length || invalidFields.length) {
      req.log.warn(
        { unsupportedKeys, missingKeys, invalidFields },
        "Analysis feature validation failed",
      );
      res.status(400).json({
        error: "The submitted transaction does not match the active feature schema.",
        code: "INVALID_FEATURE_SCHEMA",
      });
      return;
    }

    next();
  };
}