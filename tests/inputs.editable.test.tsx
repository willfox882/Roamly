import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/react-user-event';
import AddTripForm from '../app/components/AddTripForm';

// Mock useOffline hook
jest.mock('../hooks/useOffline', () => ({
  useOffline: () => ({ online: true }),
}));

// Mock useUIStore
jest.mock('../lib/store', () => ({
  useUIStore: () => ({ theme: 'dark' }),
}));

// Mock aiClient
jest.mock('../lib/aiClient', () => ({
  getProviderInfo: () => ({ mode: 'cloud', available: true }),
}));

describe('AddTripForm Input Styling and Editability', () => {
  const mockProps = {
    onClose: jest.fn(),
    onSave: jest.fn(),
    onParse: jest.fn(),
    aiConsent: true,
    onShowConsent: jest.fn(),
  };

  it('renders inputs with roamly-input class and ensures they are editable', async () => {
    render(<AddTripForm {...mockProps} />);
    
    const tripNameInput = screen.getByPlaceholderText(/e.g. Las Vegas Weekend/i);
    expect(tripNameInput).toHaveClass('roamly-input');
    
    // Test editability
    await userEvent.type(tripNameInput, 'My Awesome Trip');
    expect(tripNameInput).toHaveValue('My Awesome Trip');
    
    // Check date inputs
    const dateInputs = screen.getAllByRole('textbox').filter(input => 
      input instanceof HTMLInputElement && input.type === 'date'
    );
    
    // Note: RTL might not find type="date" as "textbox" depending on environment
    // Let's find them by label or specific properties
    const firstDepartureDate = screen.getAllByLabelText(/Departure/i)[0];
    expect(firstDepartureDate).toHaveClass('roamly-date-input');
  });
});
