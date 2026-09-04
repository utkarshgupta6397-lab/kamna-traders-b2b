import React from 'react';
import PreDispatchWorkflowClient from './PreDispatchWorkflowClient';

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PreDispatchWorkflowClient id={id} />;
}
