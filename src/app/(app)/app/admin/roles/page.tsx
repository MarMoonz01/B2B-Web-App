"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { PlusCircle, Edit, Trash2, Shield } from "lucide-react";

import { PERMISSIONS, type Permission, type Role } from "types/permissions";
import { PERMISSION_LABELS } from "@/types/permission-labels";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function RolesManagementPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const fetchRoles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/roles", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setRoles(Array.isArray(data.roles) ? data.roles : []);
      } else {
        toast.error(data?.error || "Failed to fetch roles.");
      }
    } catch (e) {
      toast.error("An error occurred while fetching roles.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const handleSave = () => {
    fetchRoles();
    setIsDialogOpen(false);
    setEditingRole(null);
  };

  const handleDelete = async (roleId: string) => {
    try {
      const res = await fetch(`/api/admin/roles/${roleId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok !== false) {
        toast.success("Role deleted successfully.");
        fetchRoles();
      } else {
        toast.error(data?.error || "Failed to delete role.");
      }
    } catch {
      toast.error("An error occurred while deleting the role.");
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Roles & Permissions</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => { setEditingRole(null); setIsDialogOpen(true); }}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Role
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[640px]">
            <RoleForm
              role={editingRole}
              onSave={handleSave}
              onClose={() => { setIsDialogOpen(false); setEditingRole(null); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <RoleListSkeleton />
      ) : (
        <div className="space-y-4">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 flex-wrap">
                      <Shield className="text-primary" />
                      <span className="truncate">{role.name}</span>
                    </CardTitle>
                    <CardDescription className="mt-1 break-words">
                      {role.description}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => { setEditingRole(role); setIsDialogOpen(true); }}
                      aria-label="Edit role"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" aria-label="Delete role">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete role?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. The role will be permanently deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(role.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <h4 className="font-semibold mb-2">Permissions</h4>
                <div className="flex flex-wrap gap-2">
                  {role.permissions?.length ? (
                    role.permissions.map((p) => (
                      <Badge key={p} variant="outline">
                        {PERMISSION_LABELS[p]?.name || p}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No permissions assigned.</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RoleForm({
  role,
  onSave,
  onClose,
}: {
  role: Role | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(role?.name || "");
  const [description, setDescription] = useState(role?.description || "");
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(
    role?.permissions || []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // รีเซ็ตค่าฟอร์มเมื่อเปลี่ยน role (create ↔ edit)
  useEffect(() => {
    setName(role?.name || "");
    setDescription(role?.description || "");
    setSelectedPermissions(role?.permissions || []);
  }, [role]);

  const handlePermissionChange = (permission: Permission, checked: boolean) => {
    setSelectedPermissions((prev) => {
      if (checked) {
        if (prev.includes(permission)) return prev;
        return [...prev, permission];
      }
      return prev.filter((p) => p !== permission);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const url = role ? `/api/admin/roles/${role.id}` : "/api/admin/roles";
    const method = role ? "PATCH" : "POST";
    // จัดระเบียบ permission: sort เพื่อความเสถียร (ช่วยลด diff)
    const payload = {
      name: name.trim(),
      description: description.trim(),
      permissions: [...new Set(selectedPermissions)].sort(),
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `${role ? "Update" : "Create"} failed (${res.status})`);
      }

      toast.success(`Role ${role ? "updated" : "created"} successfully.`);
      onSave();
    } catch (err: any) {
      toast.error(err?.message ?? "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{role ? "Edit Role" : "Create New Role"}</DialogTitle>
      </DialogHeader>

      <div className="py-4 space-y-4">
        <Input
          placeholder="Role Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
        />
        <Textarea
          placeholder="Role Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
        />

        <h3 className="font-semibold text-sm">Permissions</h3>
        <TooltipProvider>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-h-64 overflow-y-auto p-2 border rounded-md">
            {PERMISSIONS.map((p) => (
              <Tooltip key={p} delayDuration={100}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={p}
                      checked={selectedPermissions.includes(p)}
                      onCheckedChange={(checked) => handlePermissionChange(p, !!checked)}
                      disabled={isSubmitting}
                    />
                    <label htmlFor={p} className="text-sm font-medium cursor-pointer">
                      {PERMISSION_LABELS[p]?.name || p}
                    </label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">{PERMISSION_LABELS[p]?.description || p}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Role"}
        </Button>
      </div>
    </form>
  );
}

function RoleListSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-10" />
                <Skeleton className="h-10 w-10" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-5 w-32 mb-2" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-28" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
