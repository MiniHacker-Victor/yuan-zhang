import { convertFromBaseMinor, formatBaseMinor, formatOriginalAmount } from '../lib/money';
import { BASE_CURRENCY, type CurrencyCode, type TrendPoint } from '../types';

interface TrendChartProps {
  points: TrendPoint[];
  currency?: CurrencyCode;
  rateToBaseScaled?: number;
}

export default function TrendChart({ points, currency = BASE_CURRENCY, rateToBaseScaled = 1 }: TrendChartProps) {
  const convertPoint = (value: number) => convertFromBaseMinor(value, currency, rateToBaseScaled) ?? 0;
  const max = Math.max(...points.map((point) => convertPoint(point.totalBaseMinor)), 1);
  const dense = points.length > 12;

  return (
    <div className={dense ? 'trend-chart dense' : 'trend-chart'} role="img" aria-label="消费趋势柱状图">
      {points.map((point, index) => {
        const converted = convertPoint(point.totalBaseMinor);
        const height = converted === 0 ? 2 : Math.max(5, converted / max * 100);
        const showLabel = !dense || index === 0 || index === points.length - 1 || index % 5 === 0;
        return (
          <div className="trend-column" key={point.key} title={`${point.label}: ${currency === BASE_CURRENCY ? formatBaseMinor(point.totalBaseMinor) : formatOriginalAmount(converted, currency)}`}>
            <div className="trend-track">
              <div className="trend-bar" style={{ height: `${height}%` }} />
            </div>
            <span className={showLabel ? '' : 'label-hidden'}>{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}
