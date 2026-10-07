import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'usage-band',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

test('terminal shows no band, only what the engine draws', async ($, on) => {
  // Stands in for the engine's own band beneath the plugin.
  on('ui.render', { component: 'AbovePrompt' }, () => h('Box', { key: 'engine' }))
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'engine' })).toBeDefined()
  expect(await ui.find({ key: 'in' })).toBeUndefined()
  expect(await ui.find({ key: 'context' })).toBeUndefined()
  await ui.unmount()
})

test('desktop band is one row of fixed-size, theme-adaptive svg pills', async $ => {
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const pills = await ui.findAll({ type: 'Svg' })
  expect(pills.map(p => p.props.alt)).toEqual(['context unknown', '0 in, 0 out'])
  for (const p of pills) {
    expect(String(p.props.source)).toContain('prefers-color-scheme:dark')
    expect(String(p.props.source)).toContain('font-size:13px')
    expect(typeof p.props.width).toBe('number')
    expect(p.props.height).toBe(26)
  }
  const boxes = await ui.findAll({ type: 'Box' })
  expect(boxes.some(b => b.props.flexWrap === 'wrap')).toBe(false)
  expect(boxes.some(b => b.props.flexWrap === 'nowrap' && b.props.overflow === 'hidden')).toBe(true)
  await ui.unmount()
})
