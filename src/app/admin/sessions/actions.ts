'use server';

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { cleanupStaleSessions } from '@/lib/session';

/**
 * Revokes a specific session by its token.
 */
export async function revokeSession(formData: FormData) {
  const sessionToken = formData.get('sessionToken') as string;
  if (!sessionToken) return { error: 'Session token required' };

  try {
    await prisma.activeSession.delete({
      where: { sessionToken },
    });
    revalidatePath('/admin/sessions');
    return { success: true };
  } catch (error) {
    console.error('[Admin] Failed to revoke session:', error);
    return { error: 'Failed to revoke session' };
  }
}

/**
 * Manually trigger cleanup of stale sessions.
 */
export async function clearStaleSessions() {
  try {
    await cleanupStaleSessions();
    revalidatePath('/admin/sessions');
    return { success: true };
  } catch (error) {
    console.error('[Admin] Failed to cleanup sessions:', error);
    return { error: 'Cleanup failed' };
  }
}
