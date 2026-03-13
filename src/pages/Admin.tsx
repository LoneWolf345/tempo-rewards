import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { ArrowLeft, Upload, Users, FileText, Gift, Shield, Search, ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import { format } from "date-fns";
import { getStatusStyles } from "@/lib/statusStyles";
import { useEmulation } from "@/contexts/EmulationContext";

const isValidDate = (dateStr: string): boolean => {
  // Accept YYYY-MM-DD or YYYY-MM-DD HH:MM:SS.ms formats
  const dateOnly = dateStr.includes(" ") ? dateStr.split(" ")[0] : dateStr;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) && !isNaN(Date.parse(dateOnly));
};

const extractDate = (dateStr: string): string => {
  return dateStr.includes(" ") ? dateStr.split(" ")[0] : dateStr;
};

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
}

interface UserRole {
  user_id: string;
  role: string;
}

interface TempoSubmission {
  id: string;
  technician_email: string;
  technician_name: string;
  upsell_amount: number;
  submission_date: string;
  status: string;
  uploaded_at: string;
}

interface SendosoRecord {
  id: string;
  technician_email: string;
  technician_name: string;
  reward_amount: number;
  fulfillment_date: string;
  status: string;
  uploaded_at: string;
  expiry_date: string | null;
  transaction_id: string | null;
}

