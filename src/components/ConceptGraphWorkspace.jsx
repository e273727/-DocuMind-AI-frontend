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
  MessageSquare, 
  X, 
  HelpCircle,
  FolderTree,
  FileKey
} from 'lucide-react';
import { API_BASE } from '../config/api';
import { authFetch } from '../utils/auth';

const CATEGORY_COLORS = {
  hardware: { color: '#10b981', border: 'rgba(16, 185, 129, 0.45)', bg: 'rgba(16, 185, 129, 0.1)', glow: 'rgba(16, 185, 129, 0.3)', text: '#6ee7b7' },
  type: { color: '#f59e0b', border: 'rgba(245, 158, 11, 0.45)', bg: 'rgba(245, 158, 11, 0.1)', glow: 'rgba(245, 158, 11, 0.3)', text: '#fcd34d' },
  process: { color: '#f43f5e', border: 'rgba(244, 63, 94, 0.45)', bg: 'rgba(244, 63, 94, 0.1)', glow: 'rgba(244, 63, 94, 0.3)', text: '#fda4af' },
  software: { color: '#0ea5e9', border: 'rgba(14, 165, 233, 0.45)', bg: 'rgba(14, 165, 233, 0.1)', glow: 'rgba(14, 165, 233, 0.3)', text: '#7dd3fc' },
  concept: { color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.45)', bg: 'rgba(139, 92, 246, 0.1)', glow: 'rgba(139, 92, 246, 0.3)', text: '#c4b5fd' }
};

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

  // View Mode: 'mindmap' (two-sided balanced tree) or 'network' (organic 2D force graph)
  const [viewMode, setViewMode] = useState('mindmap');

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

  // Category Theme Helper
  const getCategoryTheme = useCallback((group) => {
    const g = String(group || '').toLowerCase();
    if (g.includes('hardware') || g.includes('device') || g.includes('resource') || g.includes('cpu') || g.includes('memory') || g.includes('gpu')) return CATEGORY_COLORS.hardware;
    if (g.includes('type') || g.includes('model') || g.includes('class') || g.includes('paradigm')) return CATEGORY_COLORS.type;
    if (g.includes('process') || g.includes('schedul') || g.includes('concurr') || g.includes('thread') || g.includes('starvat') || g.includes('time')) return CATEGORY_COLORS.process;
    if (g.includes('soft') || g.includes('app') || g.includes('user') || g.includes('system') || g.includes('os')) return CATEGORY_COLORS.software;
    return CATEGORY_COLORS.concept;
  }, []);

  // Node Dimensions Helper
  const getNodeDimensions = useCallback((level) => {
    switch (level) {
      case 0: return { width: 210, height: 50, rx: 25 };
      case 1: return { width: 185, height: 46, rx: 10 };
      case 2: return { width: 165, height: 40, rx: 8 };
      default: return { width: 150, height: 36, rx: 6 };
    }
  }, []);

  // Fetch concept graph
  useEffect(() => {
    if (activeDoc && activeDoc.status === 'processed') {
      fetchGraph(activeDoc.id);
    } else {
      setGraphData(null);
      setSelectedNodeId(null);
    }
  }, [activeDoc?.id, activeDoc?.status]);

  const fetchGraph = async (docId, forceRegenerate = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = forceRegenerate 
        ? `${API_BASE}/documents/${docId}/graph/generate`
        : `${API_BASE}/documents/${docId}/graph`;
      const options = forceRegenerate ? { method: 'POST' } : {};
      const res = await authFetch(url, options, token);
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
          setSelectedNodeId(root.id);
        }
        // Expand level 1 nodes so primary branches are immediately readable
        g.nodes.filter(n => n.level === 1).forEach(n => defaultExpanded.add(n.id));
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

  // Two-Sided Balanced Mind Map Layout Calculation
  const mindmapLayout = useMemo(() => {
    if (!rootNode || !graphData) return { nodes: [], links: [] };

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
    if (!rootHierarchyData) return { nodes: [], links: [] };

    const rootDim = getNodeDimensions(0);
    const layoutNodes = [];
    const layoutLinks = [];

    // Root placed at (0, 0) in center
    layoutNodes.push({
      id: rootHierarchyData.id,
      title: rootHierarchyData.title || rootHierarchyData.id,
      group: rootHierarchyData.group,
      level: 0,
      summary: rootHierarchyData.summary,
      sourceReferences: rootHierarchyData.sourceReferences,
      related: rootHierarchyData.related,
      totalChildren: rootHierarchyData._totalChildren,
      isExpanded: rootHierarchyData._isExpanded,
      x: -rootDim.width / 2,
      y: -rootDim.height / 2,
      width: rootDim.width,
      height: rootDim.height,
      rx: rootDim.rx,
      side: 'center',
      depth: 0
    });

    const rootChildren = rootHierarchyData.children || [];
    if (rootChildren.length > 0) {
      // Split branches: half to the Right, half to the Left
      const half = Math.ceil(rootChildren.length / 2);
      const rightBranches = rootChildren.slice(0, half);
      const leftBranches = rootChildren.slice(half);

      const processBranchSide = (branches, side) => {
        if (!branches || branches.length === 0) return;

        const dummyRoot = {
          id: '__dummy__',
          children: branches
        };
        const hierarchy = d3.hierarchy(dummyRoot);

        const treeLayout = d3.tree()
          .nodeSize([54, 250])
          .separation((a, b) => (a.parent === b.parent ? 1.15 : 1.3));

        treeLayout(hierarchy);

        // Map layout nodes
        hierarchy.each(d => {
          if (d.depth === 0) return;
          const dim = getNodeDimensions(d.data.level);

          let x, y;
          if (side === 'right') {
            x = (rootDim.width / 2 + 75) + (d.depth - 1) * 245;
            y = d.x - dim.height / 2;
          } else {
            x = -(rootDim.width / 2 + 75) - (d.depth - 1) * 245 - dim.width;
            y = d.x - dim.height / 2;
          }

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
            side,
            depth: d.depth
          });
        });

        // Map branch links
        hierarchy.links().forEach(link => {
          if (link.source.depth === 0) {
            const tNode = layoutNodes.find(n => n.id === link.target.data.id);
            if (!tNode) return;

            const directRel = graphData.links?.find(l => 
              l.source === rootNode.id && l.target === tNode.id
            )?.relationship;
            const revRel = graphData.links?.find(l => 
              l.source === tNode.id && l.target === rootNode.id
            )?.relationship;

            let sourcePt, targetPt;
            if (side === 'right') {
              sourcePt = { x: rootDim.width / 2, y: 0 };
              targetPt = { x: tNode.x - 4, y: tNode.y + tNode.height / 2 };
            } else {
              sourcePt = { x: -rootDim.width / 2, y: 0 };
              targetPt = { x: tNode.x + tNode.width + 4, y: tNode.y + tNode.height / 2 };
            }

            layoutLinks.push({
              id: `${rootNode.id}->${tNode.id}`,
              sourceId: rootNode.id,
              targetId: tNode.id,
              source: sourcePt,
              target: targetPt,
              side,
              isTreeLink: true,
              relationship: directRel || revRel || 'encompasses'
            });
          } else {
            const sNode = layoutNodes.find(n => n.id === link.source.data.id);
            const tNode = layoutNodes.find(n => n.id === link.target.data.id);
            if (!sNode || !tNode) return;

            const directRel = graphData.links?.find(l => 
              l.source === sNode.id && l.target === tNode.id
            )?.relationship;
            const revRel = graphData.links?.find(l => 
              l.source === tNode.id && l.target === sNode.id
            )?.relationship;

            let sourcePt, targetPt;
            if (side === 'right') {
              sourcePt = { x: sNode.x + sNode.width, y: sNode.y + sNode.height / 2 };
              targetPt = { x: tNode.x - 4, y: tNode.y + tNode.height / 2 };
            } else {
              sourcePt = { x: sNode.x, y: sNode.y + sNode.height / 2 };
              targetPt = { x: tNode.x + tNode.width + 4, y: tNode.y + tNode.height / 2 };
            }

            layoutLinks.push({
              id: `${sNode.id}->${tNode.id}`,
              sourceId: sNode.id,
              targetId: tNode.id,
              source: sourcePt,
              target: targetPt,
              side,
              isTreeLink: true,
              relationship: directRel || revRel || 'contains'
            });
          }
        });
      };

      processBranchSide(rightBranches, 'right');
      processBranchSide(leftBranches, 'left');
    }

    // Cross-cutting links between visible nodes
    const visibleMap = new Map(layoutNodes.map(n => [n.id, n]));
    if (graphData.links) {
      graphData.links.forEach(l => {
        const s = visibleMap.get(l.source);
        const t = visibleMap.get(l.target);
        if (s && t && s.id !== t.id) {
          const isTree = layoutLinks.some(tl => (tl.sourceId === s.id && tl.targetId === t.id) || (tl.sourceId === t.id && tl.targetId === s.id));
          if (!isTree) {
            let sourcePt = { x: s.x + s.width / 2, y: s.y + s.height / 2 };
            let targetPt = { x: t.x + t.width / 2, y: t.y + t.height / 2 };

            if (t.x > s.x + s.width) {
              sourcePt = { x: s.x + s.width, y: s.y + s.height / 2 };
              targetPt = { x: t.x - 4, y: t.y + t.height / 2 };
            } else if (t.x + t.width < s.x) {
              sourcePt = { x: s.x, y: s.y + s.height / 2 };
              targetPt = { x: t.x + t.width + 4, y: t.y + t.height / 2 };
            } else if (t.y > s.y) {
              sourcePt = { x: s.x + s.width / 2, y: s.y + s.height };
              targetPt = { x: t.x + t.width / 2, y: t.y - 4 };
            } else {
              sourcePt = { x: s.x + s.width / 2, y: s.y };
              targetPt = { x: t.x + t.width / 2, y: t.y + t.height + 4 };
            }

            layoutLinks.push({
              id: `rel:${s.id}->${t.id}`,
              sourceId: s.id,
              targetId: t.id,
              source: sourcePt,
              target: targetPt,
              isTreeLink: false,
              relationship: l.relationship || 'relates to'
            });
          }
        }
      });
    }

    return { nodes: layoutNodes, links: layoutLinks };
  }, [rootNode, graphData, expandedNodes, nodeMap, getNodeDimensions]);

  // Force Network Layout Calculation
  const networkLayout = useMemo(() => {
    if (!graphData?.nodes || graphData.nodes.length === 0) return { nodes: [], links: [] };

    // Visible nodes based on expanded ancestors
    const visibleNodes = graphData.nodes.filter(n => {
      if (n.id === rootNode?.id) return true;
      if (!n.parent) return true;
      let curr = n.parent;
      let safety = 0;
      while (curr && safety++ < 10) {
        if (!expandedNodes.has(curr)) return false;
        const pNode = nodeMap.get(curr);
        curr = pNode ? pNode.parent : null;
      }
      return true;
    });

    const netNodes = visibleNodes.map(n => {
      const dim = getNodeDimensions(n.level);
      return {
        ...n,
        width: dim.width,
        height: dim.height,
        rx: dim.rx,
        x: (Math.random() - 0.5) * 400,
        y: (Math.random() - 0.5) * 400
      };
    });

    const netMap = new Map(netNodes.map(n => [n.id, n]));
    const netLinks = (graphData.links || [])
      .filter(l => netMap.has(l.source) && netMap.has(l.target))
      .map(l => ({
        id: `${l.source}->${l.target}`,
        source: l.source,
        target: l.target,
        sourceId: l.source,
        targetId: l.target,
        relationship: l.relationship || 'relates to',
        isTreeLink: false
      }));

    const simulation = d3.forceSimulation(netNodes)
      .force('link', d3.forceLink(netLinks).id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius(80))
      .stop();

    for (let i = 0; i < 120; ++i) simulation.tick();

    const finalLinks = netLinks.map(l => {
      const s = typeof l.source === 'object' ? l.source : netMap.get(l.source);
      const t = typeof l.target === 'object' ? l.target : netMap.get(l.target);
      return {
        ...l,
        source: { x: s.x, y: s.y },
        target: { x: t.x, y: t.y }
      };
    });

    const finalNodes = netNodes.map(n => ({
      ...n,
      x: n.x - n.width / 2,
      y: n.y - n.height / 2
    }));

    return { nodes: finalNodes, links: finalLinks };
  }, [graphData, rootNode, expandedNodes, nodeMap, getNodeDimensions]);

  // Active Layout Selection
  const layout = viewMode === 'network' ? networkLayout : mindmapLayout;

  // Fit view helper
  const handleFitView = useCallback(() => {
    if (!svgRef.current || !layout.nodes || layout.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const bounds = {
      minX: d3.min(layout.nodes, d => d.x) || -400,
      maxX: d3.max(layout.nodes, d => d.x + d.width) || 400,
      minY: d3.min(layout.nodes, d => d.y) || -300,
      maxY: d3.max(layout.nodes, d => d.y + d.height) || 300,
    };

    const width = containerRef.current ? containerRef.current.clientWidth : 1000;
    const height = containerRef.current ? containerRef.current.clientHeight : 700;

    const effectiveWidth = selectedNodeId ? Math.max(width - 360, 400) : width;

    const dx = bounds.maxX - bounds.minX;
    const dy = bounds.maxY - bounds.minY;
    const x = (bounds.minX + bounds.maxX) / 2;
    const y = (bounds.minY + bounds.maxY) / 2;

    const scale = Math.max(0.45, Math.min(1.0, 0.82 / Math.max(dx / effectiveWidth, dy / height)));
    const translate = [effectiveWidth / 2 - scale * x, height / 2 - scale * y];

    if (zoomBehaviorRef.current) {
      svg.transition()
        .duration(650)
        .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
    }
  }, [layout.nodes, selectedNodeId]);

  // Setup D3 Zoom & Pan
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const zoomGroup = d3.select(zoomGroupRef.current);

    const zoom = d3.zoom()
      .scaleExtent([0.25, 2.5])
      .on('zoom', (event) => {
        zoomGroup.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Center fit on graph update or view switch
    handleFitView();
    svg.on('dblclick.zoom', null);

  }, [graphData?.rootId, viewMode, layout.nodes.length, handleFitView]);

  // Smooth Focus on a specific node
  const focusNode = useCallback((nodeId) => {
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

    setTimeout(() => {
      const targetNode = layout.nodes.find(n => n.id === nodeId);
      if (targetNode && svgRef.current && zoomBehaviorRef.current) {
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
    }, 60);
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
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.3);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.75);
  };

  const handleResetZoom = () => {
    handleFitView();
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
    <div className="concept-workspace" ref={containerRef}>
      {/* 1. Header Toolbar */}
      <div className="concept-toolbar">
        <div className="toolbar-left">
          <button 
            type="button" 
            className="btn-toolbar-back" 
            onClick={onSwitchToChat}
            title="Return to Grounded Document Chat"
          >
            <ArrowLeft size={16} />
            <span className="btn-label hide-mobile">Chat View</span>
          </button>

          <div className="toolbar-divider" />

          {/* View Mode Switcher */}
          <div className="view-mode-pill-group">
            <button
              type="button"
              className={`btn-mode-pill ${viewMode === 'mindmap' ? 'active' : ''}`}
              onClick={() => setViewMode('mindmap')}
              title="Two-sided balanced mind map layout"
            >
              <FolderTree size={13} />
              <span>Mind Map</span>
            </button>
            <button
              type="button"
              className={`btn-mode-pill ${viewMode === 'network' ? 'active' : ''}`}
              onClick={() => setViewMode('network')}
              title="Interactive force-directed knowledge network"
            >
              <Network size={13} />
              <span>Network</span>
            </button>
          </div>

          <span className="graph-stats hide-tablet">
            {graphData?.nodes?.length || 0} Concepts • {graphData?.links?.length || 0} Relations
          </span>
        </div>

        {/* Center: Search & Concept Finder */}
        <div className="toolbar-center">
          <div className="concept-search-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              placeholder="Search concepts or topics..."
              className="concept-search-input"
            />
            {searchQuery && (
              <button 
                type="button" 
                className="btn-clear-search" 
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }}
              >
                <X size={12} />
              </button>
            )}

            {/* Quick Filter Dropdown */}
            {isSearchOpen && searchResults.length > 0 && (
              <div className="concept-search-dropdown">
                {searchResults.map(result => (
                  <button
                    key={result.id}
                    type="button"
                    className="search-result-item"
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

          <button 
            type="button" 
            className="btn-toolbar-ghost btn-regenerate" 
            onClick={() => activeDoc && fetchGraph(activeDoc.id, true)}
            disabled={loading}
            title="Regenerate concept graph relations with AI"
          >
            <Sparkles size={14} className={loading ? 'spin' : 'text-accent'} />
            <span className="hide-mobile">Regenerate AI</span>
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
              {/* Dot Grid Canvas Pattern for tactile depth */}
              <pattern id="dotGrid" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.1" fill="rgba(255, 255, 255, 0.05)" />
              </pattern>

              {/* Linear Gradients for Nodes */}
              <linearGradient id="rootGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.9" />
                <stop offset="50%" stopColor="#7c3aed" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.9" />
              </linearGradient>

              {/* Arrowhead Markers */}
              <marker
                id="mindmap-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="rgba(139, 92, 246, 0.45)" />
              </marker>

              <marker
                id="mindmap-arrow-active"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#a78bfa" />
              </marker>

              <marker
                id="mindmap-arrow-left"
                viewBox="0 0 10 10"
                refX="2"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 8 1.5 L 0 5 L 8 8.5 z" fill="rgba(139, 92, 246, 0.45)" />
              </marker>

              <marker
                id="mindmap-arrow-left-active"
                viewBox="0 0 10 10"
                refX="2"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 8 1.5 L 0 5 L 8 8.5 z" fill="#a78bfa" />
              </marker>

              <marker
                id="mindmap-arrow-cross"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="rgba(244, 114, 182, 0.65)" />
              </marker>

              <marker
                id="mindmap-arrow-cross-active"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f472b6" />
              </marker>
            </defs>

            {/* Subtle Dot Grid Canvas Background */}
            <rect width="100%" height="100%" fill="url(#dotGrid)" />

            <g ref={zoomGroupRef} id="mindmap-zoom-group">
              {/* Links Layer */}
              <g className="links-layer">
                {layout.links.map(link => {
                  const isConnected = connectedLinkIds.has(link.id);
                  const isTree = link.isTreeLink;
                  const isLeft = link.side === 'left';

                  const dx = link.target.x - link.source.x;
                  const dy = link.target.y - link.source.y;
                  
                  // Smooth organic cubic curve for trees, gentle arched curve for cross links
                  const path = isTree
                    ? `M ${link.source.x} ${link.source.y} C ${link.source.x + dx * 0.45} ${link.source.y}, ${link.target.x - dx * 0.45} ${link.target.y}, ${link.target.x} ${link.target.y}`
                    : `M ${link.source.x} ${link.source.y} Q ${(link.source.x + link.target.x) / 2} ${(link.source.y + link.target.y) / 2 - 25}, ${link.target.x} ${link.target.y}`;

                  const midX = (link.source.x + link.target.x) / 2;
                  const midY = (link.source.y + link.target.y) / 2 - (isTree ? 10 : 20);

                  const marker = isConnected
                    ? (isTree ? (isLeft ? "url(#mindmap-arrow-left-active)" : "url(#mindmap-arrow-active)") : "url(#mindmap-arrow-cross-active)")
                    : (isTree ? (isLeft ? "url(#mindmap-arrow-left)" : "url(#mindmap-arrow)") : "url(#mindmap-arrow-cross)");

                  return (
                    <g key={link.id} className={`link-group ${isConnected ? 'active' : ''}`}>
                      <path
                        d={path}
                        className={`mindmap-link ${isTree ? 'tree-link' : 'cross-link'} ${isConnected ? 'active-link' : ''}`}
                        markerEnd={marker}
                        style={{
                          opacity: activeFocusId ? (isConnected ? 1 : 0.08) : (isTree ? 0.45 : 0.28)
                        }}
                      />
                      {/* Relationship badge displayed cleanly when hovered/focused */}
                      {isConnected && link.relationship && (
                        <g 
                          className="link-badge-group active"
                          transform={`translate(${midX}, ${midY})`}
                          style={{ pointerEvents: 'none' }}
                        >
                          <rect
                            x={-(Math.min(Math.max((link.relationship.length * 3.6) + 8, 30), 80))}
                            y={-9}
                            width={Math.min(Math.max((link.relationship.length * 7.2) + 16, 60), 160)}
                            height={18}
                            rx={9}
                            className={`link-badge-bg ${isTree ? 'tree' : 'cross'} active`}
                          />
                          <text
                            y={3.5}
                            className="link-badge-text active"
                            textAnchor="middle"
                          >
                            {link.relationship}
                          </text>
                        </g>
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
                  const theme = getCategoryTheme(node.group);

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
                        opacity: isDimmed ? 0.25 : 1,
                        transition: 'opacity 0.2s, transform 0.2s'
                      }}
                    >
                      {/* Main Node Card Pill */}
                      <rect
                        width={node.width}
                        height={node.height}
                        rx={node.rx}
                        className={`node-pill level-${node.level} ${isSelected ? 'active-pill' : ''}`}
                        fill={isRoot ? "url(#rootGradient)" : "rgba(18, 22, 36, 0.88)"}
                        stroke={isRoot ? "#a78bfa" : (isSelected ? theme.color : theme.border)}
                        strokeWidth={isRoot ? 2 : (isSelected ? 1.8 : 1.2)}
                        style={{
                          filter: isSelected ? `drop-shadow(0 0 10px ${theme.glow})` : undefined
                        }}
                      />

                      {/* Accent color bar for Level 1 category pillars */}
                      {!isRoot && node.level === 1 && (
                        <rect
                          x={node.side === 'left' ? node.width - 4 : 0}
                          y={6}
                          width={4}
                          height={node.height - 12}
                          rx={2}
                          fill={theme.color}
                        />
                      )}

                      {/* Sparkle icon for Root */}
                      {isRoot && (
                        <g transform="translate(14, 15)">
                          <circle cx="10" cy="10" r="10" fill="rgba(255, 255, 255, 0.2)" />
                          <path
                            d="M10 3 L12 8 L17 10 L12 12 L10 17 L8 12 L3 10 L8 8 Z"
                            fill="#ffffff"
                          />
                        </g>
                      )}

                      {/* Node Title */}
                      <text
                        x={isRoot ? 40 : (node.side === 'left' && node.level === 1 ? 12 : (node.side === 'right' && node.level === 1 ? 16 : 14))}
                        y={node.level === 0 ? 30 : 20}
                        className={`node-title level-${node.level}`}
                        style={{
                          fill: '#f8fafc',
                          fontSize: isRoot ? '13.5px' : '11.5px',
                          fontWeight: isRoot ? 700 : 600,
                          letterSpacing: '-0.01em'
                        }}
                      >
                        {node.title.length > (node.level === 0 ? 22 : 20) 
                          ? `${node.title.slice(0, (node.level === 0 ? 20 : 18))}…` 
                          : node.title}
                      </text>

                      {/* Category Subtitle */}
                      {node.level > 0 && (
                        <text
                          x={node.side === 'left' && node.level === 1 ? 12 : (node.side === 'right' && node.level === 1 ? 16 : 14)}
                          y={32}
                          className="node-group-label"
                          style={{
                            fill: theme.text,
                            fontSize: '8.5px',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                          }}
                        >
                          {node.group || 'Concept'}
                        </text>
                      )}

                      {/* Expand / Collapse Indicator Pill (+ / −) positioned on outer edge */}
                      {node.totalChildren > 0 && !isRoot && (
                        <g 
                          className="node-expander-btn"
                          transform={`translate(${node.side === 'left' ? 0 : node.width}, ${node.height / 2})`}
                          onClick={(e) => toggleNodeExpansion(node.id, e)}
                          title={node.isExpanded ? "Collapse subtopics" : `Expand ${node.totalChildren} subtopics`}
                        >
                          <circle 
                            cx="0" 
                            cy="0" 
                            r="9.5" 
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

        {/* 3. Floating Canvas Minimal Controls */}
        <div className="mindmap-floating-controls">
          <button 
            type="button" 
            className="floating-ctrl-btn" 
            onClick={handleZoomIn}
            title="Zoom In"
          >
            <Plus size={15} />
          </button>
          <button 
            type="button" 
            className="floating-ctrl-btn" 
            onClick={handleZoomOut}
            title="Zoom Out"
          >
            <Minus size={15} />
          </button>
          <button 
            type="button" 
            className="floating-ctrl-btn" 
            onClick={handleResetZoom}
            title="Fit to Center"
          >
            <Maximize2 size={14} />
          </button>
        </div>

        {/* 4. Detail Side Panel on Node Selection */}
        {selectedNode && (
          <aside className="mindmap-side-panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <span className="panel-concept-level">
                  Level {selectedNode.level} • {selectedNode.group || 'Core Concept'}
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

            {/* Breadcrumb Hierarchy Path */}
            {breadcrumb.length > 1 && (
              <div className="panel-breadcrumb">
                {breadcrumb.map((step, idx) => (
                  <React.Fragment key={step.id}>
                    <button 
                      type="button" 
                      className={`breadcrumb-step ${step.id === selectedNode.id ? 'active' : ''}`}
                      onClick={() => focusNode(step.id)}
                    >
                      {step.title}
                    </button>
                    {idx < breadcrumb.length - 1 && <ChevronRight size={11} className="breadcrumb-arrow" />}
                  </React.Fragment>
                ))}
              </div>
            )}

            <div className="panel-body">
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

              {/* Source Passage References */}
              {selectedNode.sourceReferences && selectedNode.sourceReferences.length > 0 && (
                <div className="panel-section">
                  <div className="panel-section-title">
                    <FileText size={13} className="text-accent" />
                    <span>Grounded Document Evidence ({selectedNode.sourceReferences.length})</span>
                  </div>
                  <div className="panel-sources-list">
                    {selectedNode.sourceReferences.map((src, idx) => (
                      <div key={idx} className="panel-source-card">
                        <div className="source-card-header">
                          <span className="source-heading">{src.heading || 'Document Passage'}</span>
                          <button 
                            type="button" 
                            className="source-page-badge"
                            onClick={() => onCitationClick && onCitationClick({ page: src.page, document: src.document })}
                            title="Jump to page in PDF"
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
                        className={`panel-related-chip ${rel.direction || 'outgoing'}`}
                        onClick={() => focusNode(rel.targetId)}
                        title={`${rel.direction === 'incoming' ? 'Pointed from' : 'Points to'} ${rel.targetTitle}: ${rel.relationship}`}
                      >
                        <div className="chip-header">
                          <span className={`rel-dir-badge ${rel.direction || 'outgoing'}`}>
                            {rel.direction === 'incoming' ? '◀ pointed by' : 'points to ▶'}
                          </span>
                          <span className="rel-tag">{rel.relationship}</span>
                        </div>
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
