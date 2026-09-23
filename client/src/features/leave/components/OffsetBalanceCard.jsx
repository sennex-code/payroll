export default function OffsetBalanceCard({ offsetBalance }) {
  return (
    <div className="overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50 shadow-sm">
      <div className="border-b border-indigo-200 px-4 py-3">
        <h3 className="m-0 text-sm font-bold text-indigo-900">
          Monthly Offset Balance
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 text-sm md:grid-cols-4">
        <div className="rounded-lg border border-indigo-50 bg-white p-2.5 text-center shadow-sm">
          <p className="mb-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-indigo-600">
            Working Days
          </p>
          <p className="text-lg font-black text-indigo-900">
            {Number(offsetBalance.workingDaysCompleted || 0).toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg border border-indigo-50 bg-white p-2.5 text-center shadow-sm">
          <p className="mb-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-indigo-600">
            Baseline
          </p>
          <p className="text-lg font-black text-indigo-900">
            {offsetBalance.baselineDays || 22}
          </p>
        </div>
        <div className="rounded-lg border border-indigo-50 bg-white p-2.5 text-center shadow-sm">
          <p className="mb-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-green-600">
            Earned Offsets
          </p>
          <p className="text-lg font-black text-green-700">
            +{Number(offsetBalance.offsetEarned || 0).toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-indigo-50 bg-white p-2.5 text-center shadow-sm">
          <p className="mb-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-purple-600">
            End Balance
          </p>
          <p className="text-lg font-black text-purple-700">
            {Number(offsetBalance.finalBalance || 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
