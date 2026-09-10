import React from 'react';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { getSession } from '@/lib/auth';
import { hasDesktopPostDispatchReviewAccess } from '@/lib/post-dispatch-auth';
import DesktopPostDispatchReviewClient from './DesktopPostDispatchReviewClient';

export const metadata: Metadata = {
  title: 'Post-Dispatch Review | KAMNA ERP',
};

export default async function PostDispatchReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/staff');
  }

  // Check Post-Dispatch Review Access
  const canReview = hasDesktopPostDispatchReviewAccess(session);
  if (!canReview) {
    redirect('/unauthorized');
  }

  const { id } = await params;
  const isAdmin = session.role === 'ADMIN';

  // Verification permissions (Desktop only)
  const canVerifyReceiving =
    isAdmin ||
    Boolean(
      session.dispatch_view &&
      session.dispatch_post_dispatch &&
      session.dispatch_post_dispatch_receiving_verify
    );

  const canVerifyChecked =
    isAdmin ||
    Boolean(
      session.dispatch_view &&
      session.dispatch_post_dispatch &&
      session.dispatch_post_dispatch_checked_verify
    );

  const currentUserId = (session.userId as string) || (session.id as string);

  return (
    <DesktopPostDispatchReviewClient
      invoiceId={id}
      canVerifyReceiving={canVerifyReceiving}
      canVerifyChecked={canVerifyChecked}
      currentUserId={currentUserId}
    />
  );
}
