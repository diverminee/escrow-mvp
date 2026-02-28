interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export function Skeleton({ 
  className = "", 
  width = "100%", 
  height = "1rem",
  borderRadius = "4px"
}: SkeletonProps) {
  return (
    <div 
      className={`skeleton ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
      }}
    />
  );
}

// Preset skeleton components for common use cases
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          width={i === lines - 1 ? "70%" : "100%"} 
          height="0.875rem" 
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div 
      className={`card ${className}`}
      style={{ padding: "1.5rem" }}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton width={48} height={48} borderRadius="8px" />
          <div className="flex-1 space-y-2">
            <Skeleton width="60%" height="1rem" />
            <Skeleton width="40%" height="0.75rem" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Skeleton height="3rem" />
          <Skeleton height="3rem" />
          <Skeleton height="3rem" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`table-container ${className}`}>
      <table className="table">
        <thead>
          <tr>
            <th><Skeleton width={60} /></th>
            <th><Skeleton width={80} /></th>
            <th><Skeleton width={100} /></th>
            <th><Skeleton width={80} /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td><Skeleton width={50} height="1.5rem" /></td>
              <td><Skeleton width={70} height="1.5rem" /></td>
              <td><Skeleton width={120} height="1.5rem" /></td>
              <td><Skeleton width={90} height="1.5rem" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
