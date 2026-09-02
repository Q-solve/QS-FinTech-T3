import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@workspace/fraud-busters-command-center/components/ui/button";
import { Card, CardContent } from "@workspace/fraud-busters-command-center/components/ui/card";

export default function NotFound() {
  return <div className="flex min-h-[70vh] items-center justify-center">
    <Card className="w-full max-w-md">
      <CardContent className="p-8">
        <div className="flex gap-3">
          <AlertCircle className="size-7 shrink-0 text-destructive" />
          <div><h1 className="text-xl font-bold">That workspace is not available</h1><p className="mt-2 text-sm text-muted-foreground">The route may have moved. Return to the command-center overview to continue.</p></div>
        </div>
        <Link href="/" className="mt-6 inline-flex" data-testid="link-not-found-home"><Button variant="outline"><ArrowLeft className="mr-2 size-4"/>Back to overview</Button></Link>
      </CardContent>
    </Card>
  </div>;
}