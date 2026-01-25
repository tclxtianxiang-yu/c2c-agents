'use client';

import type { Agent, Execution } from '@c2c-agents/shared';
import * as d3 from 'd3';
import { useEffect, useRef, useState } from 'react';
import { ExecutionDetailModal } from './ExecutionDetailModal';

type ExecutionWithAgent = Execution & {
  agent: Pick<
    Agent,
    'id' | 'name' | 'supportedTaskTypes' | 'avgRating' | 'completedOrderCount' | 'status'
  > | null;
};

type ExecutionOrbsProps = {
  executions: ExecutionWithAgent[];
  onSelect: (executionId: string) => void;
  selectedIds: string[];
};

export function ExecutionOrbs({ executions, onSelect, selectedIds }: ExecutionOrbsProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionWithAgent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!svgRef.current || executions.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = 600;
    const height = 400;

    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    // Define glow filter
    const defs = svg.append('defs');
    const filter = defs
      .append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Initial positions (triangle layout)
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 120;
    const initialPositions = [
      { x: centerX, y: centerY - radius },
      { x: centerX - radius * 0.866, y: centerY + radius * 0.5 },
      { x: centerX + radius * 0.866, y: centerY + radius * 0.5 },
    ];

    // Add position state for each execution
    type OrbData = ExecutionWithAgent & {
      x: number;
      y: number;
      initialX: number;
      initialY: number;
    };
    const orbData: OrbData[] = executions.map((exec, i) => ({
      ...exec,
      x: initialPositions[i]?.x ?? centerX,
      y: initialPositions[i]?.y ?? centerY,
      initialX: initialPositions[i]?.x ?? centerX,
      initialY: initialPositions[i]?.y ?? centerY,
    }));

    // Drag behavior
    const drag = d3
      .drag<SVGGElement, OrbData>()
      .on('start', function () {
        d3.select(this).raise().attr('opacity', 0.8);
      })
      .on('drag', function (event, d) {
        d.x = event.x;
        d.y = event.y;
        d3.select(this).attr('transform', `translate(${d.x}, ${d.y})`);
      })
      .on('end', function (_event, d) {
        d3.select(this).attr('opacity', 1);
        // Smooth bounce-back to initial position
        d3.select(this)
          .transition()
          .duration(500)
          .ease(d3.easeElastic)
          .attr('transform', `translate(${d.initialX}, ${d.initialY})`);
        d.x = d.initialX;
        d.y = d.initialY;
      });

    // Draw orb groups
    const orbs = svg
      .selectAll<SVGGElement, OrbData>('.orb')
      .data(orbData)
      .enter()
      .append('g')
      .attr('class', 'orb')
      .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
      .style('cursor', 'grab')
      .call(drag);

    // Orb circles
    orbs
      .append('circle')
      .attr('r', 45)
      .attr('fill', (d) => getOrbColor(d.status))
      .attr('filter', 'url(#glow)')
      .attr('stroke', (d) => (selectedIds.includes(d.id) ? '#00ff88' : 'transparent'))
      .attr('stroke-width', 4);

    // Click event
    orbs.on('click', (event, d) => {
      if (event.defaultPrevented) return;
      setSelectedExecution(d);
      setIsModalOpen(true);
    });

    // Pulse animation (running state)
    orbs
      .filter((d) => d.status === 'running')
      .append('circle')
      .attr('r', 45)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('opacity', 0.6)
      .each(function () {
        const el = d3.select(this);
        function pulse() {
          el.transition()
            .duration(1500)
            .attr('r', 70)
            .attr('opacity', 0)
            .on('end', () => {
              el.attr('r', 45).attr('opacity', 0.6);
              pulse();
            });
        }
        pulse();
      });

    // Agent name
    orbs
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .attr('fill', 'white')
      .attr('font-size', '11px')
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none')
      .text((d) => (d.agent?.name ?? 'Agent').slice(0, 10));

    // Status text
    orbs
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('fill', 'white')
      .attr('font-size', '10px')
      .attr('pointer-events', 'none')
      .text((d) => getStatusLabel(d.status));
  }, [executions, selectedIds]);

  const handleSelectAgent = () => {
    if (selectedExecution && selectedExecution.status === 'completed') {
      onSelect(selectedExecution.id);
    }
  };

  return (
    <>
      <svg ref={svgRef} className="w-full h-[400px]" />
      <ExecutionDetailModal
        execution={selectedExecution}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelect={handleSelectAgent}
        isSelected={selectedExecution ? selectedIds.includes(selectedExecution.id) : false}
      />
    </>
  );
}

function getOrbColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#6b7280',
    running: '#3b82f6',
    completed: '#10b981',
    failed: '#ef4444',
    selected: '#8b5cf6',
    rejected: '#374151',
  };
  return colors[status] ?? '#6b7280';
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '等待中',
    running: '执行中',
    completed: '已完成',
    failed: '失败',
    selected: '已选中',
    rejected: '未选中',
  };
  return labels[status] ?? status;
}
