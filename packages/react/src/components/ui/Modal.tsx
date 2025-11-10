import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Modal component with portal rendering and keyboard support.
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [isOpen, setIsOpen] = useState(false);
 *   
 *   return (
 *     <>
 *       <button onClick={() => setIsOpen(true)}>Open Modal</button>
 *       <Modal 
 *         isOpen={isOpen} 
 *         onClose={() => setIsOpen(false)}
 *         title="My Modal"
 *       >
 *         <p>Modal content goes here</p>
 *       </Modal>
 *     </>
 *   );
 * }
 * ```
 */
export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  size = 'md' 
}: ModalProps) {
  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const titleId = useId();

  if (!isOpen) return null;

  const sizeWidths = {
    sm: '384px',
    md: '448px',
    lg: '512px',
    xl: '576px',
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        overflowY: 'auto',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          transition: 'opacity 0.3s',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div style={{
        display: 'flex',
        minHeight: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}>
        {/* Modal Content */}
        <div
          style={{
            position: 'relative',
            maxWidth: sizeWidths[size],
            width: '100%',
            transform: 'scale(1)',
            overflow: 'hidden',
            borderRadius: '8px',
            backgroundColor: 'white',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            transition: 'all 0.3s',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              color: '#9CA3AF',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '4px',
              padding: '4px',
            }}
            aria-label="Close dialog"
            onMouseOver={(e) => (e.currentTarget.style.color = '#6B7280')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#9CA3AF')}
          >
            <svg
              style={{ height: '24px', width: '24px' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Title */}
          {title && (
            <div style={{ marginBottom: '16px' }}>
              <h3 id={titleId} style={{
                fontSize: '18px',
                fontWeight: 500,
                color: '#111827',
              }}>
                {title}
              </h3>
            </div>
          )}

          {/* Content */}
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
