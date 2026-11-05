interface BudgetRingProps {
  usage: number | null;
  status: 'normal' | 'warning' | 'over' | 'unset';
  size?: number;
}

export default function BudgetRing({ usage, status, size = 116 }: BudgetRingProps) {
  const clamped = Math.min(usage ?? 0, 1);
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const color = status === 'over' ? '#d1495b' : status === 'warning' ? '#e09f3e' : '#2a9d8f';

  return (
    <div className="budget-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e7ece9" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={status === 'unset' ? circumference : offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="budget-ring-label">
        <strong>{status === 'unset' ? '未设置' : `${Math.round((usage ?? 0) * 100)}%`}</strong>
        <span>预算使用</span>
      </div>
    </div>
  );
}
