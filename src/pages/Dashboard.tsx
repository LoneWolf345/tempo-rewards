import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LogOut, FileText, Gift, AlertTriangle, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { getStatusStyles } from "@/lib/statusStyles";

interface TempoSubmission {
  id: string;
  technician_email: string;
  technician_name: string;
  upsell_amount: number;
  submission_date: string;
  status: string;
}

interface SendosoRecord {
  id: string;
  technician_email: string;
  technician_name: string;
  reward_amount: number;
  fulfillment_date: string;
  status: string;
}

export default function Dashboard() {
  const { profile, signOut, isAdmin } = useAuth();
  const [tempoSubmissions, setTempoSubmissions] = useState<TempoSubmission[]>([]);
  const [sendosoRecords, setSendosoRecords] = useState<SendosoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tempoRes, sendosoRes] = await Promise.all([
        supabase.from("tempo_submissions").select("*").order("submission_date", { ascending: false }),
        supabase.from("sendoso_records").select("*").order("fulfillment_date", { ascending: false }),
      ]);

      if (tempoRes.data) setTempoSubmissions(tempoRes.data as TempoSubmission[]);
      if (sendosoRes.data) setSendosoRecords(sendosoRes.data as SendosoRecord[]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate stats
  const totalSubmissions = tempoSubmissions.length;
  const totalRewards = sendosoRecords.length;
  const totalSubmissionAmount = tempoSubmissions.reduce((sum, t) => sum + Number(t.upsell_amount), 0);
  const totalRewardAmount = sendosoRecords.reduce((sum, s) => sum + Number(s.reward_amount), 0);

  // Find missing rewards (tempo submissions without matching sendoso record)
  const missingRewards = tempoSubmissions.filter((tempo) => {
    const tempoDate = format(new Date(tempo.submission_date), "yyyy-MM-dd");
    return !sendosoRecords.some(
      (sendoso) =>
        sendoso.technician_email.toLowerCase() === tempo.technician_email.toLowerCase() &&
        format(new Date(sendoso.fulfillment_date), "yyyy-MM-dd") === tempoDate
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold">TeMPO Rewards Tracker</h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {profile?.full_name || profile?.email}
              {isAdmin && <Badge variant="secondary" className="ml-2">Admin</Badge>}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" asChild>
                <a href="/admin">Admin Panel</a>
              </Button>
            )}
            <Button variant="ghost" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSubmissions}</div>
              <p className="text-xs text-muted-foreground">TeMPO upsells submitted</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rewards Received</CardTitle>
              <Gift className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRewards}</div>
              <p className="text-xs text-muted-foreground">Sendoso gift cards</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Missing Rewards</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{missingRewards.length}</div>
              <p className="text-xs text-muted-foreground">Submissions without rewards</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalRewardAmount.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Rewards received</p>
            </CardContent>
          </Card>
        </div>

        {/* Missing Rewards Alert */}
        {missingRewards.length > 0 && (
          <Card className="mb-8 border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Missing Rewards
              </CardTitle>
              <CardDescription>
                The following submissions don't have a matching reward in Sendoso
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingRewards.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell>{format(new Date(submission.submission_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>${Number(submission.upsell_amount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">Missing Reward</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* All Records */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* TeMPO Submissions */}
          <Card>
            <CardHeader>
              <CardTitle>TeMPO Submissions</CardTitle>
              <CardDescription>Your upsell submissions from TeMPO</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : tempoSubmissions.length === 0 ? (
                <p className="text-muted-foreground">No submissions found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tempoSubmissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell>{format(new Date(submission.submission_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>${Number(submission.upsell_amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{submission.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Sendoso Records */}
          <Card>
            <CardHeader>
              <CardTitle>Sendoso Rewards</CardTitle>
              <CardDescription>Gift cards received from Sendoso</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : sendosoRecords.length === 0 ? (
                <p className="text-muted-foreground">No rewards found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sendosoRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{format(new Date(record.fulfillment_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>${Number(record.reward_amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="default">{record.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
