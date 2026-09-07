import StatementHeader from './StatementHeader';
import MobileCustomerStatementSkeleton from './MobileCustomerStatementSkeleton';

export default function CustomerStatementLoading() {
  return (
    <div className="flex-1 flex flex-col font-sans min-h-0 bg-[#F8F9FB]">
      <StatementHeader />
      <main className="flex-1 flex flex-col min-h-0 w-full relative max-w-[430px] mx-auto overflow-y-auto">
        <MobileCustomerStatementSkeleton />
      </main>
    </div>
  );
}
