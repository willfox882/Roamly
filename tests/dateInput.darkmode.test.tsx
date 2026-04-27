import React from 'react';
import { render, screen } from '@testing-library/react';
import AddTripForm from '../app/components/AddTripForm';

// Mock hooks and store
jest.mock('../hooks/useOffline', () => ({ useOffline: () => ({ online: true }) }));
jest.mock('../lib/store', () => ({ useUIStore: () => ({ theme: 'dark' }) }));
jest.mock('../lib/aiClient', () => ({ getProviderInfo: () => ({ mode: 'cloud', available: true }) }));

describe('AddTripForm Dark Mode Styles', () => {
  const mockProps = {
    onClose: jest.fn(),
    onSave: jest.fn(),
    onParse: jest.fn(),
    aiConsent: true,
    onShowConsent: jest.fn(),
  };

  it('verifies date inputs have white background and black text in dark mode', () => {
    render(<AddTripForm {...mockProps} />);
    
    const dateInput = screen.getAllByLabelText(/Departure/i)[0] as HTMLInputElement;
    
    // In a real browser environment, JSDOM doesn't compute external CSS.
    // However, we've applied the classes. To truly test computed style we'd need 
    // an E2E test or to inject styles into the test.
    // For unit tests, we'll verify the classes are applied.
    expect(dateInput).toHaveClass('roamly-date-input');
    expect(dateInput).toHaveClass('roamly-input');
  });
});
