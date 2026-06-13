export function SkeletonNewsCard() {
  return (
    <div className="card" aria-hidden="true">
      <div className="skeleton h-3 w-16 mb-4" />
      <div className="skeleton h-4 w-full mb-2" />
      <div className="skeleton h-4 w-3/4 mb-6" />
      <div className="flex items-center justify-between">
        <div className="skeleton h-3 w-12" />
        <div className="skeleton h-4 w-4" />
      </div>
    </div>
  );
}

export function SkeletonJobCard() {
  return (
    <div className="card" aria-hidden="true">
      <div className="skeleton h-4 w-2/3 mb-2" />
      <div className="skeleton h-3 w-1/2 mb-6" />
      <div className="flex items-center justify-between">
        <div className="skeleton h-3 w-12" />
        <div className="skeleton h-8 w-16 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonCompanyCard() {
  return (
    <div className="card" aria-hidden="true">
      <div className="flex items-center justify-between mb-3">
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton h-3 w-1/2 mb-4" />
      <div className="flex gap-2">
        <div className="skeleton h-7 w-40 rounded-full" />
        <div className="skeleton h-7 w-32 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonWeather() {
  return (
    <div className="card weather-card" aria-hidden="true">
      <div className="flex-1">
        <div className="skeleton h-14 w-32 mb-4" />
        <div className="skeleton h-4 w-24" />
      </div>
      <div className="forecast-strip">
        {[0, 1, 2].map((i) => (
          <div key={i} className="forecast-day">
            <div className="skeleton h-3 w-10" />
            <div className="skeleton h-8 w-8 rounded-full" />
            <div className="skeleton h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
