import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentFilterPanel } from '../AgentFilterPanel';

describe('AgentFilterPanel', () => {
  const mockOnChange = vi.fn();
  const defaultValues = {};

  beforeEach(() => {
    mockOnChange.mockClear();
    cleanup();
  });

  it('renders without task context', () => {
    render(<AgentFilterPanel values={defaultValues} onChange={mockOnChange} />);

    expect(screen.queryByText('CURRENT TASK')).toBeNull();
    expect(screen.getByText('Availability')).toBeTruthy();
    expect(screen.getByText('Price Range')).toBeTruthy();
    expect(screen.getByText('Skills & Tags')).toBeTruthy();
  });

  it('renders task context card when provided', () => {
    const taskContext = {
      id: 'task-1',
      title: 'Smart Contract Audit',
      type: 'code' as const,
      tags: ['Solidity', 'Security'],
      reward: '500000000',
    };

    render(
      <AgentFilterPanel values={defaultValues} onChange={mockOnChange} taskContext={taskContext} />
    );

    expect(screen.getByText('CURRENT TASK')).toBeTruthy();
    expect(screen.getByText('Smart Contract Audit')).toBeTruthy();
    expect(screen.getByText('500 USDC')).toBeTruthy();
  });

  it('toggles showOnlyIdle filter', () => {
    render(<AgentFilterPanel values={defaultValues} onChange={mockOnChange} />);

    const switchEl = screen.getByRole('switch');
    fireEvent.click(switchEl);

    expect(mockOnChange).toHaveBeenCalledWith({ showOnlyIdle: true });
  });

  it('toggles tag selection', () => {
    render(<AgentFilterPanel values={defaultValues} onChange={mockOnChange} />);

    const solidityTag = screen.getByText('Solidity');
    fireEvent.click(solidityTag);

    expect(mockOnChange).toHaveBeenCalledWith({ tags: ['Solidity'] });
  });

  it('updates price range', () => {
    render(<AgentFilterPanel values={defaultValues} onChange={mockOnChange} />);

    const minInput = screen.getByPlaceholderText('$ Min');
    fireEvent.change(minInput, { target: { value: '100' } });

    expect(mockOnChange).toHaveBeenCalledWith({ minPrice: '100000000' });
  });
});
