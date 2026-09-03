import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import {
  Activity, ArrowRight, BarChart3, Check, CircleAlert, CircleHelp, Cpu, FlaskConical,
  Gauge, Hexagon, Home as HomeIcon, Info, Menu, Play, RotateCcw, ShieldCheck,
  SlidersHorizontal, Sparkles, TimerReset, Waypoints, X,
} from "lucide-react";
import {
  getGetBenchmarksQueryKey, getGetModelConfigQueryKey, getGetOverviewQueryKey,
  useAnalyzeTransaction, useGetBenchmarks, useGetModelConfig, useGetOverview, useHealthCheck,
} from "@workspace/api-client-react";
import type { AnalyzeResponse, BenchmarkRow, FeatureDefinition } from "@workspace/api-client-react";
import { Button } from "@workspace/fraud-busters-command-center/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/fraud-busters-command-center/components/ui/card";
import { Badge } from "@workspace/fraud-busters-command-center/components/ui/badge";
import { Input } from "@workspace/fraud-busters-command-center/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/fraud-busters-command-center/components/ui/select";
import { Skeleton } from "@workspace/fraud-busters-command-center/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/fraud-busters-command-center/components/ui/table";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@workspace/fraud-busters-command-center/components/ui/form";
import { useForm } from "react-hook-form";
import { TooltipProvider } from "@workspace/fraud-busters-command-center/components/ui/tooltip";
import { Toaster } from "@workspace/fraud-busters-command-center/components/ui/toaster";
import { toast } from "@workspace/fraud-busters-command-center/hooks/use-toast";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import NotFound from "@/pages/not-found";
import { DemoProvider, useDemoContext, type DemoMode, type ScenarioId } from "@/lib/demo-context";
import { MOCK_BENCHMARKS, SCENARIOS, mockAnalyze, scenarioValues } from "@/lib/demo-fixtures";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
});
const nav = [
  { href: "/", label: "Overview", icon: HomeIcon },
  { href: "/analyze", label: "Live analysis", icon: Activity },
  { href: "/benchmarks", label: "Benchmarks", icon: BarChart3 },
  { href: "/methodology", label: "Methodology", icon: Info },
  { href: "/demo", label: "Demo scenarios", icon: Play },
];

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { mode } = useDemoContext();
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-20 border-b bg-sidebar/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
          <img src="/logo.png" alt="Fraud Busters" className="h-9 w-auto rounded-md" />
          <span><span className="block text-sm font-bold tracking-tight">FRAUD BUSTERS</span><span className="block text-[10px] uppercase tracking-[.2em] text-muted-foreground">Command center</span></span>
        </Link>
        <div className="hidden items-center gap-3 md:flex"><StateBadge value={mode} /><span className="text-xs text-muted-foreground">Synthetic evaluation</span></div>
        <button className="rounded-md p-2 md:hidden" onClick={() => setOpen(!open)} aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} data-testid="button-menu"><Menu className="size-5" /></button>
        <nav aria-label="Primary navigation" className={`${open ? "flex" : "hidden"} absolute left-0 top-16 w-full flex-col gap-1 border-b bg-sidebar p-3 md:static md:flex md:w-auto md:flex-row md:border-0 md:bg-transparent md:p-0`}>
          {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} data-testid={`link-nav-${label.toLowerCase().replaceAll(" ", "-")}`} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent ${location === href ? "bg-sidebar-accent font-semibold text-primary" : "text-sidebar-foreground"}`}><Icon className="size-4" />{label}</Link>)}
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-screen-2xl px-4 py-6 md:px-8 md:py-10">{children}</main>
    <footer className="mx-auto flex max-w-screen-2xl flex-col gap-2 border-t px-4 py-5 text-xs text-muted-foreground md:flex-row md:justify-between md:px-8">
      <span>Fraud Busters · Synthetic evaluation environment</span>
      <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-primary" /> Human review remains the decision point</span>
    </footer>
  </div>;
}

function StateBadge({ value }: { value?: string }) {
  const v = value || "unknown";
  const tone = v === "live" || v === "ready" || v === "available" ? "bg-primary/10 text-primary" :
    v === "fallback" || v === "unavailable" || v === "error" ? "bg-destructive/10 text-destructive" :
      v === "mock" || v === "cached" || v === "simulator" ? "bg-accent/30 text-accent-foreground" : "bg-muted text-muted-foreground";
  return <Badge className={tone} data-testid={`status-${v}`}>{v}</Badge>;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Fraud Busters`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  }, [title, description]);
  return <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
    <div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-primary"><span className="size-1.5 rounded-full bg-primary" />{eyebrow}</div><h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p></div>
    {action}
  </div>;
}

