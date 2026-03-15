"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useDocuments } from "@/lib/hooks/useDocuments";
import { useExperiments } from "@/lib/hooks/useExperiments";

function scoreColor(score: number): string {
  if (score >= 0.8) return "text-green-600";
  if (score >= 0.5) return "text-yellow-600";
  return "text-red-600";
}

function StatCard({ label, value, isLoading }: { label: string; value: number | string; isLoading: boolean }) {
  return (
    <Card className="p-5">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {isLoading ? (
        <Skeleton className="h-8 w-12" />
      ) : (
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const { documents, isLoading: docsLoading } = useDocuments({ limit: 200 });
  const { experiments, isLoading: expsLoading } = useExperiments({ limit: 200 });

  const totalDocs = documents?.length ?? 0;
  const readyDocs = documents?.filter((d) => d.status === "ready") ?? [];
  const totalExps = experiments?.length ?? 0;
  const recentDocs = documents?.slice(0, 5) ?? [];
  const recentExps = experiments?.slice(0, 5) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your RAG platform activity.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Documents" value={totalDocs} isLoading={docsLoading} />
        <StatCard label="Documents Ready" value={readyDocs.length} isLoading={docsLoading} />
        <StatCard label="Experiments Run" value={totalExps} isLoading={expsLoading} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent Documents</h2>
            <Link href="/documents" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="rounded-md border divide-y">
            {docsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3"><Skeleton className="h-5 w-full" /></div>
              ))
            ) : recentDocs.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No documents yet.</p>
            ) : recentDocs.map((doc) => (
              <div key={doc.document_id} className="flex items-center justify-between p-3">
                <span className="text-sm truncate max-w-[200px]">{doc.original_filename}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={doc.status} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent Experiments</h2>
            <Link href="/experiments" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="rounded-md border divide-y">
            {expsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3"><Skeleton className="h-5 w-full" /></div>
              ))
            ) : recentExps.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No experiments yet.</p>
            ) : recentExps.map((exp) => (
              <Link
                key={exp.experiment_id}
                href={`/experiments/${exp.experiment_id}`}
                className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm truncate max-w-[140px]">{exp.name}</span>
                  <Badge variant="outline" className="text-xs font-normal shrink-0">{exp.retrieval_strategy}</Badge>
                </div>
                {exp.results && (
                  <div className="flex gap-2 text-xs shrink-0">
                    <span className={scoreColor(exp.results.avg_faithfulness)}>F {exp.results.avg_faithfulness.toFixed(2)}</span>
                    <span className={scoreColor(exp.results.avg_relevance)}>R {exp.results.avg_relevance.toFixed(2)}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button render={<Link href="/documents" />}>Upload a document</Button>
        <Button variant="outline" render={<Link href="/chat" />}>Start chatting</Button>
        <Button variant="outline" render={<Link href="/experiments" />}>Run an eval</Button>
      </div>
    </div>
  );
}
