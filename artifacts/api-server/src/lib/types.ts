export interface Transaction {
  amount?: number;
  oldbalanceOrg?: number;
  newbalanceOrig?: number;
  oldbalanceDest?: number;
  newbalanceDest?: number;
  transactionType?: string;
  [key: string]: unknown;
}

export interface FeatureField {
  key: string;
  label: string;
  type: "number" | "select";
  unit: string | null;
  required: boolean;
  min: number | null;
  max: number | null;
  placeholder: string | null;
  description: string;
  options?: { label: string; value: string }[];
}

export interface BenchmarkEntry {
  model: string;
  roc_auc: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  status: "available" | "unavailable";
  note: string;
}

export interface ThresholdConfig {
  review_recommended: number;
  high_risk_signal: number;
  note: string;
}

export interface ModelMetadata {
  dataset: string;
  schema_version: string;
  quantum_backend: string;
}

export interface ModelConfig {
  primary_model: string;
  supported_models: string[];
  feature_schema: FeatureField[];
  threshold_config: ThresholdConfig;
  metadata: ModelMetadata;
}