function Loading({ label = "Loading intelligence" }: { label?: string }) {
  return <Card><CardContent className="space-y-4 p-6" aria-live="polite"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-10 w-2/3" /><p className="text-xs text-muted-foreground">{label}…</p></CardContent></Card>;
}

function ErrorState({ retry, title = "Intelligence service unavailable", description = "No raw service details are shown. Try again or continue in rehearsal mode." }: { retry: () => void; title?: string; description?: string }) {
  return <Card className="border-destructive/40"><CardContent className="flex items-center gap-4 p-6"><CircleAlert className="size-7 shrink-0 text-destructive" /><div className="flex-1"><p className="font-semibold">{title}</p><p className="text-sm text-muted-foreground">{description}</p></div><Button variant="outline" onClick={retry} data-testid="button-retry"><RotateCcw className="mr-2 size-4" />Retry</Button></CardContent></Card>;
}

function Metric({ label, value, icon, test }: { label: string; value: string; icon: ReactNode; test: string }) {
  return <Card><CardContent className="flex items-center gap-4 p-5"><span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span><div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-lg font-bold" data-testid={test}>{value}</p></div></CardContent></Card>;
}

function ScoreCard({ result }: { result?: AnalyzeResponse }) {
  if (!result) return <Card className="data-grid"><CardContent className="p-8"><Gauge className="mb-4 size-8 text-muted-foreground" /><p className="font-semibold">No analysis yet</p><p className="mt-1 text-sm text-muted-foreground">Submit a synthetic transaction to see a model score.</p></CardContent></Card>;
  const score = Math.max(0, Math.min(1, result.fraud_score));
  const percent = Math.round(score * 100);
  const high = score >= 0.75;
  const review = score >= 0.45;
  const tone = high ? "text-destructive" : review ? "text-accent-foreground" : "text-primary";
  return <Card className="overflow-hidden"><div className={`h-1 ${high ? "bg-destructive" : review ? "bg-accent" : "bg-primary"}`} /><CardContent className="p-6">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Fraud model score</p><div className={`mt-2 text-7xl font-bold tracking-tighter ${tone}`} data-testid="text-fraud-score">{percent}<span className="text-3xl">%</span></div><p className="font-mono text-xs text-muted-foreground">raw score {score.toFixed(3)} · model {result.model_used}</p></div><StateBadge value={result.execution_mode} /></div>
    <div className="mt-6" role="meter" aria-label="Fraud model score" aria-valuemin={0} aria-valuemax={1} aria-valuenow={score} aria-valuetext={`${percent} percent, ${result.risk_band || "review signal"}`}><div className="mb-2 flex justify-between text-[11px] uppercase tracking-wider text-muted-foreground"><span>lower signal</span><span>review threshold 45%</span><span>high signal 75%</span></div><div className="flex h-3 gap-1 overflow-hidden rounded-full bg-muted"><div className="rounded-l-full bg-primary" style={{ width: `${Math.min(45, percent)}%` }} /><div className="bg-accent" style={{ width: `${Math.max(0, Math.min(30, percent - 45))}%` }} /><div className="rounded-r-full bg-destructive" style={{ width: `${Math.max(0, percent - 75)}%` }} /></div></div>
    <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm"><span className="text-muted-foreground">Risk band</span><strong data-testid="text-risk-band">{result.risk_band || "Review signal"}</strong></div>
    <p className="mt-4 rounded-md bg-muted p-3 text-xs leading-relaxed text-muted-foreground">Review recommended means prioritize human investigation. This score is not proof of fraud and does not trigger automatic enforcement.</p>
  </CardContent></Card>;
}

function TransactionSummary({ result, values }: { result: AnalyzeResponse; values: Record<string, string> }) {
  const transaction = result.transaction ?? values;
  return <Card><CardHeader><CardTitle className="text-base">Transaction summary</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 text-sm">{Object.entries(transaction).map(([key, value]) => <div key={key} className="rounded-md bg-muted/60 p-3"><p className="text-[11px] text-muted-foreground">{key.replaceAll("_", " ")}</p><p className="mt-1 break-words font-mono text-xs">{typeof value === "number" && key !== "transactionType" ? value.toLocaleString("en-KE") : String(value)}</p></div>)}</CardContent></Card>;
}

