interface LiveCounterProps {
  type: "tubs" | "warranty";
  tubCount?: number | null;
  baseline?: number;
  lastClaimDate?: string | null;
}

function LiveCounter({
  type,
  tubCount,
  baseline = 11000,
  lastClaimDate,
}: LiveCounterProps) {
  if (type === "tubs") {
    if (tubCount && tubCount > 0) {
      return <span>{tubCount.toLocaleString()} tubs refinished and counting</span>;
    }
    return <span>{baseline.toLocaleString()}+ tubs refinished</span>;
  }

  // type === "warranty"
  if (!lastClaimDate) {
    return (
      <span>
        Lifetime warranty against peeling — backed by every tub we've finished.
      </span>
    );
  }

  const daysSinceClaim = Math.floor(
    (Date.now() - new Date(lastClaimDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceClaim < 90) {
    return (
      <span>
        Lifetime warranty against peeling — backed by every tub we've finished.
      </span>
    );
  }

  const label =
    daysSinceClaim >= 365
      ? `OVER ${Math.floor(daysSinceClaim / 365)} YEARS SINCE OUR LAST GOLD PACKAGE WARRANTY CLAIM`
      : "DAYS SINCE OUR LAST GOLD PACKAGE WARRANTY CLAIM";

  const value =
    daysSinceClaim >= 365
      ? daysSinceClaim.toLocaleString()
      : String(daysSinceClaim);

  return (
    <div className="text-center">
      <div className="uppercase text-xs tracking-wider">{label}</div>
      <div className="text-4xl font-bold">{value}</div>
    </div>
  );
}

export default LiveCounter;
