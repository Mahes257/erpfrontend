import { useSearchParams } from 'react-router-dom';
import { FollowUpForm } from '../components/FollowUpForm';

export default function AddFollowUp() {
  const [searchParams] = useSearchParams();
  const preselectedLeadId = searchParams.get('leadId') ? Number(searchParams.get('leadId')) : undefined;

  return (
    <div className="flex-1 bg-app font-sans antialiased text-slate-800 p-4 sm:p-6 w-full max-w-[100vw] overflow-x-hidden">
      <FollowUpForm preselectedLeadId={preselectedLeadId} />
    </div>
  );
}