function ProvenancePanel({ result }: { result: AnalyzeResponse }) {
  return <details className="rounded-lg border bg-card p-4"><summary className="cursor-pointer list-none font-semibold"><span className="flex items-center gap-2"><Waypoints className="size-4 text-primary" />Returned context & provenance <span className="ml-auto text-xs font-normal text-muted-foreground">Expand</span></span></summary><div className="mt-4 space-y-3 border-t pt-4 text-sm"><div className="grid gap-3 sm:grid-cols-2">{[["Model", result.model_used], ["Execution", result.execution_mode], ["Request ID", result.request_id || "Not returned"], ["Timestamp", result.timestamp ? new Date(result.timestamp).toLocaleString() : "Not returned"]].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words font-mono text-xs">{value}</p></div>)}</div>{result.signal_context?.length ? <div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Returned signal context</p><ul className="space-y-2">{result.signal_context.map((item) => <li key={item} className="flex gap-2 rounded-md bg-muted p-2 text-xs"><Check className="size-4 shrink-0 text-primary" />{item}</li>)}</ul><p className="mt-2 text-[11px] text-muted-foreground">Context describes returned transaction signals; it is not a validated causal explanation.</p></div> : null}</div></details>;
}

function AnalyzingState() {
  const [stage, setStage] = useState(0);
  const stages = ["Validating input", "Preparing feature vector", "Evaluating quantum kernel", "Preparing result"];
  useEffect(() => { const id = window.setInterval(() => setStage((current) => Math.min(current + 1, stages.length - 1)), 800); return () => window.clearInterval(id); }, []);
  return <Card className="border-primary/40 bg-primary/5"><CardContent className="p-6" aria-live="polite"><div className="flex items-center gap-3"><Activity className="size-5 animate-pulse text-primary" /><div><p className="font-semibold">Analyzing synthetic transaction</p><p className="text-xs text-muted-foreground">The stages are a presentation cue; only the final response is measured.</p></div><TimerReset className="ml-auto size-5 text-muted-foreground" /></div><div className="mt-5 grid gap-2">{stages.map((label, index) => <div key={label} className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${index <= stage ? "bg-primary/10 text-foreground" : "text-muted-foreground"}`}><span className={`flex size-5 items-center justify-center rounded-full text-[10px] ${index < stage ? "bg-primary text-primary-foreground" : index === stage ? "border border-primary text-primary" : "border bg-muted"}`}>{index < stage ? "✓" : index + 1}</span>{label}</div>)}</div></CardContent></Card>;
}

function Home() {
  const overview = useGetOverview({ query: { queryKey: getGetOverviewQueryKey() } });
  const health = useHealthCheck();
  const benchmarks = useGetBenchmarks({ query: { queryKey: getGetBenchmarksQueryKey() } });
  const { latestAnalysis } = useDemoContext();
  const data = overview.data;
  const latest = latestAnalysis ?? data?.latest_analysis;
  const [sample, setSample] = useState<AnalyzeResponse | undefined>(undefined);
  useEffect(() => {
    if (latest) return;
    let alive = true;
    fetch("/api/v1/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction: {
          amount: "28500", oldbalanceOrg: "31000", newbalanceOrig: "2500",
          oldbalanceDest: "1800", newbalanceDest: "30300", transactionType: "TRANSFER",
        },
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j) setSample(j); })
      .catch(() => { /* overview stays informative even if analyze is offline */ });
    return () => { alive = false; };
  }, [latest]);
  const shown = latest ?? sample;
  return <><PageTitle eyebrow="Operational overview" title="See the signal. Keep the human in the loop." description="A calm workspace for inspecting one synthetic transaction at a time, with model identity and execution state visible at every step." action={<Link href="/analyze" className="inline-flex"><Button data-testid="button-start-analysis">Start analysis <ArrowRight className="ml-2 size-4" /></Button></Link>} />
    {overview.isLoading ? <Loading /> : overview.isError ? <ErrorState retry={() => overview.refetch()} /> : <><div className="grid gap-4 md:grid-cols-4"><Metric label="System status" value={data?.system_status || "unavailable"} icon={<ShieldCheck />} test="status-system" /><Metric label="Execution mode" value={data?.execution_mode || "unknown"} icon={<Cpu />} test="status-execution" /><Metric label="Primary model" value={data?.primary_model || "Not reported"} icon={<SlidersHorizontal />} test="text-primary-model" /><Metric label="Last benchmark" value={data?.last_benchmark ? "Available" : "Unavailable"} icon={<BarChart3 />} test="text-last-benchmark" /></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]"><ScoreCard result={shown} /><Card><CardHeader><CardTitle className="text-base">System posture</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Health check</span><StateBadge value={health.isError ? "unavailable" : health.data?.status || "pending"} /></div><div className="flex justify-between"><span className="text-muted-foreground">Model readiness</span><span>{health.data?.model_ready === false ? "Unavailable" : health.data?.model_ready ? "Ready" : "Not returned"}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Latest request</span><span className="font-mono text-xs">{shown?.request_id || "None recorded"}</span></div>{benchmarks.data?.benchmark_table?.[0] ? <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs"><p className="font-semibold">Benchmark snapshot</p><p className="mt-1 text-muted-foreground">QSVM ROC-AUC <span className="font-mono text-foreground">{benchmarks.data.benchmark_table[0].roc_auc?.toFixed(3) || "Not available"}</span> on the shared evaluation split.</p></div> : null}<div className="rounded-md border border-accent/50 bg-accent/10 p-3 text-xs leading-relaxed">Synthetic, anonymized values only. Model output supports analyst judgment; it does not make a guilt determination.</div></CardContent></Card></div>
      <Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4 text-primary" />Model performance on the shared split</CardTitle><p className="mt-1 text-xs text-muted-foreground">ROC-AUC by model from the real benchmark table.</p></CardHeader><CardContent>{benchmarks.data?.benchmark_table?.length ? (<><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={benchmarks.data.benchmark_table.filter((r) => r.roc_auc != null)} layout="vertical" margin={{ left: 8, right: 16 }}><CartesianGrid stroke="#3b2f66" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 1]} tickFormatter={(v) => String(v)} tick={{ fill: "#c7b8ff" }} stroke="#4a3d7a" /><YAxis type="category" dataKey="model" width={175} tick={{ fill: "#e5dcff", fontSize: 12 }} stroke="transparent" /><Tooltip contentStyle={{ background: "#1a1333", border: "1px solid #4a3d7a", borderRadius: 8, color: "#f2edff" }} labelStyle={{ color: "#c7b8ff" }} formatter={(v) => [Number(v).toFixed(3), "ROC-AUC"]} cursor={{ fill: "rgba(139,92,246,0.08)" }} /><Bar dataKey="roc_auc" radius={[0, 7, 7, 0]}>{benchmarks.data.benchmark_table.filter((r) => r.roc_auc != null).map((_, i) => (<Cell key={i} fill={["#a78bfa", "#22d3ee", "#f472b6", "#fbbf24", "#34d399", "#fb7185", "#60a5fa"][i % 7]} />))}</Bar></BarChart></ResponsiveContainer></div></>) : <p className="py-8 text-center text-sm text-muted-foreground">No benchmark rows returned.</p>}</CardContent></Card>
<Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4 text-primary" />What happens next?</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-4">{[["01", "Shape", "Load the model-owned feature schema."], ["02", "Evaluate", "Submit a synthetic transaction to QSVM."], ["03", "Inspect", "Read score, context, and provenance."], ["04", "Compare", "Check the same-split benchmark story."]].map(([number, title, body]) => <div key={number} className="flex gap-3"><span className="font-mono text-sm text-primary">{number}</span><div><p className="font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{body}</p></div></div>)}</CardContent></Card>
    </>}
  </>;
}

type FormValues = Record<string, string>;

function Analyze() {
  const config = useGetModelConfig({ query: { queryKey: getGetModelConfigQueryKey() } });
  const mutation = useAnalyzeTransaction();
  const { mode, scenario, setScenario, latestAnalysis, setLatestAnalysis, clearLatestAnalysis } = useDemoContext();
  const schema = config.data?.feature_schema || [];
  const form = useForm<FormValues>({ defaultValues: {} });
  const [result, setResult] = useState<AnalyzeResponse | undefined>(latestAnalysis);
  const [mockPending, setMockPending] = useState(false);
  const [submittedValues, setSubmittedValues] = useState<FormValues>({});
  const [lastPayload, setLastPayload] = useState<FormValues>();
  const requestNumber = useRef(0);
  const [, setLocation] = useLocation();
  const loading = mutation.isPending || mockPending;

  useEffect(() => { if (schema.length) form.reset(scenarioValues(scenario, schema)); }, [config.data?.feature_schema, scenario]);

  const loadScenario = (id: ScenarioId) => {
    setScenario(id);
    form.reset(scenarioValues(id, schema));
  };

  const execute = (values: FormValues) => {
    const request = ++requestNumber.current;
    setSubmittedValues(values);
    setLastPayload(values);
    if (mode !== "live") {
      setMockPending(true);
      window.setTimeout(() => {
        if (request !== requestNumber.current) return;
        const response = mockAnalyze(values, schema, mode === "cached" ? "cached" : "mock");
        setResult(response);
        setLatestAnalysis(response, values);
        setMockPending(false);
        toast({ title: mode === "cached" ? "Prepared snapshot loaded" : "Mock analysis complete", description: "No live prediction was completed." });
      }, 650);
      return;
    }
    const transaction = Object.fromEntries(schema.map((field) => [field.key, field.type === "number" ? Number(values[field.key]) : values[field.key]]));
    mutation.mutate({ data: { transaction } }, {
      onSuccess: (response) => {
        if (request !== requestNumber.current) return;
        setResult(response);
        setLatestAnalysis(response, values);
        toast({ title: "Analysis complete", description: `${response.model_used} returned a ${Math.round(response.fraud_score * 100)}% score.` });
      },
      onError: () => toast({ title: "Analysis could not be completed", description: "Retry the same submitted transaction or switch to rehearsal mode." }),
    });
  };

  const submit = (values: FormValues) => execute(values);
  const retry = () => { if (lastPayload) execute(lastPayload); };
  const reset = () => { ++requestNumber.current; mutation.reset(); setMockPending(false); setResult(undefined); setSubmittedValues({}); setLastPayload(undefined); clearLatestAnalysis(); form.reset(scenarioValues(null, schema)); };
  return <><PageTitle eyebrow="Live analysis" title="Evaluate a synthetic transaction" description="The form is generated from the active model schema. Only returned feature fields are sent for evaluation." action={<StateBadge value={loading ? "pending" : mode} />} />
    {config.isLoading ? <Loading label="Loading model-owned schema" /> : config.isError ? <ErrorState retry={() => config.refetch()} /> : <div className="grid gap-6 lg:grid-cols-[1fr_.82fr]">
      <div className="space-y-6"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="size-4 text-primary" />Transaction features <span className="ml-auto text-xs font-normal text-muted-foreground">{schema.length} fields · {config.data?.primary_model}</span></CardTitle></CardHeader><CardContent>
        <div className="mb-5 flex flex-wrap gap-2">{SCENARIOS.map((item) => <Button key={item.id} type="button" variant={scenario === item.id ? "secondary" : "outline"} size="sm" onClick={() => loadScenario(item.id)} data-testid={`button-load-${item.id}`}>{item.title}</Button>)}</div>
        <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          {schema.map((field: FeatureDefinition) => <FormField key={field.key} control={form.control} name={field.key} rules={{ required: field.required ? `${field.label} is required` : false, validate: (value) => { if (!value) return field.required ? `${field.label} is required` : true; if (field.type === "number") { const number = Number(value); if (!Number.isFinite(number)) return "Enter a valid number"; if (field.min != null && number < field.min) return `Use ${field.min} or higher`; if (field.max != null && number > field.max) return `Use ${field.max.toLocaleString()} or lower`; } return true; } }} render={({ field: controllerField }) => <FormItem><FormLabel>{field.label}{field.required && <span className="ml-1 text-destructive">*</span>} {field.unit && <span className="text-xs text-muted-foreground">({field.unit})</span>}</FormLabel><FormControl>{field.type === "select" && field.options?.length ? <Select value={controllerField.value || ""} onValueChange={controllerField.onChange}><SelectTrigger data-testid={`input-feature-${field.key}`}><SelectValue placeholder={field.placeholder || "Select synthetic value"} /></SelectTrigger><SelectContent>{field.options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select> : <Input {...controllerField} value={controllerField.value || ""} type={field.type === "number" ? "number" : "text"} placeholder={field.placeholder || "Synthetic value"} min={field.min ?? undefined} max={field.max ?? undefined} onChange={(event: ChangeEvent<HTMLInputElement>) => controllerField.onChange(event.target.value)} data-testid={`input-feature-${field.key}`} />}</FormControl>{field.description && <FormDescription>{field.description}</FormDescription>}<FormMessage /></FormItem>} />)}
          <div className="sm:col-span-2 flex flex-wrap gap-3"><Button type="submit" disabled={loading || !schema.length} className="min-w-48 flex-1" data-testid="button-submit-analysis">{loading ? <><Activity className="mr-2 size-4 animate-pulse" />Evaluating {mode === "live" ? "model" : "rehearsal"}…</> : <>Analyze with QSVM <ArrowRight className="ml-2 size-4" /></>}</Button><Button type="button" variant="outline" onClick={reset} disabled={loading}><X className="mr-2 size-4" />Clear</Button></div>
        </form></Form>
        <details className="mt-5 rounded-md border p-3 text-xs"><summary className="cursor-pointer font-semibold">Why these fields? <CircleHelp className="ml-1 inline size-3.5 text-muted-foreground" /></summary><p className="mt-2 leading-relaxed text-muted-foreground">The backend owns this final feature schema. Selection supports a compact model input; it does not prove that any balance field causes fraud.</p></details>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Privacy: use synthetic or anonymized demonstration values. Do not enter real customer information. This prototype does not persist submitted transactions.</p>
      </CardContent></Card></div>
      <div className="space-y-6">{loading ? <AnalyzingState /> : <ScoreCard result={result} />}{mutation.isError && <ErrorState retry={retry} title="Analysis request failed" description="The submitted values were preserved. Retry them or switch to mock mode on the Demo page." />}{result && !loading ? <><TransactionSummary result={result} values={submittedValues} /><ProvenancePanel result={result} /><div className="grid gap-2 sm:grid-cols-3"><Button variant="outline" onClick={reset}>Analyze another</Button><Button variant="outline" onClick={() => setLocation("/benchmarks")}>View benchmark</Button><Button variant="outline" onClick={() => setLocation("/methodology")}>Open methodology</Button></div></> : null}</div>
    </div>}
  </>;
}

type MetricKey = "roc_auc" | "precision" | "recall" | "f1";
const metricLabels: Record<MetricKey, string> = { roc_auc: "ROC-AUC", precision: "Precision", recall: "Recall", f1: "F1" };
const modelOrder = ["QSVM", "Logistic Regression", "Random Forest", "XGBoost", "RBF-SVM"];

function benchmarkValue(row: BenchmarkRow, metric: MetricKey) {
  const value = row[metric];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function Benchmarks() {
  const query = useGetBenchmarks({ query: { queryKey: getGetBenchmarksQueryKey() } });
  const [metric, setMetric] = useState<MetricKey>("roc_auc");
  const rows = useMemo(() => [...(query.data?.benchmark_table || MOCK_BENCHMARKS)].sort((a, b) => modelOrder.indexOf(a.model) - modelOrder.indexOf(b.model)), [query.data?.benchmark_table]);
  const cached = query.isError || query.data?.execution_mode === "cached";
  const metadata = query.data?.metadata as Record<string, unknown> | undefined;
  const metadataValue = (value: unknown, fallback: string) => value == null || value === "" ? fallback : String(value);
  return <><PageTitle eyebrow="Model integrity" title="Benchmark comparison" description="Comparable metrics on one shared split. Unavailable values stay unavailable — never represented as zero." action={<StateBadge value={cached ? "cached" : query.data?.execution_mode} />} />
    {query.isLoading ? <Loading label="Loading benchmark evaluation" /> : <>{cached && <div className="mb-6 flex items-start gap-3 rounded-lg border border-accent/50 bg-accent/10 p-4 text-sm"><CircleAlert className="mt-0.5 size-5 shrink-0 text-accent-foreground" /><p><strong>Prepared benchmark snapshot.</strong> The live benchmark endpoint was unavailable, so this view is using an explicitly labeled cached rehearsal snapshot.</p></div>}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{[["Dataset", metadataValue(metadata?.dataset, "PaySim-derived synthetic transactions")], ["Split", metadataValue(metadata?.evaluation_split, "Not returned")], ["Features", metadataValue(metadata?.feature_count, "Not returned")], ["Qubits", metadataValue(metadata?.qubit_count, "Not returned")], ["Backend", metadataValue(metadata?.execution_backend, "Not returned")], ["Evaluated", metadataValue(metadata?.last_run || query.data?.timestamp, "Not returned")]].map(([label, value]) => <div key={label} className="rounded-lg border bg-card p-4"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 break-words font-mono text-xs">{value}</p></div>)}</div>
      <Card><CardHeader><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><CardTitle className="text-base">Same-split model comparison</CardTitle><p className="mt-1 text-xs text-muted-foreground">QSVM is shown first; classical baselines remain visible for an honest comparison.</p></div><div className="flex items-center gap-2"><label htmlFor="metric-selector" className="text-xs font-semibold">Metric</label><Select value={metric} onValueChange={(value) => setMetric(value as MetricKey)}><SelectTrigger id="metric-selector" className="w-36" data-testid="select-benchmark-metric"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(metricLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div></CardHeader><CardContent>
        <p className="sr-only" id="benchmark-chart-summary">Grouped bar chart of {metricLabels[metric]} by model. {rows.map((row) => `${row.model}: ${benchmarkValue(row, metric)?.toFixed(3) || "not available"}`).join("; ")}.</p>
        <div className="h-[340px] w-full" role="img" aria-labelledby="benchmark-chart-summary"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows.map((row) => ({ model: row.model, score: benchmarkValue(row, metric) }))} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.18} /><XAxis dataKey="model" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={60} /><YAxis domain={[0, 1]} tick={{ fontSize: 11 }} tickFormatter={(value) => value.toFixed(1)} /><Tooltip formatter={(value) => typeof value === "number" ? [value.toFixed(3), metricLabels[metric]] : ["Not available", metricLabels[metric]]} /><Bar dataKey="score" name={metricLabels[metric]} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <p className="mt-2 text-center text-xs text-muted-foreground">Values are bounded from 0 to 1. Blank bars mean the metric was not returned, not zero.</p>
      </CardContent></Card>
      <Card className="mt-6"><CardHeader><CardTitle className="text-base">Accessible benchmark table</CardTitle></CardHeader><CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Model</TableHead><TableHead>ROC-AUC</TableHead><TableHead>Precision</TableHead><TableHead>Recall</TableHead><TableHead>F1</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{rows.map((row, index) => <TableRow key={row.model} data-testid={`row-benchmark-${index}`}><TableCell className="font-semibold">{row.model}</TableCell>{(["roc_auc", "precision", "recall", "f1"] as MetricKey[]).map((key) => <TableCell key={key} className={key === metric ? "font-bold text-primary" : ""}>{benchmarkValue(row, key)?.toFixed(3) || <span className="text-muted-foreground">Not available</span>}</TableCell>)}<TableCell><StateBadge value={row.status} />{row.note && <p className="mt-1 max-w-48 text-xs text-muted-foreground">{row.note}</p>}</TableCell></TableRow>)}</TableBody></Table>{!rows.length && <p className="py-8 text-center text-sm text-muted-foreground">No benchmark rows were returned.</p>}</CardContent></Card>
      <details className="mt-6 rounded-lg border bg-card p-5"><summary className="cursor-pointer font-semibold">How to read this panel</summary><div className="mt-4 grid gap-4 border-t pt-4 text-sm text-muted-foreground md:grid-cols-3"><p><strong className="text-foreground">ROC-AUC</strong> captures ranking quality across thresholds.</p><p><strong className="text-foreground">Precision</strong> asks how many flagged results are relevant.</p><p><strong className="text-foreground">Recall and F1</strong> show detection coverage and the precision/recall balance. Highly imbalanced fraud data needs all four metrics; no single metric proves operational superiority.</p></div>{metadata?.metric_note != null && <p className="mt-4 text-xs text-muted-foreground">{metadataValue(metadata.metric_note, "")}</p>}</details>
    </>}
  </>;
}

function Methodology() {
  const steps = [["01", "Transaction fields", "A compact, backend-owned feature vector enters the workflow."], ["02", "Preprocessing & scaling", "Selected values are cleaned and scaled for model input."], ["03", "Quantum feature map", "A shallow map such as ZZFeatureMap encodes the vector."], ["04", "Quantum kernel / QSVM", "A kernel estimates similarity before classification."], ["05", "Score & benchmark", "The score is paired with context and same-split baselines."]];
  return <><PageTitle eyebrow="How it works" title="A transparent path from features to review" description="Quantum computing is part of the evaluation workflow, not a claim of automatic superiority." /><div className="grid gap-3 md:grid-cols-5">{steps.map(([number, title, body]) => <Card key={number}><CardContent className="p-5"><span className="font-mono text-sm text-primary">{number}</span><h2 className="mt-4 text-base font-bold">{title}</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p></CardContent></Card>)}</div><div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr]"><Card><CardHeader><CardTitle className="text-base">What the model can and cannot tell us</CardTitle></CardHeader><CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground"><p>The final four-to-eight features are owned by Data/ML and the backend. A quantum kernel compares feature vectors; it does not turn a transaction into a definitive judgment.</p><p>Classical baselines use the same evaluation split so the benchmark is a fair comparison. Missing metadata and metrics stay visibly unavailable.</p><p className="rounded-md bg-muted p-3 text-xs">Feature importance or “reasons” are shown only when validated attribution data is returned. Transaction context is not causal explainability.</p></CardContent></Card><Card className="border-accent/50 bg-accent/10"><CardContent className="flex gap-4 p-6"><CircleAlert className="size-5 shrink-0 text-accent-foreground" /><div><p className="font-semibold">Current limitation</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">This hackathon prototype tests whether a small, carefully scoped quantum-kernel classifier provides useful evidence on a selected dataset. It does not claim that current quantum hardware universally outperforms classical models.</p></div></CardContent></Card></div></>;
}

function Demo() {
  const [, setLocation] = useLocation();
  const { mode, setMode, setScenario } = useDemoContext();
  return <><PageTitle eyebrow="Rehearsal mode" title="Make the demo dependable" description="Prepare a controlled narrative, switch execution modes explicitly, and keep the human-review boundary visible." action={<Badge variant="outline">Synthetic only</Badge>} /><Card className="mb-6"><CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"><div><p className="font-semibold">Execution mode</p><p className="mt-1 text-xs text-muted-foreground">Live calls the API. Mock and cached modes use deterministic prepared snapshots.</p></div><Select value={mode} onValueChange={(value) => setMode(value as DemoMode)}><SelectTrigger className="w-44" data-testid="select-demo-mode"><SelectValue /></SelectTrigger><SelectContent>{(["live", "mock", "cached"] as DemoMode[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></CardContent></Card><div className="mb-6 rounded-lg border bg-card p-5"><p className="mb-3 flex items-center gap-2 font-semibold"><Check className="size-4 text-primary" />Presenter checklist</p><div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-4"><span>1. Select mode</span><span>2. Load a scenario</span><span>3. Submit once</span><span>4. Compare benchmarks</span></div></div><div className="grid gap-4 md:grid-cols-3">{SCENARIOS.map((scenario) => <Card key={scenario.id} className="transition-transform hover:-translate-y-1"><CardContent className="p-6"><div className="flex items-center justify-between"><span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">0{SCENARIOS.indexOf(scenario) + 1}</span><Badge variant="secondary">{scenario.badge}</Badge></div><h2 className="mt-6 font-bold">{scenario.title}</h2><p className="mt-2 text-sm text-muted-foreground">{scenario.description}</p><Button variant="outline" className="mt-6 w-full" onClick={() => { setScenario(scenario.id); setLocation("/analyze"); }} data-testid={`button-scenario-${scenario.id}`}>Load workspace <ArrowRight className="ml-2 size-4" /></Button></CardContent></Card>)}</div><p className="mt-6 text-xs leading-relaxed text-muted-foreground">Fallback wording: “This is a prepared demonstration snapshot; no live prediction was completed.” Never present a mock, cached, or fallback response as live.</p></>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><DemoProvider><Shell><Switch><Route path="/" component={Home} /><Route path="/analyze" component={Analyze} /><Route path="/benchmarks" component={Benchmarks} /><Route path="/methodology" component={Methodology} /><Route path="/demo" component={Demo} /><Route component={NotFound} /></Switch></Shell></DemoProvider></TooltipProvider><Toaster /></QueryClientProvider>;
}

export default App;