export default function Admin() {
  const { isAdmin, isLoading: authLoading, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { startEmulation } = useEmulation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [tempoUploadError, setTempoUploadError] = useState<string | null>(null);
  const [sendosoUploadError, setSendosoUploadError] = useState<string | null>(null);

  // TeMPO pagination state
  const [tempoRecords, setTempoRecords] = useState<TempoSubmission[]>([]);
  const [tempoTotal, setTempoTotal] = useState(0);
  const [tempoPage, setTempoPage] = useState(0);
  const [tempoSearch, setTempoSearch] = useState("");
  const [tempoSearchInput, setTempoSearchInput] = useState("");
  const [tempoLoading, setTempoLoading] = useState(false);

  // Sendoso pagination state
  const [sendosoRecords, setSendosoRecords] = useState<SendosoRecord[]>([]);
  const [sendosoTotal, setSendosoTotal] = useState(0);
  const [sendosoPage, setSendosoPage] = useState(0);
  const [sendosoSearch, setSendosoSearch] = useState("");
  const [sendosoSearchInput, setSendosoSearchInput] = useState("");
  const [sendosoLoading, setSendosoLoading] = useState(false);

  const PAGE_SIZE = 100;

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchBaseData();
      fetchTempoPage();
      fetchSendosoPage();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) fetchTempoPage();
  }, [tempoPage, tempoSearch]);

  useEffect(() => {
    if (isAdmin) fetchSendosoPage();
  }, [sendosoPage, sendosoSearch]);

  const fetchBaseData = async () => {
    setIsLoading(true);
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
      ]);

      if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
      if (rolesRes.data) setUserRoles(rolesRes.data as UserRole[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTempoPage = async () => {
    setTempoLoading(true);
    try {
      let query = supabase.from("tempo_submissions").select("*", { count: "exact" });
      if (tempoSearch.trim()) {
        query = query.ilike("technician_email", `%${tempoSearch.trim()}%`);
      }
      const { data, count, error } = await query
        .order("submission_date", { ascending: false })
        .range(tempoPage * PAGE_SIZE, (tempoPage + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      setTempoRecords((data || []) as TempoSubmission[]);
      setTempoTotal(count || 0);
    } catch (error) {
      console.error("Error fetching tempo records:", error);
    } finally {
      setTempoLoading(false);
    }
  };

  const fetchSendosoPage = async () => {
    setSendosoLoading(true);
    try {
      let query = supabase.from("sendoso_records").select("*", { count: "exact" });
      if (sendosoSearch.trim()) {
        query = query.ilike("technician_email", `%${sendosoSearch.trim()}%`);
      }
      const { data, count, error } = await query
        .order("fulfillment_date", { ascending: false })
        .range(sendosoPage * PAGE_SIZE, (sendosoPage + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      setSendosoRecords((data || []) as SendosoRecord[]);
      setSendosoTotal(count || 0);
    } catch (error) {
      console.error("Error fetching sendoso records:", error);
    } finally {
      setSendosoLoading(false);
    }
  };

  const fetchAllData = () => {
    fetchBaseData();
    fetchTempoPage();
    fetchSendosoPage();
  };

  const getUserRole = (userId: string) => {
    const roles = userRoles.filter((r) => r.user_id === userId).map((r) => r.role);
    if (roles.includes("admin")) return "admin";
    return roles[0] || "technician";
  };

  const handleTempoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setTempoUploadError(null);
    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      const idIdx = headers.findIndex((h) => h === "id");
      const emailIdx = headers.findIndex((h) => h.includes("issued_to_email") || h.includes("email"));
      const amountIdx = headers.findIndex((h) => h === "amount" || h.includes("amount"));
      const dateIdx = headers.findIndex((h) => h.includes("issued_at") || h.includes("date"));
      const statusIdx = headers.findIndex((h) => h === "status");
      const codeIdx = headers.findIndex((h) => h.includes("gift_card_code") || h.includes("code"));

      if (emailIdx === -1 || amountIdx === -1 || dateIdx === -1) {
        setTempoUploadError("CSV must contain issued_to_email, amount, and issued_at columns");
        return;
      }

      const records = [];
      const skippedRows: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
        if (values.length < Math.max(emailIdx, amountIdx, dateIdx) + 1) continue;

        let dateValue = values[dateIdx];
        if (dateValue.includes(" ")) {
          dateValue = dateValue.split(" ")[0];
        }

        if (!isValidDate(dateValue)) {
          skippedRows.push(`Row ${i + 1}: invalid date "${values[dateIdx]}"`);
          continue;
        }

        const amount = parseFloat(values[amountIdx]);
        if (isNaN(amount)) {
          skippedRows.push(`Row ${i + 1}: invalid amount "${values[amountIdx]}"`);
          continue;
        }

        const submissionId = idIdx >= 0 ? values[idIdx] || null : null;
        if (!submissionId) {
          skippedRows.push(`Row ${i + 1}: missing id value`);
          continue;
        }

        records.push({
          submission_id: submissionId,
          technician_email: values[emailIdx],
          technician_name: null,
          upsell_amount: amount,
          submission_date: dateValue,
          status: statusIdx >= 0 ? values[statusIdx] : "Issued",
          uploaded_by: user.id,
          gift_card_code: codeIdx >= 0 ? values[codeIdx] || null : null,
        });
      }

      if (records.length === 0) {
        const details = skippedRows.slice(0, 10).join("\n") + (skippedRows.length > 10 ? `\n...and ${skippedRows.length - 10} more` : "");
        setTempoUploadError(`No valid records found. All rows had errors:\n${details}`);
        return;
      }

      // Upsert in chunks of 500 — insert new, update existing by submission_id
      const chunkSize = 500;
      for (let j = 0; j < records.length; j += chunkSize) {
        const chunk = records.slice(j, j + chunkSize);
        const { error } = await supabase.from("tempo_submissions").upsert(chunk, { onConflict: "submission_id" });
        if (error) throw error;
      }

      if (skippedRows.length > 0) {
        const details = skippedRows.slice(0, 10).join("\n") + (skippedRows.length > 10 ? `\n...and ${skippedRows.length - 10} more` : "");
        setTempoUploadError(`Synced ${records.length} records, but ${skippedRows.length} rows were skipped:\n${details}`);
      }
      toast.success(`Synced ${records.length} TeMPO records`);
      fetchAllData();
    } catch (error: any) {
      console.error("Upload error:", error);
      const msg = error?.message || error?.details || "Unknown error";
      setTempoUploadError(`Failed to upload TeMPO CSV: ${msg}`);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleSendosoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setSendosoUploadError(null);
    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      
      const firstLine = lines[0];
      const delimiter = firstLine.includes("\t") ? "\t" : ",";
      
      const headers = firstLine.split(delimiter).map((h) => h.trim().toLowerCase());

      const emailIdx = headers.findIndex((h) => h.includes("recipient_email") || h.includes("email"));
      const statusIdx = headers.findIndex((h) => h === "status");
      const dateIdx = headers.findIndex((h) => h.includes("created_at") || h.includes("date"));
      const amountIdx = headers.findIndex((h) => h.includes("egift_price") || h.includes("amount"));
      const expiryIdx = headers.findIndex((h) => h.includes("expiry_date") || h.includes("expiry") || h.includes("expires"));
      const txnIdIdx = headers.findIndex((h) => h === "transaction_id");

      if (emailIdx === -1 || amountIdx === -1 || dateIdx === -1) {
        setSendosoUploadError("CSV must contain recipient_email, egift_price, and created_at columns");
        return;
      }

      // Parse CSV rows with validation
      const csvRows = [];
      const skippedRows: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map((v) => v.trim().replace(/"/g, ""));
        if (values.length < Math.max(emailIdx, amountIdx, dateIdx) + 1) continue;

        let dateValue = values[dateIdx];
        if (dateValue.includes(" ")) {
          dateValue = dateValue.split(" ")[0];
        }

        if (!isValidDate(dateValue)) {
          skippedRows.push(`Row ${i + 1}: invalid date "${values[dateIdx]}"`);
          continue;
        }

        let expiryValue: string | null = null;
        if (expiryIdx >= 0 && values[expiryIdx]) {
          expiryValue = values[expiryIdx];
          if (expiryValue.includes(" ")) {
            expiryValue = expiryValue.split(" ")[0];
          }
          if (!isValidDate(expiryValue)) {
            skippedRows.push(`Row ${i + 1}: invalid expiry date "${values[expiryIdx]}"`);
            continue;
          }
        }

        const amount = parseFloat(values[amountIdx]);
        if (isNaN(amount)) {
          skippedRows.push(`Row ${i + 1}: invalid amount "${values[amountIdx]}"`);
          continue;
        }

        csvRows.push({
          technician_email: values[emailIdx],
          reward_amount: amount,
          fulfillment_date: dateValue,
          status: statusIdx >= 0 ? values[statusIdx] : "fulfilled",
          expiry_date: expiryValue,
          transaction_id: txnIdIdx >= 0 && values[txnIdIdx] ? values[txnIdIdx] : null,
        });
      }

      if (csvRows.length === 0) {
        const details = skippedRows.slice(0, 10).join("\n") + (skippedRows.length > 10 ? `\n...and ${skippedRows.length - 10} more` : "");
        setSendosoUploadError(`No valid records found. All rows had errors:\n${details}`);
        return;
      }

      // Fetch all existing records for matching
      const allExisting: SendosoRecord[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("sendoso_records")
          .select("*")
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allExisting.push(...(data as SendosoRecord[]));
        if (data.length < pageSize) break;
        from += pageSize;
      }

      // Build lookup maps: one by transaction_id, one by composite key
      const existingByTxnId = new Map<string, SendosoRecord>();
      const existingByComposite = new Map<string, SendosoRecord>();
      for (const rec of allExisting) {
        if (rec.transaction_id) {
          existingByTxnId.set(rec.transaction_id, rec);
        }
        const key = `${rec.technician_email.toLowerCase()}|${rec.fulfillment_date}|${Number(rec.reward_amount)}`;
        existingByComposite.set(key, rec);
      }

      // Separate into inserts and updates
      const toInsert: Array<{
        technician_email: string;
        technician_name: null;
        reward_amount: number;
        fulfillment_date: string;
        status: string;
        uploaded_by: string;
        expiry_date: string | null;
        transaction_id: string | null;
      }> = [];
      const toUpdate: Array<{ id: string; status: string; expiry_date: string | null; transaction_id: string | null }> = [];

      for (const row of csvRows) {
        // Tier 1: match by transaction_id if present
        let existing: SendosoRecord | undefined;
        if (row.transaction_id) {
          existing = existingByTxnId.get(row.transaction_id);
        }
        // Tier 2: fallback to composite key
        if (!existing) {
          const key = `${row.technician_email.toLowerCase()}|${row.fulfillment_date}|${row.reward_amount}`;
          existing = existingByComposite.get(key);
        }

        if (existing) {
          toUpdate.push({
            id: existing.id,
            status: row.status,
            expiry_date: row.expiry_date,
            transaction_id: row.transaction_id || existing.transaction_id,
          });
        } else {
          toInsert.push({
            technician_email: row.technician_email,
            technician_name: null,
            reward_amount: row.reward_amount,
            fulfillment_date: row.fulfillment_date,
            status: row.status,
            uploaded_by: user.id,
            expiry_date: row.expiry_date,
            transaction_id: row.transaction_id,
          });
        }
      }

      // Batch insert new records
      const chunkSize = 500;
      for (let j = 0; j < toInsert.length; j += chunkSize) {
        const chunk = toInsert.slice(j, j + chunkSize);
        const { error } = await supabase.from("sendoso_records").insert(chunk);
        if (error) throw error;
      }

      // Batch update existing records
      for (const upd of toUpdate) {
        const { error } = await supabase
          .from("sendoso_records")
          .update({ status: upd.status, expiry_date: upd.expiry_date, transaction_id: upd.transaction_id })
          .eq("id", upd.id);
        if (error) throw error;
      }

      let summary = `Imported ${toInsert.length} new, updated ${toUpdate.length} existing`;
      if (skippedRows.length > 0) {
        const details = skippedRows.slice(0, 10).join("\n") + (skippedRows.length > 10 ? `\n...and ${skippedRows.length - 10} more` : "");
        setSendosoUploadError(`${summary}, but ${skippedRows.length} rows were skipped:\n${details}`);
      }
      toast.success(summary);
      fetchAllData();
    } catch (error: any) {
      console.error("Upload error:", error);
      const msg = error?.message || error?.details || "Unknown error";
      setSendosoUploadError(`Failed to upload Sendoso CSV: ${msg}`);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const toggleUserActive = async (profile: Profile) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !profile.is_active })
      .eq("id", profile.id);

    if (error) {
      toast.error("Failed to update user");
    } else {
      toast.success(`User ${profile.is_active ? "disabled" : "enabled"}`);
      fetchAllData();
    }
  };

  const toggleAdminRole = async (userId: string, currentRole: string) => {
    if (currentRole === "admin") {
      // Remove admin, keep technician
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");

      if (error) {
        toast.error("Failed to remove admin role");
      } else {
        toast.success("Admin role removed");
        fetchAllData();
      }
    } else {
      // Add admin role
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" as const });

      if (error) {
        toast.error("Failed to add admin role");
      } else {
        toast.success("Admin role added");
        fetchAllData();
      }
    }
  };


  if (authLoading || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Manage users and upload data</p>
            </div>
          </div>
          <Button variant="ghost" onClick={signOut}>Sign Out</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upload">
              <Upload className="mr-2 h-4 w-4" />
              Upload Data
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="mr-2 h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="tempo">
              <FileText className="mr-2 h-4 w-4" />
              TeMPO Records ({tempoTotal})
            </TabsTrigger>
            <TabsTrigger value="sendoso">
              <Gift className="mr-2 h-4 w-4" />
              Sendoso Records ({sendosoTotal})
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload">
            <p className="text-sm text-muted-foreground mb-4">
              <strong>Upload order:</strong> Upload TeMPO submissions first, then Sendoso rewards. Only Sendoso records matching a TeMPO technician email will appear on the dashboard.
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    1. Upload TeMPO CSV
                  </CardTitle>
                  <CardDescription>
                    Upload gift card records from TeMPO. Required columns: issued_to_email, amount, issued_at. Optional: status
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="tempo-csv">Select CSV File</Label>
                    <Input
                      id="tempo-csv"
                      type="file"
                      accept=".csv"
                      onChange={handleTempoUpload}
                      disabled={isUploading}
                    />
                  </div>
                  {tempoUploadError && (
                    <div className="rounded-md border border-destructive bg-destructive/10 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <pre className="whitespace-pre-wrap text-sm text-destructive flex-1">{tempoUploadError}</pre>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setTempoUploadError(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    2. Upload Sendoso CSV
                  </CardTitle>
                  <CardDescription>
                    Upload gift card fulfillment records from Sendoso. Required columns: recipient_email, egift_price, created_at. Optional: status, expiry_date, transaction_id. New records are added; existing matches (by transaction_id or email + date + amount) are updated.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="sendoso-csv">Select CSV File</Label>
                    <Input
                      id="sendoso-csv"
                      type="file"
                      accept=".csv"
                      onChange={handleSendosoUpload}
                      disabled={isUploading}
                    />
                  </div>
                  {sendosoUploadError && (
                    <div className="rounded-md border border-destructive bg-destructive/10 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <pre className="whitespace-pre-wrap text-sm text-destructive flex-1">{sendosoUploadError}</pre>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSendosoUploadError(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage user accounts and roles</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((profile) => {
                        const role = getUserRole(profile.user_id);
                        return (
                          <TableRow key={profile.id}>
                            <TableCell>{profile.full_name || "-"}</TableCell>
                            <TableCell>{profile.email}</TableCell>
                            <TableCell>
                              <Badge variant={role === "admin" ? "default" : "secondary"}>
                                {role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={profile.is_active ? "default" : "destructive"}>
                                {profile.is_active ? "Active" : "Disabled"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    startEmulation(profile.email);
                                    navigate("/dashboard");
                                  }}
                                >
                                  <Eye className="mr-1 h-3 w-3" />
                                  View As
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleAdminRole(profile.user_id, role)}
                                >
                                  <Shield className="mr-1 h-3 w-3" />
                                  {role === "admin" ? "Remove Admin" : "Make Admin"}
                                </Button>
                                <Button
                                  variant={profile.is_active ? "destructive" : "default"}
                                  size="sm"
                                  onClick={() => toggleUserActive(profile)}
                                >
                                  {profile.is_active ? "Disable" : "Enable"}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TeMPO Records Tab */}
          <TabsContent value="tempo">
            <Card>
              <CardHeader>
                <CardTitle>All TeMPO Submissions</CardTitle>
                <CardDescription>Complete list of upsell submissions</CardDescription>
                <div className="relative mt-2 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email..."
                    value={tempoSearchInput}
                    onChange={(e) => setTempoSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { setTempoSearch(tempoSearchInput); setTempoPage(0); } }}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {tempoLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : tempoRecords.length === 0 ? (
                  <p className="text-muted-foreground">No records found</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tempoRecords.map((submission) => (
                          <TableRow key={submission.id}>
                            <TableCell>{submission.technician_email}</TableCell>
                            <TableCell>{submission.technician_name}</TableCell>
                            <TableCell>${Number(submission.upsell_amount).toFixed(2)}</TableCell>
                            <TableCell>{format(new Date(submission.submission_date), "MMM d, yyyy")}</TableCell>
                            <TableCell>
                              <Badge className={getStatusStyles(submission.status)}>{submission.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing {tempoPage * PAGE_SIZE + 1}–{Math.min((tempoPage + 1) * PAGE_SIZE, tempoTotal)} of {tempoTotal}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={tempoPage === 0} onClick={() => setTempoPage(tempoPage - 1)}>
                          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                        </Button>
                        <Button variant="outline" size="sm" disabled={(tempoPage + 1) * PAGE_SIZE >= tempoTotal} onClick={() => setTempoPage(tempoPage + 1)}>
                          Next <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sendoso Records Tab */}
          <TabsContent value="sendoso">
            <Card>
              <CardHeader>
                <CardTitle>All Sendoso Records</CardTitle>
                <CardDescription>Complete list of gift card fulfillments</CardDescription>
                <div className="relative mt-2 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email..."
                    value={sendosoSearchInput}
                    onChange={(e) => setSendosoSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { setSendosoSearch(sendosoSearchInput); setSendosoPage(0); } }}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {sendosoLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : sendosoRecords.length === 0 ? (
                  <p className="text-muted-foreground">No records found</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Txn ID</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Expiry</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sendosoRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{record.transaction_id || "—"}</TableCell>
                            <TableCell>{record.technician_email}</TableCell>
                            <TableCell>{record.technician_name}</TableCell>
                            <TableCell>${Number(record.reward_amount).toFixed(2)}</TableCell>
                            <TableCell>{format(new Date(record.fulfillment_date), "MMM d, yyyy")}</TableCell>
                            <TableCell>{record.expiry_date ? format(new Date(record.expiry_date), "MMM d, yyyy") : "—"}</TableCell>
                            <TableCell>
                              <Badge className={getStatusStyles(record.status)}>{record.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Showing {sendosoPage * PAGE_SIZE + 1}–{Math.min((sendosoPage + 1) * PAGE_SIZE, sendosoTotal)} of {sendosoTotal}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={sendosoPage === 0} onClick={() => setSendosoPage(sendosoPage - 1)}>
                          <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                        </Button>
                        <Button variant="outline" size="sm" disabled={(sendosoPage + 1) * PAGE_SIZE >= sendosoTotal} onClick={() => setSendosoPage(sendosoPage + 1)}>
                          Next <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
