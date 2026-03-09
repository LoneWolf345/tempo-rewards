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
import { ArrowLeft, Upload, Users, FileText, Gift, Trash2, Shield } from "lucide-react";
import { format } from "date-fns";

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
}

export default function Admin() {
  const { isAdmin, isLoading: authLoading, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [tempoSubmissions, setTempoSubmissions] = useState<TempoSubmission[]>([]);
  const [sendosoRecords, setSendosoRecords] = useState<SendosoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/dashboard");
    }
  }, [authLoading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchAllData();
    }
  }, [isAdmin]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const [profilesRes, rolesRes, tempoRes, sendosoRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("*"),
        supabase.from("tempo_submissions").select("*").order("submission_date", { ascending: false }),
        supabase.from("sendoso_records").select("*").order("fulfillment_date", { ascending: false }),
      ]);

      if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
      if (rolesRes.data) setUserRoles(rolesRes.data as UserRole[]);
      if (tempoRes.data) setTempoSubmissions(tempoRes.data as TempoSubmission[]);
      if (sendosoRes.data) setSendosoRecords(sendosoRes.data as SendosoRecord[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const getUserRole = (userId: string) => {
    return userRoles.find((r) => r.user_id === userId)?.role || "technician";
  };

  const handleTempoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      const emailIdx = headers.findIndex((h) => h.includes("email"));
      const nameIdx = headers.findIndex((h) => h.includes("name"));
      const amountIdx = headers.findIndex((h) => h.includes("amount"));
      const dateIdx = headers.findIndex((h) => h.includes("date"));
      const statusIdx = headers.findIndex((h) => h.includes("status"));

      if (emailIdx === -1 || amountIdx === -1 || dateIdx === -1) {
        toast.error("CSV must contain email, amount, and date columns");
        return;
      }

      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
        if (values.length < Math.max(emailIdx, amountIdx, dateIdx) + 1) continue;

        records.push({
          technician_email: values[emailIdx],
          technician_name: nameIdx >= 0 ? values[nameIdx] : "",
          upsell_amount: parseFloat(values[amountIdx]) || 0,
          submission_date: values[dateIdx],
          status: statusIdx >= 0 ? values[statusIdx] : "submitted",
          uploaded_by: user.id,
        });
      }

      const { error } = await supabase.from("tempo_submissions").insert(records);

      if (error) throw error;

      toast.success(`Uploaded ${records.length} TeMPO records`);
      fetchAllData();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload CSV");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleSendosoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());
      
      // Auto-detect delimiter (tab or comma)
      const firstLine = lines[0];
      const delimiter = firstLine.includes("\t") ? "\t" : ",";
      
      const headers = firstLine.split(delimiter).map((h) => h.trim().toLowerCase());

      // Map Sendoso columns: recipient_email, status, created_at, egift_price
      const emailIdx = headers.findIndex((h) => h.includes("recipient_email") || h.includes("email"));
      const statusIdx = headers.findIndex((h) => h === "status");
      const dateIdx = headers.findIndex((h) => h.includes("created_at") || h.includes("date"));
      const amountIdx = headers.findIndex((h) => h.includes("egift_price") || h.includes("amount"));

      if (emailIdx === -1 || amountIdx === -1 || dateIdx === -1) {
        toast.error("CSV must contain recipient_email, egift_price, and created_at columns");
        return;
      }

      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(delimiter).map((v) => v.trim().replace(/"/g, ""));
        if (values.length < Math.max(emailIdx, amountIdx, dateIdx) + 1) continue;

        // Parse datetime format "2026-02-27 20:21:49 UTC" to date "2026-02-27"
        let dateValue = values[dateIdx];
        if (dateValue.includes(" ")) {
          dateValue = dateValue.split(" ")[0]; // Extract just the date part
        }

        records.push({
          technician_email: values[emailIdx],
          technician_name: null,
          reward_amount: parseFloat(values[amountIdx]) || 0,
          fulfillment_date: dateValue,
          status: statusIdx >= 0 ? values[statusIdx] : "fulfilled",
          uploaded_by: user.id,
        });
      }

      const { error } = await supabase.from("sendoso_records").insert(records);

      if (error) throw error;

      toast.success(`Uploaded ${records.length} Sendoso records`);
      fetchAllData();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload CSV");
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

  const clearTempoRecords = async () => {
    if (!confirm("Are you sure you want to delete all TeMPO records?")) return;

    const { error } = await supabase.from("tempo_submissions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    
    if (error) {
      toast.error("Failed to clear records");
    } else {
      toast.success("TeMPO records cleared");
      fetchAllData();
    }
  };

  const clearSendosoRecords = async () => {
    if (!confirm("Are you sure you want to delete all Sendoso records?")) return;

    const { error } = await supabase.from("sendoso_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    
    if (error) {
      toast.error("Failed to clear records");
    } else {
      toast.success("Sendoso records cleared");
      fetchAllData();
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
              TeMPO Records ({tempoSubmissions.length})
            </TabsTrigger>
            <TabsTrigger value="sendoso">
              <Gift className="mr-2 h-4 w-4" />
              Sendoso Records ({sendosoRecords.length})
            </TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Upload TeMPO CSV
                  </CardTitle>
                  <CardDescription>
                    Upload upsell submissions from TeMPO. CSV should have columns: email, name, amount, date, status
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
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={clearTempoRecords}
                    disabled={tempoSubmissions.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All TeMPO Records
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="h-5 w-5" />
                    Upload Sendoso CSV
                  </CardTitle>
                  <CardDescription>
                    Upload gift card fulfillment records from Sendoso. Required columns: recipient_email, egift_price, created_at. Optional: status
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
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={clearSendosoRecords}
                    disabled={sendosoRecords.length === 0}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All Sendoso Records
                  </Button>
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
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : tempoSubmissions.length === 0 ? (
                  <p className="text-muted-foreground">No records uploaded yet</p>
                ) : (
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
                      {tempoSubmissions.map((submission) => (
                        <TableRow key={submission.id}>
                          <TableCell>{submission.technician_email}</TableCell>
                          <TableCell>{submission.technician_name}</TableCell>
                          <TableCell>${Number(submission.upsell_amount).toFixed(2)}</TableCell>
                          <TableCell>{format(new Date(submission.submission_date), "MMM d, yyyy")}</TableCell>
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
          </TabsContent>

          {/* Sendoso Records Tab */}
          <TabsContent value="sendoso">
            <Card>
              <CardHeader>
                <CardTitle>All Sendoso Records</CardTitle>
                <CardDescription>Complete list of gift card fulfillments</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : sendosoRecords.length === 0 ? (
                  <p className="text-muted-foreground">No records uploaded yet</p>
                ) : (
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
                      {sendosoRecords.map((record) => {
                        const getStatusStyles = (status: string) => {
                          const s = status.toLowerCase();
                          if (s === "used") return "bg-green-600 text-white border-transparent";
                          if (s === "sent") return "bg-sky-400 text-white border-transparent";
                          if (s === "clicked") return "bg-blue-700 text-white border-transparent";
                          if (s === "expired" || s === "credited") return "bg-amber-500 text-white border-transparent";
                          return "";
                        };
                        return (
                          <TableRow key={record.id}>
                            <TableCell>{record.technician_email}</TableCell>
                            <TableCell>{record.technician_name}</TableCell>
                            <TableCell>${Number(record.reward_amount).toFixed(2)}</TableCell>
                            <TableCell>{format(new Date(record.fulfillment_date), "MMM d, yyyy")}</TableCell>
                            <TableCell>
                              <Badge className={getStatusStyles(record.status)}>{record.status}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
