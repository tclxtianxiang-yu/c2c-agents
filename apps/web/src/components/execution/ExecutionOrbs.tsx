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

// Node type for force simulation
type OrbNode = d3.SimulationNodeDatum &
  ExecutionWithAgent & {
    x: number;
    y: number;
  };

// Link type for connections between orbs
type OrbLink = d3.SimulationLinkDatum<OrbNode>;

export function ExecutionOrbs({ executions, onSelect, selectedIds }: ExecutionOrbsProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<OrbNode, OrbLink> | null>(null);
  const [selectedExecution, setSelectedExecution] = useState<ExecutionWithAgent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!svgRef.current || executions.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = 600;
    const height = 400;
    const orbRadius = 45;

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

    // Create nodes with initial positions
    const nodes: OrbNode[] = executions.map((exec, i) => ({
      ...exec,
      x: initialPositions[i]?.x ?? centerX,
      y: initialPositions[i]?.y ?? centerY,
    }));

    // Create links between all nodes (fully connected graph)
    const links: OrbLink[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        links.push({ source: i, target: j });
      }
    }

    // Create force simulation
    const simulation = d3
      .forceSimulation<OrbNode>(nodes)
      .force('link', d3.forceLink<OrbNode, OrbLink>(links).distance(150).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(centerX, centerY).strength(0.05))
      .force('collision', d3.forceCollide<OrbNode>().radius(orbRadius + 10))
      .alphaDecay(0.02)
      .velocityDecay(0.3);

    simulationRef.current = simulation;

    // Draw links (lines between orbs)
    const linkElements = svg
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#4b5563')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.4);

    // Draw orb groups
    const orbs = svg
      .append('g')
      .attr('class', 'orbs')
      .selectAll<SVGGElement, OrbNode>('.orb')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'orb')
      .style('cursor', 'grab');

    // Orb circles
    orbs
      .append('circle')
      .attr('r', orbRadius)
      .attr('fill', (d) => getOrbColor(d.status))
      .attr('filter', 'url(#glow)')
      .attr('stroke', (d) => (selectedIds.includes(d.id) ? '#00ff88' : 'transparent'))
      .attr('stroke-width', 4);

    // Pulse animation (running state)
    orbs
      .filter((d) => d.status === 'running')
      .append('circle')
      .attr('r', orbRadius)
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
              el.attr('r', orbRadius).attr('opacity', 0.6);
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

    // Click event
    orbs.on('click', (event, d) => {
      if (event.defaultPrevented) return;
      setSelectedExecution(d);
      setIsModalOpen(true);
    });

    // Drag behavior with physics
    const drag = d3
      .drag<SVGGElement, OrbNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        d3.select(event.sourceEvent.target.parentNode).style('cursor', 'grabbing');
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        // Release the node - let physics take over
        d.fx = null;
        d.fy = null;
        d3.select(event.sourceEvent.target.parentNode).style('cursor', 'grab');
      });

    orbs.call(drag);

    // Update positions on each tick
    simulation.on('tick', () => {
      // Keep nodes within bounds
      nodes.forEach((d) => {
        d.x = Math.max(orbRadius, Math.min(width - orbRadius, d.x ?? centerX));
        d.y = Math.max(orbRadius, Math.min(height - orbRadius, d.y ?? centerY));
      });

      // Update link positions
      linkElements
        .attr('x1', (d) => (d.source as OrbNode).x ?? 0)
        .attr('y1', (d) => (d.source as OrbNode).y ?? 0)
        .attr('x2', (d) => (d.target as OrbNode).x ?? 0)
        .attr('y2', (d) => (d.target as OrbNode).y ?? 0);

      // Update orb positions
      orbs.attr('transform', (d) => `translate(${d.x ?? 0}, ${d.y ?? 0})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
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
