// src/lib/services/adminUsers.ts
export async function assignRoleToUser(userId: string, branchId: string, roleId: string) {
  const res = await fetch(`/api/admin/users/${userId}/roles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchId, roleId }),
  });
  if (!res.ok) throw new Error((await res.json())?.error ?? 'assign_failed');
  return res.json();
}

export async function removeRoleFromUser(userId: string, branchId: string, roleId: string) {
  const res = await fetch(`/api/admin/users/${userId}/roles`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branchId, roleId }),
  });
  if (!res.ok) throw new Error((await res.json())?.error ?? 'remove_failed');
  return res.json();
}
