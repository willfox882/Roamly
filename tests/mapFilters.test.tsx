import React from 'react';
import { render, screen } from '@testing-library/react';
import MapFilterBar, { FILTERS } from '../app/components/MapFilterBar';

describe('MapFilterBar', () => {
  it('should not contain the Excluded filter option', () => {
    render(<MapFilterBar activeFilters={new Set(['all'])} onToggleFilter={jest.fn()} />);
    
    expect(FILTERS).not.toContain('excluded');
    const excludedButton = screen.queryByRole('button', { name: /excluded/i });
    expect(excludedButton).toBeNull();
  });

  it('should show only All, Visited, Upcoming, Bucket', () => {
    render(<MapFilterBar activeFilters={new Set(['all'])} onToggleFilter={jest.fn()} />);
    
    expect(screen.getByRole('button', { name: /all/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /visited/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /upcoming/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /bucket/i })).toBeDefined();
  });
});
