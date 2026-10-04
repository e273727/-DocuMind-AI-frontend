import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { 
  ArrowLeft, 
  Search, 
  Plus, 
  Minus, 
  Maximize2, 
  RotateCcw, 
  ChevronRight, 
  Layers, 
  Network, 
  Sparkles, 
  FileText, 
  ExternalLink, 
  MessageSquare, 
  X, 
  HelpCircle,
  FileKey,
  FolderTree,
  ChevronDown
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function ConceptGraphWorkspace({
  token,
  activeDoc,
  onSwitchToChat,
  onAskAboutRelationship,
  onCitationClick
}) {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Interaction State
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Node expansion state: Set of expanded node IDs
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  // Zoom transform reference
  const svgRef = useRef(null);
  const zoomBehaviorRef = useRef(null);
  const zoomGroupRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch concept graph
  useEffect(() => {
    if (activeDoc && activeDoc.status === 'processed') {
      fetchGraph(activeDoc.id);
    } else {
      setGraphData(null);
      setSelectedNodeId(null);
    }
  }, [activeDoc?.id, activeDoc?.status]);

  const fetchGraph = async (docId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/documents/${docId}/graph`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch concept graph');
      
      const g = data.graph;
      setGraphData(g);
      
      // Default expansion: expand root and level 1 nodes
      if (g && g.nodes) {
        const root = g.nodes.find(n => n.level === 0) || g.nodes[0];
        const defaultExpanded = new Set();
        if (root) {
          defaultExpanded.add(root.id);
          // Auto-select root initially
          setSelectedNodeId(root.id);
        }
        setExpandedNodes(defaultExpanded);
      }
    } catch (err) {
      console.error('Error fetching concept graph:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Node Map for fast lookup
  const nodeMap = useMemo(() => {
    if (!graphData || !graphData.nodes) return new Map();
    return new Map(graphData.nodes.map(n => [n.id, n]));
  }, [graphData]);

  // Root Node
  const rootNode = useMemo(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) return null;
    return graphData.nodes.find(n => n.id === graphData.rootId) ||
           graphData.nodes.find(n => n.level === 0) ||
           graphData.nodes[0];
  }, [graphData]);

  // Toggle node expansion
  const toggleNodeExpansion = useCallback((nodeId, e) => {
    if (e) e.stopPropagation();
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Expand all nodes
  const handleExpandAll = useCallback(() => {
    if (!graphData?.nodes) return;
    const all = new Set(graphData.nodes.map(n => n.id));
    setExpandedNodes(all);
  }, [graphData]);

  // Collapse all (keep only root)
  const handleCollapseAll = useCallback(() => {
    if (!rootNode) return;
    setExpandedNodes(new Set([rootNode.id]));
  }, [rootNode]);

  // Selected node object
  const selectedNode = useMemo(() => {
    return selectedNodeId ? nodeMap.get(selectedNodeId) : null;
  }, [selectedNodeId, nodeMap]);

  // Breadcrumb hierarchy for selected node
  const breadcrumb = useMemo(() => {
    if (!selectedNode) return [];
    const trail = [selectedNode];
    let curr = selectedNode;
    let safety = 0;
    while (curr && curr.parent && safety++ < 10) {
      const parent = nodeMap.get(curr.parent);
      if (parent) {
        trail.unshift(parent);
        curr = parent;
      } else {
        break;
      }
    }
    return trail;
  }, [selectedNode, nodeMap]);

  // Hierarchical Layout Calculation (Left-to-Right Organic Mind Map Flow)
  const layout = useMemo(() => {
    if (!rootNode || !graphData) return { nodes: [], links: [], bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 } };

    // Build visible hierarchy tree based on expandedNodes
    const buildHierarchy = (nodeId) => {
      const node = nodeMap.get(nodeId);
      if (!node) return null;

      const isExpanded = expandedNodes.has(nodeId);
      const childIds = isExpanded ? (node.children || []) : [];
      
      const children = childIds
        .map(buildHierarchy)
        .filter(Boolean);

      return {
        ...node,
        children: children.length > 0 ? children : null,
        _totalChildren: (node.children || []).length,
        _isExpanded: isExpanded
      };
    };

    const rootHierarchyData = buildHierarchy(rootNode.id);
    if (!rootHierarchyData) return { nodes: [], links: [], bounds: { minX: 0, maxX: 800, minY: 0, maxY: 600 } };

    const hierarchyRoot = d3.hierarchy(rootHierarchyData);

    // Layout dimensions
    // Horizontal distance per level
    const levelSpacing = [260, 240, 220, 200];
    // Dynamic node size based on number of visible leaves
    const leafCount = hierarchyRoot.leaves().length;
    const treeHeight = Math.max(leafCount * 68, 500);

    const treeLayout = d3.tree()
      .nodeSize([68, 250])
      .separation((a, b) => (a.parent === b.parent ? 1.15 : 1.35));

    treeLayout(hierarchyRoot);

    const layoutNodes = [];
    const layoutLinks = [];

    // Dimensions helper per level
    const getNodeDimensions = (level) => {
      switch (level) {
        case 0: return { width: 190, height: 48, rx: 12 };
        case 1: return { width: 165, height: 42, rx: 10 };
        case 2: return { width: 145, height: 36, rx: 8 };
        default: return { width: 130, height: 32, rx: 6 };
      }
    };

    hierarchyRoot.each(d => {
      const dim = getNodeDimensions(d.data.level);
      // d.x is vertical in d3.tree, d.y is horizontal
      const x = d.y + 80;
      const y = d.x + treeHeight / 2;

      layoutNodes.push({
        id: d.data.id,
        title: d.data.title || d.data.id,
        group: d.data.group,
        level: d.data.level,
        summary: d.data.summary,
        sourceReferences: d.data.sourceReferences,
        related: d.data.related,
        totalChildren: d.data._totalChildren,
        isExpanded: d.data._isExpanded,
        x,
        y,
        width: dim.width,
        height: dim.height,
        rx: dim.rx,
        depth: d.depth
      });
    });

    // Visible Tree Links
    hierarchyRoot.links().forEach(link => {
      const sDim = getNodeDimensions(link.source.data.level);
      const tDim = getNodeDimensions(link.target.data.level);

      layoutLinks.push({
        id: `${link.source.data.id}->${link.target.data.id}`,
        sourceId: link.source.data.id,
        targetId: link.target.data.id,
        source: {
          x: link.source.y + 80 + sDim.width,
          y: link.source.x + treeHeight / 2 + sDim.height / 2
        },
        target: {
          x: link.target.y + 80,
          y: link.target.x + treeHeight / 2 + tDim.height / 2
        },
        isTreeLink: true,
        relationship: 'contains'
      });
    });

    // Cross-cutting links (if both endpoints are currently visible in layout)
    const visibleMap = new Map(layoutNodes.map(n => [n.id, n]));
    if (graphData.links) {
      graphData.links.forEach(l => {
        const s = visibleMap.get(l.source);
        const t = visibleMap.get(l.target);
        if (s && t && s.id !== t.id) {
          // Check if not already a tree link
          const isTree = layoutLinks.some(tl => tl.sourceId === s.id && tl.targetId === t.id);
          if (!isTree) {
            layoutLinks.push({
              id: `rel:${s.id}->${t.id}`,
              sourceId: s.id,
              targetId: t.id,
              source: { x: s.x + s.width / 2, y: s.y + s.height / 2 },
              target: { x: t.x + t.width / 2, y: t.y + t.height / 2 },
              isTreeLink: false,
              relationship: l.relationship || 'relates to'
            });
          }
        }
      });
    }

    return { nodes: layoutNodes, links: layoutLinks };
  }, [rootNode, graphData, expandedNodes, nodeMap]);

  // Setup D3 Zoom & Pan
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const zoomGroup = d3.select(zoomGroupRef.current);

    const zoom = d3.zoom()
      .scaleExtent([0.3, 2.5])
      .on('zoom', (event) => {
        zoomGroup.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Initial center fit
    handleFitView();

    // Disable double click zoom to allow node click
    svg.on('dblclick.zoom', null);

  }, [graphData?.rootId]);

  // Fit view helper
  const handleFitView = useCallback(() => {
    if (!svgRef.current || !layout.nodes || layout.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const bounds = {
      minX: d3.min(layout.nodes, d => d.x) || 0,
      maxX: d3.max(layout.nodes, d => d.x + d.width) || 800,
      minY: d3.min(layout.nodes, d => d.y) || 0,
      maxY: d3.max(layout.nodes, d => d.y + d.height) || 600,
    };

    const width = containerRef.current ? containerRef.current.clientWidth : 1000;
    const height = containerRef.current ? containerRef.current.clientHeight : 700;

    // Account for side panel width if open
    const effectiveWidth = selectedNodeId ? Math.max(width - 360, 400) : width;

    const dx = bounds.maxX - bounds.minX;
    const dy = bounds.maxY - bounds.minY;
    const x = (bounds.minX + bounds.maxX) / 2;
    const y = (bounds.minY + bounds.maxY) / 2;

    const scale = Math.max(0.45, Math.min(1.05, 0.85 / Math.max(dx / effectiveWidth, dy / height)));
    const translate = [effectiveWidth / 2 - scale * x, height / 2 - scale * y];

    svg.transition()
      .duration(650)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
  }, [layout.nodes, selectedNodeId]);

  // Smooth Focus on a specific node
  const focusNode = useCallback((nodeId) => {
    // 1. Expand all ancestors
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const toExpand = new Set(expandedNodes);
    let curr = node;
    let safety = 0;
    while (curr && curr.parent && safety++ < 10) {
      toExpand.add(curr.parent);
      curr = nodeMap.get(curr.parent);
    }
    setExpandedNodes(toExpand);
    setSelectedNodeId(nodeId);

    // 2. Pan and center zoom to node coordinates
    setTimeout(() => {
      const targetNode = layout.nodes.find(n => n.id === nodeId);
      if (targetNode && svgRef.current) {
        const svg = d3.select(svgRef.current);
        const width = containerRef.current ? containerRef.current.clientWidth : 1000;
        const height = containerRef.current ? containerRef.current.clientHeight : 700;

        const targetX = targetNode.x + targetNode.width / 2;
        const targetY = targetNode.y + targetNode.height / 2;
        const scale = 1.0;

        const transform = d3.zoomIdentity
          .translate(width / 2 - targetX * scale, height / 2 - targetY * scale)
          .scale(scale);

        svg.transition()
          .duration(600)
          .call(zoomBehaviorRef.current.transform, transform);
      }
    }, 50);
  }, [nodeMap, expandedNodes, layout.nodes]);

  // Search filtered results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !graphData?.nodes) return [];
    const q = searchQuery.toLowerCase();
    return graphData.nodes.filter(n => 
      (n.title && n.title.toLowerCase().includes(q)) || 
      n.id.toLowerCase().includes(q) ||
      (n.group && n.group.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [searchQuery, graphData]);

  // Zoom controls
  const handleZoomIn = () => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.75);
  };

  const handleResetZoom = () => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  };

  // Connected nodes & links for hover and active selection
  const activeFocusId = hoveredNodeId || selectedNodeId;

  const connectedLinkIds = useMemo(() => {
    if (!activeFocusId) return new Set();
    const set = new Set();
    layout.links.forEach(l => {
      if (l.sourceId === activeFocusId || l.targetId === activeFocusId) {
        set.add(l.id);
      }
    });
    return set;
  }, [activeFocusId, layout.links]);

  const connectedNodeIds = useMemo(() => {
    if (!activeFocusId) return new Set();
    const set = new Set([activeFocusId]);
    layout.links.forEach(l => {
      if (l.sourceId === activeFocusId) set.add(l.targetId);
      if (l.targetId === activeFocusId) set.add(l.sourceId);
    });
    return set;
  }, [activeFocusId, layout.links]);

  return (
    <div className="mindmap-workspace" ref={containerRef}>
      {/* 1. Header Toolbar */}
      <div className="mindmap-toolbar">
        <div className="toolbar-left">
          <button 
            type="button" 
            className="btn-mindmap-back" 
            onClick={onSwitchToChat}
            title="Return to conversational chat"
          >
            <ArrowLeft size={15} />
            <span>Chat View</span>
          </button>

          <div className="mindmap-meta-badge">
            <Sparkles size={13} className="text-accent" />
            <span className="doc-name truncate" title={activeDoc?.filename}>
              {activeDoc?.filename}
            </span>
            <span className="mindmap-chip">
              {graphData?.nodes?.length || 0} Concepts &bull; {graphData?.links?.length || 0} Linkages
            </span>
          </div>
        </div>

        {/* Center: Search & Concept Finder */}
        <div className="toolbar-center">
          <div className="mindmap-search-capsule">
            <Search size={14} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search concepts or topics..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="mindmap-search-input"
            />
            {searchQuery && (
              <button 
                type="button" 
                className="search-clear-btn" 
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }}
              >
                <X size={12} />
              </button>
            )}

            {/* Search Dropdown Results */}
            {isSearchOpen && searchResults.length > 0 && (
              <div className="search-dropdown-menu">
                {searchResults.map(result => (
                  <button
                    key={result.id}
                    type="button"
                    className="search-dropdown-item"
                    onClick={() => {
                      focusNode(result.id);
                      setIsSearchOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <div className="result-info">
                      <span className="result-title">{result.title}</span>
                      <span className="result-category">{result.group}</span>
                    </div>
                    <span className="result-level">Level {result.level}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Graph Action Controls */}
        <div className="toolbar-right">
          <button 
            type="button" 
            className="btn-toolbar-ghost" 
            onClick={handleExpandAll}
            title="Expand all concept branches"
          >
            <FolderTree size={14} />
            <span className="hide-mobile">Expand All</span>
          </button>

          <button 
            type="button" 
            className="btn-toolbar-ghost" 
            onClick={handleCollapseAll}
            title="Collapse to root overview"
          >
            <Layers size={14} />
            <span className="hide-mobile">Collapse All</span>
          </button>

          <button 
            type="button" 
            className="btn-toolbar-ghost" 
            onClick={() => activeDoc && fetchGraph(activeDoc.id)}
            disabled={loading}
            title="Refresh concept graph"
          >
            <RotateCcw size={14} className={loading ? 'spin' : ''} />
            <span className="hide-mobile">Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive SVG Canvas Viewport */}
      <div className="mindmap-canvas-container">
        {loading ? (
          <div className="mindmap-state-view">
            <Sparkles size={36} className="spin text-accent" />
            <h3>Synthesizing Mind Map</h3>
            <p>Extracting conceptual hierarchy, defining entities, and grounding source passages...</p>
          </div>
        ) : error ? (
          <div className="mindmap-state-view">
            <HelpCircle size={36} className="text-secondary" />
            <h3>Unable to Construct Mind Map</h3>
            <p>{error}</p>
          </div>
        ) : (
          <svg 
            ref={svgRef} 
            className="mindmap-svg"
            onClick={() => setSelectedNodeId(null)}
          >
            <defs>
              {/* Subtle Linear Gradients for Nodes */}
              <linearGradient id="rootGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#6d28d9" stopOpacity="0.5" />
              </linearGradient>

              <linearGradient id="primaryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e2235" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#161826" stopOpacity="0.95" />
              </linearGradient>

              <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#8b5cf6" floodOpacity="0.45" />
              </filter>
            </defs>

            <g ref={zoomGroupRef} id="mindmap-zoom-group">
              {/* Links Layer */}
              <g className="links-layer">
                {layout.links.map(link => {
                  const isConnected = connectedLinkIds.has(link.id);
                  const isTree = link.isTreeLink;

                  // Smooth cubic bezier curve
                  const dx = link.target.x - link.source.x;
                  const path = isTree
                    ? `M ${link.source.x} ${link.source.y} C ${link.source.x + dx * 0.45} ${link.source.y}, ${link.target.x - dx * 0.45} ${link.target.y}, ${link.target.x} ${link.target.y}`
                    : `M ${link.source.x} ${link.source.y} Q ${(link.source.x + link.target.x) / 2} ${(link.source.y + link.target.y) / 2 - 40}, ${link.target.x} ${link.target.y}`;

                  return (
                    <g key={link.id} className={`link-group ${isConnected ? 'active' : ''}`}>
                      <path
                        d={path}
                        className={`mindmap-link ${isTree ? 'tree-link' : 'cross-link'} ${isConnected ? 'active-link' : ''}`}
                        style={{
                          opacity: activeFocusId ? (isConnected ? 1 : 0.12) : (isTree ? 0.45 : 0.25)
                        }}
                      />
                      {/* Optional Relationship label on cross-links or hover */}
                      {(!isTree || isConnected) && link.relationship !== 'contains' && (
                        <text
                          x={(link.source.x + link.target.x) / 2}
                          y={(link.source.y + link.target.y) / 2 - 6}
                          className="link-label"
                          textAnchor="middle"
                          style={{ opacity: isConnected ? 1 : 0 }}
                        >
                          {link.relationship}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>

              {/* Nodes Layer */}
              <g className="nodes-layer">
                {layout.nodes.map(node => {
                  const isSelected = selectedNodeId === node.id;
                  const isHovered = hoveredNodeId === node.id;
                  const isConnected = connectedNodeIds.has(node.id);
                  const isDimmed = activeFocusId && !isConnected && !isSelected;
                  const isRoot = node.level === 0;

                  return (
                    <g
                      key={node.id}
                      className={`node-group level-${node.level} ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                      }}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      style={{
                        cursor: 'pointer',
                        opacity: isDimmed ? 0.3 : 1,
                        transition: 'opacity 0.2s, transform 0.2s'
                      }}
                    >
                      {/* Main Node Capsule / Background */}
                      <rect
                        width={node.width}
                        height={node.height}
                        rx={node.rx}
                        className={`node-pill level-${node.level} ${isSelected ? 'active-pill' : ''}`}
                        filter={isSelected ? 'url(#nodeGlow)' : undefined}
                      />

                      {/* Sparkle icon for Root */}
                      {isRoot && (
                        <g transform="translate(12, 16)">
                          <circle cx="8" cy="8" r="10" fill="rgba(139, 92, 246, 0.4)" />
                          <path
                            d="M8 2 L10 6 L14 8 L10 10 L8 14 L6 10 L2 8 L6 6 Z"
                            fill="#f3f4f6"
                          />
                        </g>
                      )}

                      {/* Node Text & Labels */}
                      <text
                        x={isRoot ? 40 : 14}
                        y={isRoot ? 24 : 18}
                        className={`node-title level-${node.level}`}
                      >
                        {node.title.length > 20 ? `${node.title.slice(0, 18)}…` : node.title}
                      </text>

                      {/* Category Subtitle */}
                      <text
                        x={isRoot ? 40 : 14}
                        y={isRoot ? 38 : 31}
                        className="node-group-label"
                      >
                        {node.group || (isRoot ? 'Root Concept' : 'Concept')}
                      </text>

                      {/* Expand / Collapse Indicator Pill (+ / −) */}
                      {node.totalChildren > 0 && (
                        <g 
                          className="node-expander-btn"
                          transform={`translate(${node.width - 10}, ${node.height / 2})`}
                          onClick={(e) => toggleNodeExpansion(node.id, e)}
                          title={node.isExpanded ? "Collapse subtopics" : `Expand ${node.totalChildren} subtopics`}
                        >
                          <circle 
                            cx="0" 
                            cy="0" 
                            r="11" 
                            className={`expander-circle ${node.isExpanded ? 'expanded' : 'collapsed'}`} 
                          />
                          <text 
                            x="0" 
                            y="3.5" 
                            textAnchor="middle" 
                            className="expander-symbol"
                          >
                            {node.isExpanded ? '−' : `+${node.totalChildren}`}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        )}

        {/* 3. Floating Minimal Canvas Controls (Bottom-Left) */}
        <div className="mindmap-floating-controls">
          <button 
            type="button" 
            className="floating-ctrl-btn" 
            onClick={handleZoomIn} 
            title="Zoom In (+)"
          >
            <Plus size={16} />
          </button>
          <button 
            type="button" 
            className="floating-ctrl-btn" 
            onClick={handleZoomOut} 
            title="Zoom Out (−)"
          >
            <Minus size={16} />
          </button>
          <button 
            type="button" 
            className="floating-ctrl-btn" 
            onClick={handleFitView} 
            title="Fit to Screen"
          >
            <Maximize2 size={15} />
          </button>
          <button 
            type="button" 
            className="floating-ctrl-btn" 
            onClick={handleResetZoom} 
            title="Reset Zoom"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* 4. Contextual Node Information Panel (Slide-Over on Right) */}
        {selectedNode && (
          <aside className="mindmap-node-panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <span className="panel-level-tag">
                  Level {selectedNode.level} &bull; {selectedNode.group || 'Core Concept'}
                </span>
                <h3 className="panel-concept-title">{selectedNode.title}</h3>
              </div>
              <button 
                type="button" 
                className="btn-panel-close" 
                onClick={() => setSelectedNodeId(null)}
                aria-label="Close concept panel"
              >
                <X size={16} />
              </button>
            </div>

            <div className="panel-content-scroll">
              {/* Hierarchy Breadcrumb */}
              {breadcrumb.length > 1 && (
                <div className="panel-breadcrumb">
                  {breadcrumb.map((b, idx) => (
                    <React.Fragment key={b.id}>
                      <button 
                        type="button" 
                        className={`breadcrumb-step ${b.id === selectedNode.id ? 'active' : ''}`}
                        onClick={() => focusNode(b.id)}
                      >
                        {b.title}
                      </button>
                      {idx < breadcrumb.length - 1 && <ChevronRight size={12} className="text-muted" />}
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* AI Concept Summary */}
              <div className="panel-section">
                <div className="panel-section-title">
                  <Sparkles size={13} className="text-accent" />
                  <span>Concept Overview</span>
                </div>
                <p className="panel-summary-text">
                  {selectedNode.summary || `${selectedNode.title} is a key conceptual component defined in this document.`}
                </p>
              </div>

              {/* Grounded Source References */}
              {selectedNode.sourceReferences && selectedNode.sourceReferences.length > 0 && (
                <div className="panel-section">
                  <div className="panel-section-title">
                    <FileText size={13} className="text-accent" />
                    <span>Source Grounding</span>
                  </div>
                  <div className="panel-sources-list">
                    {selectedNode.sourceReferences.map((src, idx) => (
                      <div key={idx} className="panel-source-card">
                        <div className="source-card-header">
                          <span className="source-doc-name truncate">{src.document}</span>
                          <button
                            type="button"
                            className="source-page-badge"
                            onClick={() => onCitationClick && onCitationClick(src.page, [{
                              page_number: src.page,
                              heading: src.heading,
                              content: src.snippet,
                              score: 0.95
                            }])}
                            title="Inspect page citation evidence"
                          >
                            <FileKey size={11} />
                            <span>Page {src.page}</span>
                          </button>
                        </div>
                        {src.snippet && (
                          <p className="source-snippet-quote">"{src.snippet}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related Concepts */}
              {selectedNode.related && selectedNode.related.length > 0 && (
                <div className="panel-section">
                  <div className="panel-section-title">
                    <Network size={13} className="text-accent" />
                    <span>Connected Linkages ({selectedNode.related.length})</span>
                  </div>
                  <div className="panel-related-chips">
                    {selectedNode.related.map((rel, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="panel-related-chip"
                        onClick={() => focusNode(rel.targetId)}
                        title={`Relationship: ${rel.relationship}`}
                      >
                        <span className="rel-tag">{rel.relationship}</span>
                        <span className="rel-name">{rel.targetTitle}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ask AI in Chat Action */}
              <div className="panel-section">
                <button
                  type="button"
                  className="btn-panel-ask"
                  onClick={() => {
                    const query = `Explain the concept of "${selectedNode.title}" in detail based on this document, covering its importance, methodology, and relationships.`;
                    onAskAboutRelationship(query);
                  }}
                >
                  <MessageSquare size={15} />
                  <span>Ask AI about {selectedNode.title}</span>
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
