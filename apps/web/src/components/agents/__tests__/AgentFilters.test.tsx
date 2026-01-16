import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AgentFilters } from '../AgentFilters';

describe('AgentFilters', () => {
  it('renders filter inputs for keywords, tags, and pricing', () => {
    const markup = renderToStaticMarkup(<AgentFilters values={{}} onChange={() => undefined} />);

    expect(markup).toContain('名称 / 描述');
    expect(markup).toContain('多个标签用逗号分隔');
    expect(markup).toContain('最低价');
    expect(markup).toContain('最高价');
  });
});
