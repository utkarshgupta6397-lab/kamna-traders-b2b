import { prisma } from '@/lib/db';
import { createUser, updateUser, deleteUser } from '../actions';
import UsersClient from './UsersClient';

export const metadata = {
  title: 'Users | Kamna ERP',
};

export default async function UsersPage() {
  // Fetch ALL users for frontend filtering/pagination
  // No server-side take/skip limitation
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <UsersClient 
      users={users}
      createUserAction={createUser}
      updateUserAction={updateUser}
      deleteUserAction={deleteUser}
    />
  );
}
