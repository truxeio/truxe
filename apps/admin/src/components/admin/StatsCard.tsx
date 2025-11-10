import React from 'react';
import { cn } from '../../lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus 
} from 'lucide-react';

export interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
    period?: string;
  };
  icon?: React.ComponentType<{ className?: string }>;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  loading?: boolean;
  className?: string;
}

export function StatsCard({
  title,
  value,
  change,
  icon: Icon,
  color = 'blue',
  loading = false,
  className
}: StatsCardProps) {
  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return 'bg-blue-500 text-white';
      case 'green':
        return 'bg-green-500 text-white';
      case 'yellow':
        return 'bg-yellow-500 text-white';
      case 'red':
        return 'bg-red-500 text-white';
      case 'purple':
        return 'bg-purple-500 text-white';
      case 'gray':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-blue-500 text-white';
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'increase':
        return <TrendingUp className="w-4 h-4" />;
      case 'decrease':
        return <TrendingDown className="w-4 h-4" />;
      case 'neutral':
        return <Minus className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getChangeColor = (type: string) => {
    switch (type) {
      case 'increase':
        return 'text-green-600';
      case 'decrease':
        return 'text-red-600';
      case 'neutral':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className={cn("bg-white rounded-lg shadow p-6", className)}>
        <div className="animate-pulse">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-gray-200 w-12 h-12"></div>
            <div className="ml-4 flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-6 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-white rounded-lg shadow p-6", className)}>
      <div className="flex items-center">
        {Icon && (
          <div className={cn("p-3 rounded-lg", getColorClasses(color))}>
            <Icon className="w-6 h-6" />
          </div>
        )}
        <div className={cn("flex-1", Icon && "ml-4")}>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <div className="flex items-center mt-1">
              <span
                className={cn(
                  "text-sm font-medium flex items-center",
                  getChangeColor(change.type)
                )}
              >
                {getChangeIcon(change.type)}
                <span className="ml-1">
                  {change.type === 'increase' && '+'}
                  {change.value}%
                </span>
              </span>
              {change.period && (
                <span className="text-sm text-gray-500 ml-1">
                  vs {change.period}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StatsCard;

