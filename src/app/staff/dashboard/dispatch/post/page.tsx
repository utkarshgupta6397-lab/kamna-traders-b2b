import { redirect } from 'next/navigation';

export default function PostDispatchRootPage() {
  redirect('/staff/dashboard/dispatch/incoming');
}
