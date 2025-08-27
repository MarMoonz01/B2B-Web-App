import React from 'react';
import UsersManagementClient from '@/src/app/(app)/app/admin/users/UsersManagementClient';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function UsersPage() {
  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Create new users and view existing users in the system.
          </CardDescription>
        </CardHeader>
      </Card>
      <UsersManagementClient />
    </div>
  );
}
