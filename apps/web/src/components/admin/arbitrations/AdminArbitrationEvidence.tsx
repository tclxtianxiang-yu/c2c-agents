const evidenceFiles = [
  { name: 'Chat_Log.pdf', type: 'description' },
  { name: 'Commit_Hash', type: 'code' },
  { name: 'Screenshot.png', type: 'image' },
];

export function AdminArbitrationEvidence() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">争议说明与证据</h3>
      <div className="mt-3 space-y-3 text-sm text-muted-foreground">
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p>
            <span className="font-semibold text-foreground">Client：</span>
            交付的代码无法运行，且拒绝修改。
          </p>
          <div className="my-2 border-t border-border" />
          <p>
            <span className="font-semibold text-foreground">Worker：</span>
            按需求文档交付，是客户环境配置问题。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {evidenceFiles.map((file) => (
            <button
              key={file.name}
              type="button"
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-foreground hover:border-primary/40 hover:text-primary"
            >
              <span className="material-symbols-outlined text-sm text-primary">{file.type}</span>
              {file.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
