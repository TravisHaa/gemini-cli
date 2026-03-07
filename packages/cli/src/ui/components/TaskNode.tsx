/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { CoreToolCallStatus } from '@google/gemini-cli-core';
import { CliSpinner } from './CliSpinner.js';
import { ToolResultDisplay } from './messages/ToolResultDisplay.js';
import { theme } from '../semantic-colors.js';
import type { TaskTreeNode } from '../types.js';

// ── Tree-drawing characters ──────────────────────────────────────────────────
// We use single-line box-drawing so the tree looks clean on all terminals.
const BRANCH = '├─ ';
const LAST = '└─ ';
const PIPE = '│  ';
const BLANK = '   ';

// ── Status glyphs (kept distinct from ToolShared so the tree can use its own
//    icon set that's more appropriate for a compact tree row) ─────────────────
function statusGlyph(status: CoreToolCallStatus): {
  text: string;
  color: string;
} {
  switch (status) {
    case CoreToolCallStatus.Success:
      return { text: '✓', color: theme.status.success };
    case CoreToolCallStatus.Error:
      return { text: '✗', color: theme.status.error };
    case CoreToolCallStatus.Cancelled:
      return { text: '⊘', color: theme.text.secondary };
    case CoreToolCallStatus.Executing:
      return { text: '●', color: theme.status.warning };
    case CoreToolCallStatus.AwaitingApproval:
      return { text: '?', color: theme.status.warning };
    case CoreToolCallStatus.Scheduled:
      return { text: '◷', color: theme.text.secondary };
    case CoreToolCallStatus.Validating:
    default:
      return { text: '◌', color: theme.text.secondary };
  }
}

interface TaskNodeProps {
  node: TaskTreeNode;
  /** Characters to prepend that come from ancestor nodes (pipe/blank). */
  prefix: string;
  /** True when this is the last sibling at its level. */
  isLast: boolean;
  terminalWidth: number;
}

/**
 * Renders a single row in the task tree, including its branch connector,
 * status icon, tool name, description, and — when expanded — the tool's
 * output and its children.
 */
export const TaskNode: React.FC<TaskNodeProps> = ({
  node,
  prefix,
  isLast,
  terminalWidth,
}) => {
  const { toolCall, children, isCollapsed, isFocused } = node;
  const glyph = statusGlyph(toolCall.status);
  const isRunning = toolCall.status === CoreToolCallStatus.Executing;
  const hasChildren = children.length > 0;
  const hasOutput =
    toolCall.resultDisplay !== undefined && toolCall.resultDisplay !== '';

  // The connector that links this node to its parent's branch line.
  const connector = isLast ? LAST : BRANCH;
  // The prefix that child nodes will inherit from this level.
  const childPrefix = prefix + (isLast ? BLANK : PIPE);

  // Collapse toggle indicator shown next to nodes that can be expanded.
  const collapseToggle =
    hasChildren || hasOutput ? (isCollapsed ? ' [+]' : ' [-]') : '';

  // Color used for the collapse hint: highlighted when this node is focused.
  const collapseHintColor = isFocused ? theme.text.accent : theme.text.secondary;

  return (
    <Box flexDirection="column">
      {/* ── Row ── */}
      <Box flexDirection="row" flexShrink={0}>
        {/* Indent prefix from ancestors */}
        <Text color={theme.text.secondary}>{prefix}</Text>

        {/* Branch connector */}
        <Text color={theme.text.secondary}>{connector}</Text>

        {/* Status icon — spinner when running */}
        <Box minWidth={2} flexShrink={0}>
          {isRunning ? (
            <Text color={glyph.color}>
              <CliSpinner type="toggle" />
            </Text>
          ) : (
            <Text color={glyph.color}>{glyph.text}</Text>
          )}
          <Text> </Text>
        </Box>

        {/* Tool name */}
        <Text
          color={
            toolCall.status === CoreToolCallStatus.Cancelled
              ? theme.text.secondary
              : theme.text.primary
          }
          bold
          strikethrough={toolCall.status === CoreToolCallStatus.Cancelled}
          wrap="truncate"
        >
          {toolCall.name}
        </Text>

        {/* Description (args summary) */}
        {toolCall.description ? (
          <Text color={theme.text.secondary} wrap="truncate">
            {'  '}
            {toolCall.description}
          </Text>
        ) : null}

        {/* Collapse toggle hint (keyboard: →/← or Enter on focused node) */}
        {collapseToggle ? (
          <Text color={collapseHintColor}>{collapseToggle}</Text>
        ) : null}
      </Box>

      {/* ── Inline output (shown when not collapsed) ── */}
      {!isCollapsed && hasOutput && (
        <Box flexDirection="row">
          {/* Continuation pipe from this node */}
          <Text color={theme.text.secondary}>
            {childPrefix}
            {'   '}
          </Text>
          <Box flexDirection="column" flexShrink={1} flexGrow={1}>
            <ToolResultDisplay
              resultDisplay={toolCall.resultDisplay}
              terminalWidth={
                terminalWidth - (childPrefix.length + 3) /* indent */
              }
              renderOutputAsMarkdown={toolCall.renderOutputAsMarkdown}
            />
          </Box>
        </Box>
      )}

      {/* ── Children (shown when not collapsed) ── */}
      {!isCollapsed &&
        children.map((child, idx) => (
          <TaskNode
            key={child.toolCall.callId}
            node={child}
            prefix={childPrefix}
            isLast={idx === children.length - 1}
            terminalWidth={terminalWidth}
          />
        ))}
    </Box>
  );
};
