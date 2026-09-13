import type { GraphDocument } from '../../../src/protocol/types.ts'
import type { DemoSample } from '../types.ts'

/** One stage of a skill pipeline: an AgentNode-style node with a skill icon. */
interface Stage {
  readonly id: string
  readonly label: string
  readonly label2: string
  readonly status: string
  readonly tooltip: string
}

/** Brainstorming skill stages, in execution order. */
const BRAINSTORMING_STAGES: readonly Stage[] = [
  {
    id: 'b-explore',
    label: 'Explore context',
    label2: 'explore',
    status: 'done',
    tooltip: 'Read files, docs, and recent commits',
  },
  {
    id: 'b-clarify',
    label: 'Clarify intent',
    label2: 'clarify',
    status: 'done',
    tooltip: 'Ask questions one at a time',
  },
  {
    id: 'b-approaches',
    label: 'Propose approaches',
    label2: 'approaches',
    status: 'done',
    tooltip: '2-3 options with trade-offs and a recommendation',
  },
  {
    id: 'b-design',
    label: 'Present design',
    label2: 'design',
    status: 'running',
    tooltip: 'Design sections, approval after each',
  },
  {
    id: 'b-spec',
    label: 'Write spec',
    label2: 'spec',
    status: 'idle',
    tooltip: 'Persist the approved design as a note',
  },
  {
    id: 'b-review',
    label: 'Self-review spec',
    label2: 'review',
    status: 'idle',
    tooltip: 'Placeholders, consistency, scope, ambiguity',
  },
  {
    id: 'b-approve',
    label: 'User review',
    label2: 'approve',
    status: 'idle',
    tooltip: 'User reads the spec and requests changes',
  },
  {
    id: 'b-plan',
    label: 'Plan implementation',
    label2: 'plan',
    status: 'idle',
    tooltip: 'Break the spec into an implementation plan',
  },
]

/** Spec Kit (spec-driven development) stages, in execution order. */
const SPECKIT_STAGES: readonly Stage[] = [
  {
    id: 'k-constitution',
    label: 'Constitution',
    label2: 'constitution',
    status: 'done',
    tooltip: 'Establish non-negotiable project principles',
  },
  {
    id: 'k-specify',
    label: 'Specify',
    label2: 'specify',
    status: 'running',
    tooltip: 'Define what to build as a requirements spec',
  },
  {
    id: 'k-clarify',
    label: 'Clarify',
    label2: 'clarify',
    status: 'cold',
    tooltip: 'Optional: disambiguate underspecified areas',
  },
  {
    id: 'k-plan',
    label: 'Plan',
    label2: 'plan',
    status: 'idle',
    tooltip: 'Choose the technical approach and stack',
  },
  {
    id: 'k-tasks',
    label: 'Tasks',
    label2: 'tasks',
    status: 'idle',
    tooltip: 'Break the plan into ordered, checkable tasks',
  },
  {
    id: 'k-analyze',
    label: 'Analyze',
    label2: 'analyze',
    status: 'cold',
    tooltip: 'Optional: cross-artifact consistency check',
  },
  {
    id: 'k-implement',
    label: 'Implement',
    label2: 'implement',
    status: 'idle',
    tooltip: 'Execute tasks against the spec',
  },
]

const ROW_Y = [120, 340] as const

function stageNodes(stages: readonly Stage[], row: 0 | 1): GraphDocument['nodes'] {
  return stages.map((stage, index) => ({
    id: stage.id,
    type: 'agent',
    label: stage.label,
    label2: stage.label2,
    icon: 'skill',
    status: stage.status,
    tooltip: stage.tooltip,
    data: { skill: row === 0 ? 'brainstorming' : 'speckit', step: index + 1 },
    x: 80 + index * 170,
    y: ROW_Y[row],
  }))
}

function chainEdges(stages: readonly Stage[]): GraphDocument['edges'] {
  return stages.slice(1).map((stage, index) => ({
    id: `${stages[0]!.id}-${index + 1}`,
    from: stages[index]!.id,
    to: stage.id,
    kind: 'flow',
  }))
}

export const skillWorkflowDocument: GraphDocument = {
  version: 1,
  meta: { title: 'Skill Workflow', kind: 'flow' },
  nodes: [...stageNodes(BRAINSTORMING_STAGES, 0), ...stageNodes(SPECKIT_STAGES, 1)],
  edges: [...chainEdges(BRAINSTORMING_STAGES), ...chainEdges(SPECKIT_STAGES)],
  groups: [
    {
      id: 'g-brainstorming',
      label: 'Brainstorming',
      memberIds: BRAINSTORMING_STAGES.map(s => s.id),
      expanded: true,
    },
    {
      id: 'g-speckit',
      label: 'Spec Kit',
      memberIds: SPECKIT_STAGES.map(s => s.id),
      expanded: true,
    },
  ],
}

export const skillWorkflowSample: DemoSample = {
  id: 'skill-workflow',
  title: 'Skill Workflow',
  group: 'agents',
  description: 'Brainstorming and Spec Kit skill stages as grouped agent pipelines.',
  document: skillWorkflowDocument,
}
