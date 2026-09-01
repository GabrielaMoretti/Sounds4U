import { useEffect, useRef, useState } from 'react'

const WIDTH = 900
const HEIGHT = 600

const OWNER_COLOR = {
  me: 'var(--accent)',
  friend: '#c084fc',
  both: '#f2b705',
}

export default function TasteMapCanvas({ nodes, edges, onNodeClick }) {
  const svgRef = useRef(null)
  const circleRefs = useRef(new Map())
  const lineRefs = useRef(new Map())
  const simNodesRef = useRef([])
  const alphaRef = useRef(1)
  const dragRef = useRef(null) // { kind: 'pan'|'node', ... }
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })

  // Keep sim node positions stable across re-renders; only add/remove as the node list changes.
  const prevById = new Map(simNodesRef.current.map((n) => [n.id, n]))
  simNodesRef.current = nodes.map(
    (n) =>
      prevById.get(n.id) ?? {
        id: n.id,
        x: WIDTH / 2 + (Math.random() - 0.5) * 400,
        y: HEIGHT / 2 + (Math.random() - 0.5) * 400,
        vx: 0,
        vy: 0,
        fixed: false,
      }
  )

  useEffect(() => {
    alphaRef.current = 1
    let raf
    const simNodes = simNodesRef.current
    const byId = new Map(simNodes.map((n) => [n.id, n]))

    function tick() {
      if (alphaRef.current > 0.015) {
        alphaRef.current *= 0.985

        for (let i = 0; i < simNodes.length; i++) {
          for (let j = i + 1; j < simNodes.length; j++) {
            const a = simNodes[i]
            const b = simNodes[j]
            let dx = a.x - b.x
            let dy = a.y - b.y
            const distSq = dx * dx + dy * dy || 0.01
            const dist = Math.sqrt(distSq)
            const force = 1100 / distSq
            dx /= dist
            dy /= dist
            if (!a.fixed) {
              a.vx += dx * force
              a.vy += dy * force
            }
            if (!b.fixed) {
              b.vx -= dx * force
              b.vy -= dy * force
            }
          }
        }

        for (const e of edges) {
          const a = byId.get(e.source)
          const b = byId.get(e.target)
          if (!a || !b) continue
          let dx = b.x - a.x
          let dy = b.y - a.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01
          const force = (dist - 90) * 0.02
          dx /= dist
          dy /= dist
          if (!a.fixed) {
            a.vx += dx * force
            a.vy += dy * force
          }
          if (!b.fixed) {
            b.vx -= dx * force
            b.vy -= dy * force
          }
        }

        for (const n of simNodes) {
          if (n.fixed) continue
          n.vx += (WIDTH / 2 - n.x) * 0.0015
          n.vy += (HEIGHT / 2 - n.y) * 0.0015
          n.vx *= 0.82
          n.vy *= 0.82
          n.x += n.vx
          n.y += n.vy
        }
      }

      for (const n of simNodes) {
        const el = circleRefs.current.get(n.id)
        if (el) {
          el.setAttribute('cx', n.x)
          el.setAttribute('cy', n.y)
        }
        const label = circleRefs.current.get(`label-${n.id}`)
        if (label) {
          label.setAttribute('x', n.x)
          label.setAttribute('y', n.y - 12)
        }
      }
      for (const e of edges) {
        const a = byId.get(e.source)
        const b = byId.get(e.target)
        const line = lineRefs.current.get(`${e.source}__${e.target}`)
        if (line && a && b) {
          line.setAttribute('x1', a.x)
          line.setAttribute('y1', a.y)
          line.setAttribute('x2', b.x)
          line.setAttribute('y2', b.y)
        }
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [nodes, edges])

  function screenToGraph(clientX, clientY) {
    const rect = svgRef.current.getBoundingClientRect()
    const sx = ((clientX - rect.left) / rect.width) * WIDTH
    const sy = ((clientY - rect.top) / rect.height) * HEIGHT
    return { x: (sx - transform.x) / transform.scale, y: (sy - transform.y) / transform.scale }
  }

  function handleBackgroundPointerDown(e) {
    dragRef.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, origin: { ...transform }, moved: false }
  }

  function handleNodePointerDown(e, nodeId) {
    e.stopPropagation()
    const sim = simNodesRef.current.find((n) => n.id === nodeId)
    if (!sim) return
    sim.fixed = true
    alphaRef.current = Math.max(alphaRef.current, 0.4)
    dragRef.current = { kind: 'node', nodeId, moved: false }
  }

  function handlePointerMove(e) {
    const drag = dragRef.current
    if (!drag) return
    drag.moved = true
    if (drag.kind === 'pan') {
      const rect = svgRef.current.getBoundingClientRect()
      setTransform({
        ...drag.origin,
        x: drag.origin.x + (e.clientX - drag.startX) * (WIDTH / rect.width),
        y: drag.origin.y + (e.clientY - drag.startY) * (HEIGHT / rect.height),
      })
    } else if (drag.kind === 'node') {
      const sim = simNodesRef.current.find((n) => n.id === drag.nodeId)
      if (sim) {
        const { x, y } = screenToGraph(e.clientX, e.clientY)
        sim.x = x
        sim.y = y
      }
    }
  }

  function handlePointerUp(e, nodeId) {
    const drag = dragRef.current
    if (drag?.kind === 'node') {
      const sim = simNodesRef.current.find((n) => n.id === drag.nodeId)
      if (sim) sim.fixed = false
      if (!drag.moved && nodeId) {
        const node = nodes.find((n) => n.id === nodeId)
        if (node) onNodeClick?.(node.track)
      }
    }
    dragRef.current = null
  }

  function handleWheel(e) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setTransform((t) => ({ ...t, scale: Math.min(3, Math.max(0.3, t.scale * factor)) }))
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="taste-map-svg"
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(e) => handlePointerUp(e, null)}
      onPointerLeave={() => (dragRef.current = null)}
      onWheel={handleWheel}
    >
      <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
        {edges.map((e) => (
          <line
            key={`${e.source}__${e.target}`}
            ref={(el) => {
              if (el) lineRefs.current.set(`${e.source}__${e.target}`, el)
              else lineRefs.current.delete(`${e.source}__${e.target}`)
            }}
            className={`taste-edge taste-edge-${e.kind}`}
          />
        ))}
        {nodes.map((n) => (
          <g key={n.id}>
            <circle
              ref={(el) => {
                if (el) circleRefs.current.set(n.id, el)
                else circleRefs.current.delete(n.id)
              }}
              r={6 + Math.sqrt(n.weight) * 2}
              className="taste-node"
              style={{ fill: n.color ?? OWNER_COLOR[n.owner] ?? OWNER_COLOR.me }}
              onPointerDown={(e) => handleNodePointerDown(e, n.id)}
              onPointerUp={(e) => handlePointerUp(e, n.id)}
            />
            <text
              ref={(el) => {
                if (el) circleRefs.current.set(`label-${n.id}`, el)
                else circleRefs.current.delete(`label-${n.id}`)
              }}
              className="taste-node-label"
              textAnchor="middle"
            >
              {n.track.name}
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}
