import { describe, expect, it, vi } from 'vitest'
import { Network } from '../src/network/network.ts'

describe('alarmChanged', () => {
  it('emits alarmChanged for each setAlarms op after apply', () => {
    const network = new Network()
    network.load({
      version: 1,
      nodes: [{ id: 'n1', type: 'agent', label: 'N1', x: 0, y: 0 }],
      edges: [],
    })
    const handler = vi.fn()
    network.on(handler)
    network.apply({
      ops: [{
        op: 'setAlarms',
        target: 'node',
        elementId: 'n1',
        alarms: [{ id: 'a1', level: 'error', message: 'boom' }],
      }],
    })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'alarmChanged',
        elementId: 'n1',
      }),
    )
    const alarmEvent = handler.mock.calls
      .map(c => c[0])
      .find(e => e.type === 'alarmChanged')
    expect(alarmEvent).toEqual({
      type: 'alarmChanged',
      elementId: 'n1',
      alarms: [{ id: 'a1', level: 'error', message: 'boom' }],
    })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'documentChanged', reason: 'apply' }),
    )
  })
})
