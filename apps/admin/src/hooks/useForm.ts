import { useState, useCallback, useRef } from 'react';
import type { FieldConfig, FormState, ValidationRule } from '../types';
import { formatErrorMessage } from '../lib/utils';

/**
 * Custom hook for form management with validation
 */
export function useForm<T extends Record<string, any>>(
  initialValues: T,
  fieldConfigs: FieldConfig[] = []
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Validation functions
  const validateField = useCallback((name: keyof T, value: any): string | null => {
    const config = fieldConfigs.find(config => config.name === name);
    if (!config?.validation) return null;

    const { required, minLength, maxLength, pattern, custom } = config.validation;

    // Required validation
    if (required && (!value || (typeof value === 'string' && !value.trim()))) {
      return `${config.label} is required`;
    }

    // Skip other validations if field is empty and not required
    if (!value || (typeof value === 'string' && !value.trim())) {
      return null;
    }

    // Min length validation
    if (minLength && typeof value === 'string' && value.length < minLength) {
      return `${config.label} must be at least ${minLength} characters`;
    }

    // Max length validation
    if (maxLength && typeof value === 'string' && value.length > maxLength) {
      return `${config.label} must be no more than ${maxLength} characters`;
    }

    // Pattern validation
    if (pattern && typeof value === 'string' && !pattern.test(value)) {
      return `${config.label} format is invalid`;
    }

    // Custom validation
    if (custom && typeof value === 'string') {
      return custom(value);
    }

    return null;
  }, [fieldConfigs]);

  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    Object.keys(values).forEach(key => {
      const fieldKey = key as keyof T;
      const error = validateField(fieldKey, values[fieldKey]);
      if (error) {
        newErrors[fieldKey] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, validateField]);

  // Form field handlers
  const setValue = useCallback((name: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const setFieldTouched = useCallback((name: keyof T, isTouched = true) => {
    setTouched(prev => ({ ...prev, [name]: isTouched }));
  }, []);

  const setFieldError = useCallback((name: keyof T, error: string | null) => {
    setErrors(prev => ({ ...prev, [name]: error || undefined }));
  }, []);

  // Handle field change
  const handleChange = useCallback((name: keyof T) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { value, type } = event.target;
    const fieldValue = type === 'checkbox' 
      ? (event.target as HTMLInputElement).checked 
      : value;
    
    setValue(name, fieldValue);
  }, [setValue]);

  // Handle field blur
  const handleBlur = useCallback((name: keyof T) => () => {
    setFieldTouched(name, true);
    const error = validateField(name, values[name]);
    setFieldError(name, error);
  }, [validateField, values, setFieldTouched, setFieldError]);

  // Reset form
  const reset = useCallback((newValues?: T) => {
    setValues(newValues || initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  // Submit handler
  const handleSubmit = useCallback((
    onSubmit: (values: T) => Promise<void> | void
  ) => async (event: React.FormEvent) => {
    event.preventDefault();
    
    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce((acc, key) => ({
      ...acc,
      [key]: true
    }), {} as Record<keyof T, boolean>);
    setTouched(allTouched);

    // Validate form
    if (!validateForm()) {
      // Focus first error field
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField && formRef.current) {
        const fieldElement = formRef.current.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
        fieldElement?.focus();
      }
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Form submission error:', error);
      // You might want to set a general form error here
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validateForm, errors]);

  // Get field props for easy binding
  const getFieldProps = useCallback((name: keyof T) => ({
    name: String(name),
    value: values[name] || '',
    onChange: handleChange(name),
    onBlur: handleBlur(name),
    'aria-invalid': !!(touched[name] && errors[name]),
    'aria-describedby': errors[name] ? `${String(name)}-error` : undefined,
  }), [values, handleChange, handleBlur, touched, errors]);

  // Get field state
  const getFieldState = useCallback((name: keyof T) => ({
    value: values[name],
    error: touched[name] ? errors[name] : undefined,
    touched: !!touched[name],
    dirty: values[name] !== initialValues[name],
  }), [values, errors, touched, initialValues]);

  const formState: FormState<T> = {
    fields: Object.keys(values).reduce((acc, key) => ({
      ...acc,
      [key]: getFieldState(key as keyof T)
    }), {} as Record<keyof T, any>),
    isSubmitting,
    isValid: Object.keys(errors).length === 0,
    errors: errors as Record<keyof T, string>,
  };

  return {
    // State
    values,
    errors,
    touched,
    isSubmitting,
    formState,
    formRef,
    
    // Actions
    setValue,
    setFieldTouched,
    setFieldError,
    reset,
    validateForm,
    
    // Handlers
    handleSubmit,
    getFieldProps,
    getFieldState,
  };
}
