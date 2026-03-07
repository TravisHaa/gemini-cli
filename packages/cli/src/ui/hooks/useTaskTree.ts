/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useMemo } from 'react';
import type { IndividualToolCallDisplay, TaskTreeNode } from '../types.js';

/**
 * Builds a TaskTreeNode hierarchy from a flat list of tool calls.
 *
 * Root nodes are calls with no parentCallId.  Every call whose parentCallId
 * matches an existing callId becomes a child of that node.  Calls whose
 * parentCallId references an unknown id are promoted to roots so nothing is
 * silently dropped.
 */
function buildTree(
  toolCalls: IndividualToolCallDisplay[],
  collapsedIds: Set<string>,
  focusedId: string | null,
): TaskTreeNode[] {
  const childrenMap = new Map<string, IndividualToolCallDisplay[]>();
  const roots: IndividualToolCallDisplay[] = [];
  const knownIds = new Set(toolCalls.map((t) => t.callId));

  for (const tool of toolCalls) {
    if (tool.parentCallId && knownIds.has(tool.parentCallId)) {
      const siblings = childrenMap.get(tool.parentCallId) ?? [];
      siblings.push(tool);
      childrenMap.set(tool.parentCallId, siblings);
    } else {
      roots.push(tool);
    }
  }

  function buildNode(
    tool: IndividualToolCallDisplay,
    depth: number,
  ): TaskTreeNode {
    const childCalls = childrenMap.get(tool.callId) ?? [];
    return {
      toolCall: tool,
      children: childCalls.map((c) => buildNode(c, depth + 1)),
      depth,
      isCollapsed: collapsedIds.has(tool.callId),
      isFocused: tool.callId === focusedId,
    };
  }

  return roots.map((r) => buildNode(r, 0));
}

/**
 * Returns a flat, pre-order traversal of a tree, skipping collapsed subtrees.
 * Useful for keyboard navigation.
 */
export function flattenVisibleNodes(nodes: TaskTreeNode[]): TaskTreeNode[] {
  const result: TaskTreeNode[] = [];
  function visit(node: TaskTreeNode) {
    result.push(node);
    if (!node.isCollapsed) {
      node.children.forEach(visit);
    }
  }
  nodes.forEach(visit);
  return result;
}

export interface UseTaskTreeResult {
  /** The hierarchical tree nodes ready to render. */
  nodes: TaskTreeNode[];
  /** Whether there is actually a hierarchy to show (any tool has a parentCallId). */
  hasHierarchy: boolean;
  /** Toggle the collapsed state of a specific node. */
  toggleCollapse: (callId: string) => void;
  /** Collapse all nodes. */
  collapseAll: () => void;
  /** Expand all nodes. */
  expandAll: () => void;
  /** Move keyboard focus to the next visible node. */
  focusNext: () => void;
  /** Move keyboard focus to the previous visible node. */
  focusPrev: () => void;
  /** The callId that currently has keyboard focus, or null. */
  focusedId: string | null;
}

/**
 * Manages the task tree state derived from a flat list of tool calls.
 *
 * @param toolCalls - All tool calls from all active tool_group history items.
 */
export function useTaskTree(
  toolCalls: IndividualToolCallDisplay[],
): UseTaskTreeResult {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const nodes = useMemo(
    () => buildTree(toolCalls, collapsedIds, focusedId),
    [toolCalls, collapsedIds, focusedId],
  );

  const hasHierarchy = useMemo(
    () => toolCalls.some((t) => t.parentCallId),
    [toolCalls],
  );

  const toggleCollapse = useCallback((callId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(callId)) {
        next.delete(callId);
      } else {
        next.add(callId);
      }
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedIds(new Set(toolCalls.map((t) => t.callId)));
  }, [toolCalls]);

  const expandAll = useCallback(() => {
    setCollapsedIds(new Set());
  }, []);

  const focusNext = useCallback(() => {
    const visible = flattenVisibleNodes(nodes);
    if (visible.length === 0) return;
    const idx = visible.findIndex((n) => n.toolCall.callId === focusedId);
    const next = visible[(idx + 1) % visible.length];
    setFocusedId(next.toolCall.callId);
  }, [nodes, focusedId]);

  const focusPrev = useCallback(() => {
    const visible = flattenVisibleNodes(nodes);
    if (visible.length === 0) return;
    const idx = visible.findIndex((n) => n.toolCall.callId === focusedId);
    const prev = visible[(idx - 1 + visible.length) % visible.length];
    setFocusedId(prev.toolCall.callId);
  }, [nodes, focusedId]);

  return {
    nodes,
    hasHierarchy,
    toggleCollapse,
    collapseAll,
    expandAll,
    focusNext,
    focusPrev,
    focusedId,
  };
}
