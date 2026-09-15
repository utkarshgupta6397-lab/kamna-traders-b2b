import { redirect } from 'next/navigation';

export default function HrIndexPage() {
  redirect('/staff/dashboard/hr/attendance-processor');
}
