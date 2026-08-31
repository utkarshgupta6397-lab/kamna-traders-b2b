import { redirect } from 'next/navigation';

export default function DispatchRootPage() {
  redirect('/staff/dashboard/dispatch/incoming');
}
