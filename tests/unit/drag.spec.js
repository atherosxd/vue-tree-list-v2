import Vue from 'vue'
import { mount } from '@vue/test-utils'
import { Tree, VueTreeList } from '@/index'

const ROW_HEIGHT = 20

const dataTransfer = () => ({ setData: () => {}, effectAllowed: '', dropEffect: '' })

// jsdom has no layout: give a row a fixed box so the pointer offset can be measured.
const row = (wrapper, id) => {
  const $row = wrapper.find(`#${id} > .vtl-node-main`)
  $row.element.getBoundingClientRect = () => ({ top: 0, height: ROW_HEIGHT })
  return $row
}

// Pointer at a fraction of the row's height: 0 = top edge, 1 = bottom edge.
const dragOver = ($row, at) =>
  $row.trigger('dragover', { clientY: at * ROW_HEIGHT, dataTransfer: dataTransfer() })

const dragStart = (wrapper, id) =>
  row(wrapper, id).trigger('dragstart', { dataTransfer: dataTransfer() })

const drop = wrapper => wrapper.trigger('drop', { dataTransfer: dataTransfer() })

const topLevelIds = wrapper => wrapper.vm.model.children.map(node => node.id)

describe('Drag', () => {
  let wrapper

  beforeEach(() => {
    const tree = new Tree([
      {
        name: 'Node 1',
        id: 't1',
        pid: 0,
        children: [
          {
            name: 'Node 1-1',
            id: 't11',
            isLeaf: true,
            pid: 't1'
          },
          {
            name: 'Node 1-2',
            id: 't12',
            pid: 't1'
          }
        ]
      },
      {
        name: 'Node 2',
        id: 't2',
        pid: 0
      },
      {
        name: 'Node 3',
        id: 't3',
        pid: 0
      }
    ])
    wrapper = mount(VueTreeList, { propsData: { model: new Tree([]) } })
    wrapper.setProps({ model: tree })
  })

  afterEach(() => {
    // End any drag a test left open; drag state is shared by every tree.
    const $any = wrapper.find('.vtl-node-main')
    if ($any.exists()) $any.trigger('dragend')
    wrapper.destroy()
  })

  it('previews and drops before a row (top quarter)', async () => {
    dragStart(wrapper, 't3')
    dragOver(row(wrapper, 't2'), 0.1)
    await Vue.nextTick()

    const $ghost = wrapper.find('.vtl-drop-ghost')
    expect($ghost.exists()).toBe(true)
    expect($ghost.classes()).toContain('vtl-drop-ghost--before')
    expect($ghost.text()).toContain('Node 3')
    expect($ghost.find('.vtl-drop-tag').text()).toBe('↑ Before')
    // The preview sits right above the target row, at the same level.
    expect($ghost.element.nextElementSibling.id).toBe('t2')

    drop(wrapper)
    await Vue.nextTick()
    expect(topLevelIds(wrapper)).toEqual(['t1', 't3', 't2'])
    expect(wrapper.emitted('drop-before')[0][0].target.id).toBe('t2')
    expect(wrapper.find('.vtl-drop-ghost').exists()).toBe(false)
  })

  it('previews and drops after a row (bottom quarter)', async () => {
    dragStart(wrapper, 't2')
    dragOver(row(wrapper, 't3'), 0.9)
    await Vue.nextTick()

    const $ghost = wrapper.find('.vtl-drop-ghost')
    expect($ghost.classes()).toContain('vtl-drop-ghost--after')
    expect($ghost.find('.vtl-drop-tag').text()).toBe('↓ After')

    drop(wrapper)
    await Vue.nextTick()
    expect(topLevelIds(wrapper)).toEqual(['t1', 't3', 't2'])
    expect(wrapper.emitted('drop-after')[0][0].node.id).toBe('t2')
  })

  it('previews a child drop indented under the target and drops it as the first child', async () => {
    dragStart(wrapper, 't3')
    dragOver(row(wrapper, 't2'), 0.5)
    await Vue.nextTick()

    const $ghost = wrapper.find('.vtl-drop-ghost')
    expect($ghost.classes()).toContain('vtl-drop-ghost--into')
    expect($ghost.find('.vtl-drop-tag').text()).toBe('↳ Into')
    // Indented one level, like the target's own children.
    expect($ghost.element.parentElement.classList).toContain('vtl-tree-margin')
    expect(wrapper.find('#t2 > .vtl-node-main').classes()).toContain('vtl-drop-target')

    drop(wrapper)
    await Vue.nextTick()
    expect(topLevelIds(wrapper)).toEqual(['t1', 't2'])
    expect(wrapper.find('#t2 + .vtl-tree-margin .vtl-node').attributes('id')).toBe('t3')
    expect(wrapper.emitted('drop')[0][0].target.id).toBe('t2')
  })

  it('treats the bottom of an open parent as its first-child spot', async () => {
    dragStart(wrapper, 't3')
    dragOver(row(wrapper, 't1'), 0.9)
    await Vue.nextTick()

    expect(wrapper.find('.vtl-drop-ghost').classes()).toContain('vtl-drop-ghost--into')

    drop(wrapper)
    await Vue.nextTick()
    expect(wrapper.vm.model.children[0].children.map(node => node.id)).toEqual(['t3', 't11', 't12'])
  })

  it('never drops into a leaf: upper half is before, lower half is after', async () => {
    dragStart(wrapper, 't3')
    const $leaf = row(wrapper, 't11')

    dragOver($leaf, 0.45)
    await Vue.nextTick()
    expect(wrapper.find('.vtl-drop-ghost').classes()).toContain('vtl-drop-ghost--before')

    dragOver($leaf, 0.55)
    await Vue.nextTick()
    expect(wrapper.find('.vtl-drop-ghost').classes()).toContain('vtl-drop-ghost--after')
  })

  // The preview must never take over a row's own elements. If it did, a slot component
  // that caches its props (e-GPA's treeview-row) would keep showing the dragged node.
  it('keeps the hovered row its own elements while the preview moves around it', async () => {
    const rowEl = wrapper.find('#t2').element
    const contentEl = wrapper.find('#t2 .vtl-node-content').element
    dragStart(wrapper, 't3')

    dragOver(row(wrapper, 't2'), 0.5)
    await Vue.nextTick()
    dragOver(row(wrapper, 't2'), 0.1)
    await Vue.nextTick()

    expect(wrapper.find('.vtl-drop-ghost').classes()).toContain('vtl-drop-ghost--before')
    expect(wrapper.find('#t2').element).toBe(rowEl)
    expect(wrapper.find('#t2 .vtl-node-content').element).toBe(contentEl)
    expect(wrapper.find('#t2 .vtl-node-content').text()).toBe('Node 2')
  })

  it('keeps a collapsed parent its children while the preview moves around it', async () => {
    wrapper.find('#t1 .vtl-caret i').trigger('click')
    await Vue.nextTick()
    const childEl = wrapper.find('#t11').element
    dragStart(wrapper, 't3')

    dragOver(row(wrapper, 't1'), 0.9)
    await Vue.nextTick()
    dragOver(row(wrapper, 't1'), 0.5)
    await Vue.nextTick()

    expect(wrapper.find('.vtl-drop-ghost').classes()).toContain('vtl-drop-ghost--into')
    expect(wrapper.find('#t11').element).toBe(childEl)
  })

  it('shows no preview and drops nothing over the dragged node or its descendants', async () => {
    const snapshot = wrapper.html()
    dragStart(wrapper, 't1')

    const $self = row(wrapper, 't1')
    dragOver($self, 0.5)
    await Vue.nextTick()
    expect(wrapper.find('.vtl-drop-ghost').exists()).toBe(false)

    dragOver(row(wrapper, 't12'), 0.5)
    await Vue.nextTick()
    expect(wrapper.find('.vtl-drop-ghost').exists()).toBe(false)

    drop(wrapper)
    $self.trigger('dragend')
    await Vue.nextTick()
    expect(wrapper.html()).toBe(snapshot)
    expect(wrapper.emitted('drop')).toBeFalsy()
  })

  it('dims the dragged node and clears everything on dragend', async () => {
    jest.useFakeTimers()
    dragStart(wrapper, 't2')
    jest.runAllTimers()
    jest.useRealTimers()
    dragOver(row(wrapper, 't3'), 0.5)
    await Vue.nextTick()

    expect(wrapper.find('#t2').element.parentElement.classList).toContain('vtl-drag-source')
    expect(wrapper.find('.vtl-drop-ghost').exists()).toBe(true)

    row(wrapper, 't2').trigger('dragend')
    await Vue.nextTick()
    expect(wrapper.find('.vtl-drag-source').exists()).toBe(false)
    expect(wrapper.find('.vtl-drop-ghost').exists()).toBe(false)
    expect(topLevelIds(wrapper)).toEqual(['t1', 't2', 't3'])
  })

  it('does not start a drag on a disabled node', async () => {
    const tree = new Tree([
      { name: 'Locked', id: 'l1', pid: 0, disabled: true },
      { name: 'Open', id: 'o1', pid: 0 }
    ])
    wrapper.setProps({ model: tree })
    await Vue.nextTick()

    dragStart(wrapper, 'l1')
    dragOver(row(wrapper, 'o1'), 0.5)
    await Vue.nextTick()
    expect(wrapper.find('.vtl-drop-ghost').exists()).toBe(false)
  })

  it('uses the drop-labels prop for the preview tag', async () => {
    wrapper.setProps({ dropLabels: { into: 'Dans' } })
    dragStart(wrapper, 't3')
    dragOver(row(wrapper, 't2'), 0.5)
    await Vue.nextTick()
    expect(wrapper.find('.vtl-drop-tag').text()).toBe('↳ Dans')

    dragOver(row(wrapper, 't2'), 0.1)
    await Vue.nextTick()
    // Keys the prop leaves out keep the default text.
    expect(wrapper.find('.vtl-drop-tag').text()).toBe('↑ Before')
  })

  it('hides the preview when the pointer leaves the tree', async () => {
    dragStart(wrapper, 't3')
    dragOver(row(wrapper, 't2'), 0.5)
    await Vue.nextTick()
    expect(wrapper.find('.vtl-drop-ghost').exists()).toBe(true)

    // Moving between rows of the same tree keeps it.
    wrapper.trigger('dragleave', { relatedTarget: wrapper.find('#t1').element })
    await Vue.nextTick()
    expect(wrapper.find('.vtl-drop-ghost').exists()).toBe(true)

    wrapper.trigger('dragleave', { relatedTarget: document.body })
    await Vue.nextTick()
    expect(wrapper.find('.vtl-drop-ghost').exists()).toBe(false)
  })

  it('moves a node from one tree into another', async () => {
    const other = mount(VueTreeList, {
      propsData: { model: new Tree([{ name: 'Other', id: 'x1', pid: 0 }]) }
    })
    dragStart(wrapper, 't3')
    dragOver(row(other, 'x1'), 0.5)
    await Vue.nextTick()
    expect(other.find('.vtl-drop-ghost').text()).toContain('Node 3')

    // Only the tree under the pointer applies the drop.
    drop(wrapper)
    expect(topLevelIds(wrapper)).toEqual(['t1', 't2', 't3'])
    drop(other)
    await Vue.nextTick()
    expect(topLevelIds(wrapper)).toEqual(['t1', 't2'])
    expect(other.vm.model.children[0].children.map(node => node.id)).toEqual(['t3'])
    expect(other.emitted('drop')).toBeTruthy()
    expect(wrapper.emitted('drop')).toBeFalsy()
    other.destroy()
  })

  it('renders the preview with the tree slots', async () => {
    wrapper.destroy()
    wrapper = mount(VueTreeList, {
      propsData: {
        model: new Tree([
          { name: 'Alpha', id: 'a', pid: 0 },
          { name: 'Beta', id: 'b', pid: 0 }
        ])
      },
      scopedSlots: {
        leafNameDisplay(slotProps) {
          return <b class='custom-name'>{slotProps.model.name}!</b>
        },
        treeNodeIcon() {
          return <span class='custom-icon'>❀</span>
        }
      }
    })
    dragStart(wrapper, 'a')
    dragOver(row(wrapper, 'b'), 0.9)
    await Vue.nextTick()
    const $ghost = wrapper.find('.vtl-drop-ghost')
    expect($ghost.find('.custom-name').text()).toBe('Alpha!')
    expect($ghost.find('.custom-icon').exists()).toBe(true)
  })
})
