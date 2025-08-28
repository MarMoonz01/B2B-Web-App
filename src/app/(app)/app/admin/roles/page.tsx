"use client";

import React, { useState, useEffect } from 'react';
import { toast } from "sonner";
import { PlusCircle, Edit, Trash2, Shield, Check, ChevronsUpDown } from 'lucide-react';

import { PERMISSIONS, Permission } from '@/types/permission';
import { PERMISSION_LABELS } from '@/types/permission-lables'; // <-- 1. Import ป้ายกำกับใหม่
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';


// Type Definitions
interface Branch {
  id: string;
  branchName: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  scope?: 'global' | 'specific';
  applicableBranches?: string[];
}


// --- Role Management Component ---
export default function RolesManagementPage() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);

    const fetchRoles = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/roles');
            const data = await res.json();
            if (data.ok) {
                setRoles(data.roles);
            } else {
                toast.error("Failed to fetch roles.");
            }
        } catch (error) {
            toast.error("An error occurred while fetching roles.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const handleSave = () => {
        fetchRoles();
        setIsDialogOpen(false);
        setEditingRole(null);
    };
    
    const handleDelete = async (roleId: string) => {
        try {
            const res = await fetch(`/api/admin/roles/${roleId}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success("Role deleted successfully.");
                fetchRoles();
            } else {
                toast.error("Failed to delete role.");
            }
        } catch (error) {
            toast.error("An error occurred while deleting the role.");
        }
    };

    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Roles & Permissions</h1>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={() => setEditingRole(null)}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add New Role
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[625px]">
                        <RoleForm role={editingRole} onSave={handleSave} />
                    </DialogContent>
                </Dialog>
            </div>
            {isLoading ? (
                <RoleListSkeleton />
            ) : (
                <div className="space-y-4">
                    {roles.map(role => (
                        <Card key={role.id}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 flex-wrap">
                                            <Shield className="text-primary" /> 
                                            {role.name}
                                            <Badge variant={role.scope === 'global' ? 'secondary' : 'default'}>
                                                {role.scope === 'global' ? 'Global' : 'Specific'}
                                            </Badge>
                                        </CardTitle>
                                        <CardDescription className="mt-1">{role.description}</CardDescription>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <Button variant="outline" size="icon" onClick={() => { setEditingRole(role); setIsDialogOpen(true); }}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive" size="icon">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This action cannot be undone. This will permanently delete the role.
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
                                <h4 className="font-semibold mb-2">Permissions:</h4>
                                <div className="flex flex-wrap gap-2">
                                    {role.permissions.length > 0 ? 
                                     role.permissions.map(p => (
                                        <Badge key={p} variant="outline">
                                            {PERMISSION_LABELS[p]?.name || p}
                                        </Badge>
                                     )) :
                                     <span className="text-sm text-muted-foreground">No permissions assigned.</span>}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

// --- Role Form Component ---
function RoleForm({ role, onSave }: { role: Role | null, onSave: () => void }) {
    const [name, setName] = useState(role?.name || '');
    const [description, setDescription] = useState(role?.description || '');
    const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>(role?.permissions || []);
    
    const [scope, setScope] = useState<'global' | 'specific'>(
        (role && Array.isArray(role.applicableBranches) && role.applicableBranches.length > 0) ? 'specific' : 'global'
    );
    const [applicableBranches, setApplicableBranches] = useState<string[]>(role?.applicableBranches || []);
    const [allBranches, setAllBranches] = useState<Branch[]>([]);
    const [openBranchSelector, setOpenBranchSelector] = useState(false);
    
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        async function fetchBranches() {
            try {
                const res = await fetch('/api/admin/branches'); 
                const data = await res.json();
                if (data.ok) {
                    setAllBranches(data.branches.map((b: string) => ({ id: b, branchName: b })));
                }
            } catch (error) {
                console.error("Failed to fetch branches", error);
                toast.error("Could not load branch list.");
            }
        }
        fetchBranches();
    }, []);

    const handlePermissionChange = (permission: Permission, checked: boolean) => {
        setSelectedPermissions(prev =>
            checked ? [...prev, permission] : prev.filter(p => p !== permission)
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        const url = role ? `/api/admin/roles/${role.id}` : '/api/admin/roles';
        const method = role ? 'PUT' : 'POST';

        const payload = {
            name,
            description,
            permissions: selectedPermissions,
            scope,
            applicableBranches: scope === 'specific' ? applicableBranches : [],
        };

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                toast.success(`Role ${role ? 'updated' : 'created'} successfully.`);
                onSave();
            } else {
                toast.error(`Failed to ${role ? 'update' : 'create'} role.`);
            }
        } catch (error) {
            toast.error("An error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedBranchNames = applicableBranches
        .map(id => allBranches.find(b => b.id === id)?.branchName || id)
        .filter(Boolean)
        .join(', ');

    return (
        <form onSubmit={handleSubmit}>
            <DialogHeader>
                <DialogTitle>{role ? 'Edit Role' : 'Create New Role'}</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <Input placeholder="Role Name" value={name} onChange={e => setName(e.target.value)} required />
                <Textarea placeholder="Role Description" value={description} onChange={e => setDescription(e.target.value)} required />
                
                <div className="space-y-2">
                    <h3 className="font-semibold text-sm">Role Scope</h3>
                    <RadioGroup value={scope} onValueChange={(value) => setScope(value as any)} className="flex gap-4">
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="global" id="r1" />
                            <label htmlFor="r1">Global</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="specific" id="r2" />
                            <label htmlFor="r2">Specific Branches</label>
                        </div>
                    </RadioGroup>
                </div>

                {scope === 'specific' && (
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm">Applicable Branches</h3>
                        <Popover open={openBranchSelector} onOpenChange={setOpenBranchSelector}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openBranchSelector}
                                    className="w-full justify-between font-normal"
                                >
                                    <span className="truncate">
                                        {applicableBranches.length > 0 ? selectedBranchNames : "Select branches..."}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0">
                                <Command>
                                    <CommandInput placeholder="Search branch..." />
                                    <CommandList>
                                        <CommandEmpty>No branches found.</CommandEmpty>
                                        <CommandGroup>
                                            {allBranches.map((branch) => (
                                                <CommandItem
                                                    key={branch.id}
                                                    value={branch.branchName}
                                                    onSelect={() => {
                                                        setApplicableBranches(prev => 
                                                            prev.includes(branch.id)
                                                                ? prev.filter(id => id !== branch.id)
                                                                : [...prev, branch.id]
                                                        );
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            applicableBranches.includes(branch.id) ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {branch.branchName}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                )}
                
                <h3 className="font-semibold text-sm">Permissions</h3>
                <TooltipProvider>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 max-h-64 overflow-y-auto p-2 border rounded-md">
                        {PERMISSIONS.map(p => (
                            <Tooltip key={p} delayDuration={100}>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id={p}
                                            checked={selectedPermissions.includes(p)}
                                            onCheckedChange={(checked) => handlePermissionChange(p, !!checked)}
                                        />
                                        <label htmlFor={p} className="text-sm font-medium cursor-pointer">
                                            {PERMISSION_LABELS[p].name}
                                        </label>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{PERMISSION_LABELS[p].description}</p>
                                </TooltipContent>
                            </Tooltip>
                        ))}
                    </div>
                </TooltipProvider>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="ghost" onClick={onSave}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save Role'}
                </Button>
            </div>
        </form>
    );
}

// --- Skeleton Loader ---
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