import React from 'react';
import { cn } from '../../lib/utils';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Eye, EyeOff } from 'lucide-react';

export interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'textarea' | 'select';
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  helpText?: string;
  options?: Array<{ value: string; label: string }>;
  rows?: number;
  showPasswordToggle?: boolean;
  className?: string;
}

export function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  helpText,
  options = [],
  rows = 3,
  showPasswordToggle = false,
  className
}: FormFieldProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const newValue = type === 'number' ? Number(e.target.value) : e.target.value;
    onChange(newValue);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const getInputType = () => {
    if (type === 'password' && showPassword) {
      return 'text';
    }
    return type;
  };

  const renderInput = () => {
    switch (type) {
      case 'textarea':
        return (
          <textarea
            id={name}
            name={name}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            rows={rows}
            className={cn(
              "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm",
              error && "border-red-300 focus:border-red-500 focus:ring-red-500",
              disabled && "bg-gray-50 text-gray-500 cursor-not-allowed"
            )}
          />
        );

      case 'select':
        return (
          <select
            id={name}
            name={name}
            value={value}
            onChange={handleChange}
            required={required}
            disabled={disabled}
            className={cn(
              "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm",
              error && "border-red-300 focus:border-red-500 focus:ring-red-500",
              disabled && "bg-gray-50 text-gray-500 cursor-not-allowed"
            )}
          >
            <option value="">Select an option</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      default:
        return (
          <div className="relative">
            <Input
              id={name}
              name={name}
              type={getInputType()}
              value={value}
              onChange={handleChange}
              placeholder={placeholder}
              required={required}
              disabled={disabled}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className={cn(
                error && "border-red-300 focus:border-red-500 focus:ring-red-500"
              )}
            />
            {type === 'password' && showPasswordToggle && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={togglePasswordVisibility}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </Button>
            )}
          </div>
        );
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={name}
        className={cn(
          "block text-sm font-medium text-gray-700",
          required && "after:content-['*'] after:ml-0.5 after:text-red-500"
        )}
      >
        {label}
      </label>
      
      {renderInput()}
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      
      {helpText && !error && (
        <p className="text-sm text-gray-500">{helpText}</p>
      )}
    </div>
  );
}

export default FormField;

