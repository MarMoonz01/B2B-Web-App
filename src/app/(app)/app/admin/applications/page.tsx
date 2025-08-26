'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, DocumentData, Timestamp } from 'firebase/firestore';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Check, X, FileText, Loader2 } from 'lucide-react';

interface Application extends DocumentData {
  id: string;
  branchName: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Timestamp;
  notes?: string;
  inventoryData?: any;
}

export default function AdminApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplications = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'branchApplications'), where('status', '==', 'pending'));
        const querySnapshot = await getDocs(q);
        const apps = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Application));
        setApplications(apps);
      } catch (error) {
        console.error("Error fetching applications: ", error);
        toast.error('Failed to load applications.');
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  const handleApprove = async (applicationId: string) => {
    setProcessingId(applicationId);
    const promise = fetch('/api/admin/applications/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId }),
    }).then(async (res) => {
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Approval failed');
        }
        return res.json();
    });

    toast.promise(promise, {
        loading: 'Approving application...',
        success: (data) => {
            setApplications(prev => prev.filter(app => app.id !== applicationId));
            return `Application approved! Store ID: ${data.storeId}`;
        },
        error: (err) => err.message,
        finally: () => setProcessingId(null),
    });
  };

  const handleReject = async (applicationId: string) => {
    setProcessingId(applicationId);
    const reason = prompt("Please provide a reason for rejection (optional):");
    try {
        const appRef = doc(db, 'branchApplications', applicationId);
        await updateDoc(appRef, {
            status: 'rejected',
            reason: reason || 'No reason provided.',
            processedAt: new Date(),
        });
        setApplications(prev => prev.filter(app => app.id !== applicationId));
        toast.success('Application has been rejected.');
    } catch (error) {
        console.error("Error rejecting application: ", error);
        toast.error('Failed to reject application.');
    } finally {
        setProcessingId(null);
    }
  };

  if (loading) {
    return (
        <div className="space-y-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                    <Card key={i}>
                        <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                        <CardContent className="space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </CardContent>
                        <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Branch Applications</h1>
      <p className="text-muted-foreground">Review and process new applications to join the network.</p>
      
      {applications.length === 0 ? (
        <Alert>
            <Check className="h-4 w-4" />
            <AlertTitle>All caught up!</AlertTitle>
            <AlertDescription>
                There are no pending applications at the moment.
            </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    {app.branchName}
                    <Badge variant="outline">Pending</Badge>
                </CardTitle>
                <CardDescription>{app.email}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p><strong>Submitted:</strong> {app.submittedAt.toDate().toLocaleString()}</p>
                {app.notes && <p className="text-muted-foreground"><strong>Notes:</strong> {app.notes}</p>}
                {app.inventoryData && (
                    <div className="flex items-center gap-2 text-blue-600">
                        <FileText className="h-4 w-4" />
                        <span>Includes inventory data ({app.inventoryData.rows.length} rows)</span>
                    </div>
                )}
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button 
                    className="w-full gap-2" 
                    onClick={() => handleApprove(app.id)}
                    disabled={processingId === app.id}
                >
                    {processingId === app.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Approve
                </Button>
                <Button 
                    variant="destructive" 
                    className="w-full gap-2" 
                    onClick={() => handleReject(app.id)}
                    disabled={processingId === app.id}
                >
                    {processingId === app.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    Reject
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
