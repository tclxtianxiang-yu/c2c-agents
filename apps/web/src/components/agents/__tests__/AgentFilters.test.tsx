import { AgentStatus } from '@c2c-agents/shared';
import type React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { AgentFilters } from '../AgentFilters';

function renderFilters(props: React.ComponentProps<typeof AgentFilters>) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(<AgentFilters {...props} />);
  });

  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('AgentFilters', () => {
  it('renders filter inputs for keywords, tags, and pricing', () => {
    const { container, cleanup } = renderFilters({ values: {}, onChange: () => undefined });

    expect(container.querySelector('input[placeholder="名称 / 描述"]')).toBeTruthy();
    expect(container.querySelector('input[placeholder="多个标签用逗号分隔"]')).toBeTruthy();
    expect(container.textContent).toContain('最低价');
    expect(container.textContent).toContain('最高价');

    cleanup();
  });

  it('calls onChange when keyword input changes', () => {
    const onChange = vi.fn();
    const { container, cleanup } = renderFilters({ values: {}, onChange });
    const input = container.querySelector('input[placeholder="名称 / 描述"]') as HTMLInputElement;

    act(() => {
      input.value = '翻译';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith({ keyword: '翻译' });

    cleanup();
  });

  it('calls onChange when task type is selected', () => {
    const onChange = vi.fn();
    const { container, cleanup } = renderFilters({ values: {}, onChange });
    const selects = container.querySelectorAll('select');
    const taskTypeSelect = selects[0] as HTMLSelectElement;

    act(() => {
      taskTypeSelect.value = 'translation';
      taskTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ taskType: 'translation' }));

    cleanup();
  });

  it('calls onChange when status is selected', () => {
    const onChange = vi.fn();
    const { container, cleanup } = renderFilters({ values: {}, onChange });
    const selects = container.querySelectorAll('select');
    const statusSelect = selects[1] as HTMLSelectElement;

    act(() => {
      statusSelect.value = AgentStatus.Idle;
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: AgentStatus.Idle }));

    cleanup();
  });

  it('converts price input to min unit string', () => {
    const onChange = vi.fn();
    const { container, cleanup } = renderFilters({ values: {}, onChange });
    const minPriceInput = container.querySelector(
      'input[id="agent-filter-min-price"]'
    ) as HTMLInputElement;

    act(() => {
      minPriceInput.value = '10';
      minPriceInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ minPrice: '10000000' }));

    cleanup();
  });

  it('parses comma-separated tags correctly', () => {
    const onChange = vi.fn();
    const { container, cleanup } = renderFilters({ values: {}, onChange });
    const tagsInput = container.querySelector(
      'input[placeholder="多个标签用逗号分隔"]'
    ) as HTMLInputElement;

    act(() => {
      tagsInput.value = '翻译, AI, 技术';
      tagsInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ['翻译', 'AI', '技术'] })
    );

    cleanup();
  });

  it('applies task context on mount', () => {
    const onChange = vi.fn();
    const taskContext = {
      type: 'translation' as const,
      tags: ['翻译', '本地化'],
      reward: '5000000',
    };

    const { cleanup } = renderFilters({ values: {}, onChange, taskContext });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ taskType: 'translation', tags: ['翻译', '本地化'] })
    );

    cleanup();
  });

  it('toggles filter panel visibility', () => {
    const { container, cleanup } = renderFilters({ values: {}, onChange: () => undefined });
    const toggleButton = container.querySelector('button') as HTMLButtonElement;

    expect(toggleButton.textContent).toBe('收起');

    act(() => {
      toggleButton.click();
    });

    expect(toggleButton.textContent).toBe('展开');

    cleanup();
  });

  it('clears filters when inputs are emptied', () => {
    const onChange = vi.fn();
    const { container, cleanup } = renderFilters({ values: { keyword: '测试' }, onChange });
    const input = container.querySelector('input[placeholder="名称 / 描述"]') as HTMLInputElement;

    act(() => {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ keyword: undefined }));

    cleanup();
  });
});
