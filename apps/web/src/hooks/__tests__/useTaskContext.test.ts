// Purpose: Ensure useTaskContext parses required URL parameters and tags.

import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
}));

import { useSearchParams } from 'next/navigation';

import { useTaskContext } from '../useTaskContext';

describe('useTaskContext', () => {
  it('returns null when required params are missing', () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(''));

    const result = useTaskContext();

    expect(result).toBeNull();
  });

  it('returns null when taskId is missing', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('orderId=o1&reward=1000000&type=code')
    );

    const result = useTaskContext();

    expect(result).toBeNull();
  });

  it('returns null when orderId is missing', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('taskId=t1&reward=1000000&type=code')
    );

    const result = useTaskContext();

    expect(result).toBeNull();
  });

  it('returns null when reward is missing', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('taskId=t1&orderId=o1&type=code')
    );

    const result = useTaskContext();

    expect(result).toBeNull();
  });

  it('returns null when type is missing', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('taskId=t1&orderId=o1&reward=1000000')
    );

    const result = useTaskContext();

    expect(result).toBeNull();
  });

  it('parses all required params correctly', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('taskId=t1&orderId=o1&reward=1000000&type=code')
    );

    const result = useTaskContext();

    expect(result).toEqual({
      taskId: 't1',
      orderId: 'o1',
      reward: '1000000',
      type: 'code',
      tags: [],
    });
  });

  it('parses tags from comma-separated string', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('taskId=t1&orderId=o1&reward=1000000&type=code&tags=tag1,tag2,tag3')
    );

    const result = useTaskContext();

    expect(result?.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });

  it('returns empty tags array when tags param is empty', () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams('taskId=t1&orderId=o1&reward=1000000&type=code&tags=')
    );

    const result = useTaskContext();

    expect(result?.tags).toEqual([]);
  });
});
