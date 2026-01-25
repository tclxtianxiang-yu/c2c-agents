const filters = ['仲裁中', '待复核', '已处理'];

export function AdminArbitrationsFilters() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          search
        </span>
        <input
          className="w-full rounded-lg border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
          placeholder="搜索订单号、任务标题或钱包地址..."
          type="text"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
        {filters.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold ${
              index === 0
                ? 'border border-primary/40 bg-primary/10 text-primary'
                : 'border border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
