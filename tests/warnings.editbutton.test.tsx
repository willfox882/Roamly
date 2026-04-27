import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ParsedReviewPanel from '../app/components/ParsedReviewPanel';
import { useRouter } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

describe('ParsedReviewPanel Edit Button', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  const mockTrip = {
    id: 'trip-123',
    title: 'Hawaii',
    meta: {},
  };

  const mockGaps = [
    {
      id: 'gap-1',
      type: 'missing_accommodation',
      severity: 'high',
      message: 'No hotel on Feb 2',
      relatedEventIds: [],
      suggestedActions: [],
    },
  ];

  it('should render Edit button and navigate with focus target', () => {
    render(<ParsedReviewPanel events={[]} gaps={mockGaps as any} trip={mockTrip as any} />);
    
    const editButton = screen.getByLabelText(/Edit trip details to fix missing_accommodation/i);
    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    expect(mockRouter.push).toHaveBeenCalledWith('/add/parse?tripId=trip-123&focus=accommodation');
  });

  it('should navigate to flights section for overlap warnings', () => {
    const overlapGaps = [
      {
        id: 'gap-2',
        type: 'overlap',
        severity: 'medium',
        message: 'Flights overlap',
        relatedEventIds: [],
        suggestedActions: [],
      },
    ];

    render(<ParsedReviewPanel events={[]} gaps={overlapGaps as any} trip={mockTrip as any} />);
    
    const editButton = screen.getByLabelText(/Edit trip details to fix overlap/i);
    fireEvent.click(editButton);

    expect(mockRouter.push).toHaveBeenCalledWith('/add/parse?tripId=trip-123&focus=flights');
  });
});
