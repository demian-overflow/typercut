import { useMemo, useRef } from 'react';
import type { GraphData } from '../../lib/textGenerator';

interface Props {
  graph: GraphData;
  activeNodeId: string | null;
  visitedNodeIds: Set<string>;
}

const W = 480;
const H = 160;
const R = 16;
const LABEL_OFFSET = 14;

function nx(x: number) {
  return x * (W - R * 2 - 20) + R + 10;
}
function ny(y: number) {
  return y * (H - R * 2 - LABEL_OFFSET - 8) + R + 4;
}

export default function GraphCanvas({ graph, activeNodeId, visitedNodeIds }: Props) {
  // Track traversal key so animateMotion restarts on each new active edge
  const traversalKey = useRef(0);
  const prevActiveRef = useRef<string | null>(null);
  if (prevActiveRef.current !== activeNodeId) {
    traversalKey.current += 1;
    prevActiveRef.current = activeNodeId;
  }

  const nodeMap = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes],
  );

  // Determine active edge: the edge from the last visited node to the current active node
  const activeEdge = useMemo(() => {
    if (!activeNodeId) return null;
    const order = graph.traversal_order;
    const idx = order.indexOf(activeNodeId);
    if (idx <= 0) return null;
    const prevId = order[idx - 1];
    return graph.edges.find((e) => e.from === prevId && e.to === activeNodeId) ?? null;
  }, [activeNodeId, graph]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H, maxWidth: W }}
      aria-hidden="true"
    >
      {/* Edges */}
      {graph.edges.map((edge) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) return null;
        const x1 = nx(from.x);
        const y1 = ny(from.y);
        const x2 = nx(to.x);
        const y2 = ny(to.y);

        const isVisited = visitedNodeIds.has(edge.from) && visitedNodeIds.has(edge.to);
        const isActive =
          activeEdge && activeEdge.from === edge.from && activeEdge.to === edge.to;

        const pathId = `edge-${edge.from}-${edge.to}`;
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;

        return (
          <g key={pathId}>
            <path
              id={pathId}
              d={`M${x1},${y1} L${x2},${y2}`}
              stroke={isVisited || isActive ? '#22c55e' : '#e5e7eb'}
              strokeWidth={isActive ? 2 : 1.5}
              fill="none"
            />
            {/* Relationship label */}
            {edge.label && (
              <text
                x={mx}
                y={my - 4}
                textAnchor="middle"
                fontSize={8}
                fill="#9ca3af"
                className="select-none pointer-events-none"
              >
                {edge.label}
              </text>
            )}
            {/* Animated particle on active edge */}
            {isActive && (
              <circle key={traversalKey.current} r={4} fill="#3b82f6">
                <animateMotion dur="0.55s" fill="freeze">
                  <mpath href={`#${pathId}`} />
                </animateMotion>
              </circle>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {graph.nodes.map((node) => {
        const cx = nx(node.x);
        const cy = ny(node.y);
        const isActive = node.id === activeNodeId;
        const isVisited = visitedNodeIds.has(node.id);

        const fill = isActive ? '#3b82f6' : isVisited ? '#22c55e' : '#d1d5db';
        const textFill = isActive || isVisited ? '#ffffff' : '#6b7280';

        return (
          <g key={node.id}>
            {/* Pulsing ring for active node */}
            {isActive && (
              <circle cx={cx} cy={cy} r={R + 6} fill="none" stroke="#93c5fd" strokeWidth={2}>
                <animate
                  attributeName="r"
                  values={`${R + 4};${R + 10};${R + 4}`}
                  dur="1.2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.8;0.2;0.8"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            <circle cx={cx} cy={cy} r={R} fill={fill} />
            {/* Node label inside circle (short labels only) */}
            {node.label.length <= 10 && (
              <text
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fontSize={9}
                fontWeight={500}
                fill={textFill}
                className="select-none pointer-events-none"
              >
                {node.label}
              </text>
            )}
            {/* Label below for longer names */}
            {node.label.length > 10 && (
              <text
                x={cx}
                y={cy + R + LABEL_OFFSET}
                textAnchor="middle"
                fontSize={9}
                fill="#6b7280"
                className="select-none pointer-events-none"
              >
                {node.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
